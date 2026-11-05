// Progress records (state.md "Progress", docs/adr/0003-progress-records.md): what a running step
// has saved so far, and how `scripts/state … recover` reads it back against the current checkout.
// `checkout(target)` reads git; every other function is pure: state in, new state (or lines) out.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { clone, fail, stepIndex, CLOSED } = require('./state-ops');

const RESULTS = ['pass', 'fail', 'interrupted'];
// An interrupted step is retried at most this many times before the user decides.
const RETRIES = 2;
const ROUTER_DIR = '.router/';

const short = (sha) => sha.slice(0, 7);

// The target's checkout: branch, HEAD, uncommitted paths, and what recover asks of git. Outside
// a git repo every value is null or empty, so nothing recorded there can be proven later.
function checkout(target) {
  const env = require('./git-env')();
  const git = (...a) => {
    const r = spawnSync('git', ['-C', target, ...a], { encoding: 'utf8', env });
    return r.status === 0 ? r.stdout : null;
  };
  const head = git('rev-parse', '--verify', '-q', 'HEAD')?.trim() || null;
  const branch = git('symbolic-ref', '-q', '--short', 'HEAD')?.trim() || null;
  const changes = [];
  const entries = (git('status', '--porcelain', '-z', '--untracked-files=all') ?? '').split('\0');
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    if (/^[RC]/.test(e)) i++; // a rename or copy is followed by its source path
    const file = e.slice(3);
    if (!file.startsWith(ROUTER_DIR)) changes.push(file);
  }
  // SHA-256 over each file's path, type, executable bits and content, sorted. A path
  // named in the scope counts even when ignored (a gitignored .env); the whole tree ('.') does not.
  const content = (scope) => {
    // A path inside a submodule gives no rows in the parent repo's scoped ls-files.
    // Check gitlinks from the full index before trusting even an empty scoped list.
    const index = git('ls-files', '--stage', '-z');
    if (index == null || head == null) return null;
    const scopedPaths = scope.map((p) => path.resolve(target, p));
    for (const entry of index.split('\0').filter((e) => e.startsWith('160000 '))) {
      const submodule = path.resolve(target, entry.slice(entry.indexOf('\t') + 1));
      if (scopedPaths.some((p) => p === submodule || p.startsWith(`${submodule}${path.sep}`) || submodule.startsWith(`${p}${path.sep}`)))
        return null;
    }
    const listed = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...scope);
    const named = scope.filter((e) => e !== '.');
    const ignored = named.length ? git('ls-files', '-z', '--others', '--ignored', '--exclude-standard', '--', ...named) : '';
    if (listed == null || ignored == null || head == null) return null;
    const hash = crypto.createHash('sha256');
    hash.update('router-scope-v2\0');
    for (const file of [...new Set(`${listed}\0${ignored}`.split('\0').filter((f) => f && !f.startsWith(ROUTER_DIR)))].sort()) {
      const p = path.join(target, file);
      try {
        const stat = fs.lstatSync(p, { throwIfNoEntry: false });
        // A deleted path stays in the index until commit. Hash the filesystem, so
        // committing an already-tested deletion does not invalidate the check.
        if (!stat) continue;
        // Git lists a submodule as a directory, without its files. Symlinks and other
        // unsupported entries are unprovable too: force a rerun instead of reusing a check.
        if (!stat.isFile()) return null;
        const bytes = fs.readFileSync(p);
        hash.update(`${JSON.stringify([file, 'file', stat.mode & 0o111, bytes.length])}\0`);
        hash.update(bytes);
        hash.update('\0');
      } catch {
        return null; // unreadable or changed while being fingerprinted
      }
    }
    return hash.digest('hex');
  };
  const isAncestor = (sha) => spawnSync('git', ['-C', target, 'merge-base', '--is-ancestor', sha, 'HEAD'], { env }).status === 0;
  const commitsSince = (sha) => Number(git('rev-list', '--count', `${sha}..HEAD`)?.trim() ?? NaN);
  return { branch, head, changes: changes.sort(), content, isAncestor, commitsSince };
}

const empty = () => ({ at: null, branch: null, head: null, changes: [], done: null, next: null, limits: null, interrupted: null, interruptions: 0, approved: null, checks: [] });

// Whether a step was interrupted more often than it may be retried without the user's yes.
const usedUp = (p) => Boolean(p) && p.interruptions > RETRIES && (p.approved ?? 0) < p.interruptions;

// Why step `ref` may not go on (new progress, a new delivery) yet, or null: past its retries it
// needs the user's yes, which `approved` records with the interruptions it covers.
function retryProblem(state, ref, { approved = false } = {}) {
  const step = state.steps[stepIndex(state, ref)];
  if (approved || !usedUp(step.progress)) return null;
  return `step ${step.id}: retries used up (${step.progress.interruptions} interruptions): ask the user, then pass --user-approved`;
}

// The running step `ref` with its progress refreshed from the checkout, in a copy of `state`.
function refreshed(state, ref, checkout, at) {
  const s = clone(state);
  const step = s.steps[stepIndex(s, ref)];
  if (step.status !== 'running') fail(`step ${step.id} is ${step.status}: only a running step records progress`);
  step.progress = Object.assign(step.progress ?? empty(), { at, branch: checkout.branch, head: checkout.head, changes: checkout.changes });
  return { s, p: step.progress };
}

// What the step has done and the first work still needed. A new record replaces the previous
// one's lines and ends its interruption: the step is running again. Past the retries it needs
// `approved`, the user's yes, recorded.
function recordProgress(state, ref, { done, next, limits, approved }, checkout, at) {
  const problem = retryProblem(state, ref, { approved });
  if (problem) fail(problem);
  const { s, p } = refreshed(state, ref, checkout, at);
  Object.assign(p, { done: done || null, next: next || null, limits: limits || null, interrupted: null });
  if (approved && p.interruptions > RETRIES) p.approved = p.interruptions;
  return s;
}

// A check the step ran, tied to the content of its scope; a rerun replaces the earlier result.
function recordCheck(state, ref, { result, command, scope, environment }, checkout, at) {
  if (!RESULTS.includes(result)) fail(`check result must be ${RESULTS.join(' | ')}`);
  if (!command || !environment) fail('check needs --command and --env');
  const paths = scope?.length ? scope : ['.'];
  const { s, p } = refreshed(state, ref, checkout, at);
  p.checks = [...p.checks.filter((c) => c.command !== command),
    { command, scope: paths, environment, result, head: checkout.head, content: checkout.content(paths), at }];
  return s;
}

// The step stopped before it ended (timeout, quota, unavailable model): neither done nor waiting.
function recordInterruption(state, ref, reason, checkout, at) {
  if (!reason) fail('interrupt needs --reason');
  const { s, p } = refreshed(state, ref, checkout, at);
  p.interrupted = { reason, at };
  p.interruptions += 1;
  return s;
}

// Why a recorded check must run again in this checkout, or null when its result still holds. The
// environment the check would run in now must be given and match: unknown, it proves nothing.
function rerunReason(c, checkout, env, history) {
  if (c.result === 'interrupted') return 'interrupted';
  if (c.result === 'fail') return 'it failed';
  if (!checkout.head) return 'not a git checkout';
  if (!history || (c.head && !checkout.isAncestor(c.head))) return 'its recorded commit is not in this checkout';
  if (!env) return 'environment not given (recover --env)';
  if (env !== c.environment) return `environment is ${env}`;
  if (c.content == null || checkout.content(c.scope) !== c.content) return 'its files changed since';
  return null;
}

// The recorded commit must be in this checkout's history for anything recorded to be trusted.
const inHistory = (p, checkout) => Boolean(p.head && checkout.head && (p.head === checkout.head || checkout.isAncestor(p.head)));

// One line per recorded check: reuse it, or rerun it and why.
const checkLines = (p, checkout, env) => p.checks.map((c) => {
  const label = `${c.command} (${c.environment}) on ${c.scope.join(', ')}`;
  const why = rerunReason(c, checkout, env, inHistory(p, checkout));
  return why ? `   rerun: ${label}: ${why}` : `   reuse: ${label}: pass`;
});

// The recovery plan, one line each: completed steps kept with their checks, each open step's record checked against
// the checkout, which checks hold and which rerun, and where to continue. Changes nothing.
function recovery(state, checkout, env) {
  const lines = [`recover: ${state.task} · workflow ${state.status}`];
  const branch = state.handoff?.branch;
  if (branch && checkout.branch !== branch) lines.push(`branch: on ${checkout.branch ?? 'no branch'}, the run works on ${branch}: check it out first`);
  if (checkout.changes.length) lines.push(`uncommitted: ${checkout.changes.join(', ')}`);
  let next = null;
  state.steps.forEach((step, i) => {
    const n = `${i + 1}. ${step.id}`;
    if (CLOSED.includes(step.status)) {
      lines.push(`${n}: ${step.status}, kept`, ...(step.progress ? checkLines(step.progress, checkout, env) : []));
      return;
    }
    if (step.status === 'pending') {
      next ??= `step ${i + 1} ${step.id}: not started`;
      return;
    }
    const p = step.progress;
    if (!p) {
      lines.push(`${n}: ${step.status}, no progress record: rebuild it from git and the step note; report nothing as done or checked`);
      next ??= `step ${i + 1} ${step.id}: from git and the step note`;
      return;
    }
    const stuck = usedUp(p);
    const approved = p.interruptions > RETRIES && !stuck ? ', retry approved by the user' : '';
    if (p.interrupted) {
      lines.push(`${n}: interrupted (${p.interrupted.reason}), ${stuck
        ? `retries used up (${p.interruptions} interruptions): ask the user to retry, change model or stop`
        : approved ? `retry approved by the user` : `retry ${p.interruptions} of ${RETRIES}`}`);
    } else lines.push(`${n}: ${step.status}${p.interruptions ? `, after ${p.interruptions} interruption(s)` : ''}${approved}`);
    if (!p.next) lines.push(`${n}: incomplete progress record: no next work`);
    lines.push(`   done: ${p.done ?? 'not recorded'}`, `   next: ${p.next ?? 'not recorded'}`);
    if (p.limits) lines.push(`   limits: ${p.limits}`);
    const history = inHistory(p, checkout);
    if (!p.head || !checkout.head) lines.push('   checkout: not a git checkout: rerun every check');
    else if (p.head === checkout.head) lines.push(`   checkout: at the recorded commit ${short(p.head)} on ${checkout.branch ?? 'a detached HEAD'}`);
    else if (history) lines.push(`   checkout: ${checkout.commitsSince(p.head)} commit(s) after the recorded commit ${short(p.head)}`);
    else lines.push(`   checkout: recorded commit ${short(p.head)} is not in this checkout's history: stop and ask before continuing`);
    const gone = p.changes.filter((f) => !checkout.changes.includes(f));
    if (gone.length) lines.push(`   no longer uncommitted: ${gone.join(', ')} (committed or discarded since the record: check before continuing)`);
    lines.push(...checkLines(p, checkout, env));
    lines.push(`   model: ${step.model ?? 'none recorded'} as recorded; another model or family only with the user's yes`);
    next ??= stuck || !history ? `ask the user before step ${i + 1} ${step.id}` : `step ${i + 1} ${step.id}: ${p.next ?? 'from git and the step note'}`;
  });
  lines.push(`continue: ${next ?? 'nothing left'}`);
  return lines;
}

module.exports = { checkout, recordProgress, recordCheck, recordInterruption, retryProblem, recovery, RESULTS, RETRIES };
