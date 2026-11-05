// Progress records (state.md "Progress", docs/adr/0003-progress-records.md): what a running step
// has saved so far, and how `scripts/state … recover` reads it back against the current checkout.
// `checkout(target)` reads git; every other function is pure: state in, new state (or lines) out.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stepIndex } = require('./state-ops');

const RESULTS = ['pass', 'fail', 'interrupted'];
// An interrupted step is retried at most this many times before the user decides.
const RETRIES = 2;
const ROUTER_DIR = '.router/';

const clone = (s) => JSON.parse(JSON.stringify(s));
const fail = (msg) => {
  throw new Error(msg);
};
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
  // SHA-256 over each file in scope (its path, then its content as it is on disk), sorted.
  const content = (scope) => {
    const listed = git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...scope);
    if (listed == null || head == null) return null;
    const hash = crypto.createHash('sha256');
    for (const file of [...new Set(listed.split('\0').filter((f) => f && !f.startsWith(ROUTER_DIR)))].sort()) {
      const p = path.join(target, file);
      const stat = fs.statSync(p, { throwIfNoEntry: false });
      hash.update(`${file}\0`);
      hash.update(!stat ? 'deleted' : stat.isFile() ? fs.readFileSync(p) : 'not a file');
      hash.update('\0');
    }
    return hash.digest('hex');
  };
  const isAncestor = (sha) => spawnSync('git', ['-C', target, 'merge-base', '--is-ancestor', sha, 'HEAD'], { env }).status === 0;
  const commitsSince = (sha) => Number(git('rev-list', '--count', `${sha}..HEAD`)?.trim() ?? NaN);
  return { branch, head, changes: changes.sort(), content, isAncestor, commitsSince };
}

const empty = () => ({ at: null, branch: null, head: null, changes: [], done: null, next: null, limits: null, interrupted: null, interruptions: 0, checks: [] });

// The running step `ref` with its progress refreshed from the checkout, in a copy of `state`.
function refreshed(state, ref, co, at) {
  const s = clone(state);
  const step = s.steps[stepIndex(s, ref)];
  if (step.status !== 'running') fail(`step ${step.id} is ${step.status}: only a running step records progress`);
  step.progress = Object.assign(step.progress ?? empty(), { at, branch: co.branch, head: co.head, changes: co.changes });
  return { s, p: step.progress };
}

// What the step has done and the first work still needed. A new record replaces the previous
// one's lines and ends its interruption: the step is running again.
function recordProgress(state, ref, { done, next, limits }, co, at) {
  const { s, p } = refreshed(state, ref, co, at);
  Object.assign(p, { done: done || null, next: next || null, limits: limits || null, interrupted: null });
  return s;
}

// A check the step ran, tied to the content of its scope; a rerun replaces the earlier result.
function recordCheck(state, ref, { result, command, scope, environment }, co, at) {
  if (!RESULTS.includes(result)) fail(`check result must be ${RESULTS.join(' | ')}`);
  if (!command || !environment) fail('check needs --command and --env');
  const paths = scope?.length ? scope : ['.'];
  const { s, p } = refreshed(state, ref, co, at);
  p.checks = [...p.checks.filter((c) => c.command !== command),
    { command, scope: paths, environment, result, head: co.head, content: co.content(paths), at }];
  return s;
}

// The step stopped before it ended (timeout, quota, unavailable model): neither done nor waiting.
function recordInterruption(state, ref, reason, co, at) {
  if (!reason) fail('interrupt needs --reason');
  const { s, p } = refreshed(state, ref, co, at);
  p.interrupted = { reason, at };
  p.interruptions += 1;
  return s;
}

// Why a recorded check must run again in this checkout, or null when its result still holds.
function rerunReason(c, co, env, history) {
  if (c.result === 'interrupted') return 'interrupted';
  if (c.result === 'fail') return 'it failed';
  if (!co.head) return 'not a git checkout';
  if (!history || (c.head && !co.isAncestor(c.head))) return 'its recorded commit is not in this checkout';
  if (env && env !== c.environment) return `environment is ${env}`;
  if (c.content == null || co.content(c.scope) !== c.content) return 'its files changed since';
  return null;
}

// The recorded commit must be in this checkout's history for anything recorded to be trusted.
const inHistory = (p, co) => Boolean(p.head && co.head && (p.head === co.head || co.isAncestor(p.head)));

// One line per recorded check: reuse it, or rerun it and why.
const checkLines = (p, co, env) => p.checks.map((c) => {
  const label = `${c.command} (${c.environment}) on ${c.scope.join(', ')}`;
  const why = rerunReason(c, co, env, inHistory(p, co));
  return why ? `   rerun: ${label}: ${why}` : `   reuse: ${label}: pass`;
});

// The recovery plan, one line each: completed steps kept with their checks, each open step's record checked against
// the checkout, which checks hold and which rerun, and where to continue. Changes nothing.
function recovery(state, co, env) {
  const lines = [`recover: ${state.task} · workflow ${state.status}`];
  const branch = state.handoff?.branch;
  if (branch && co.branch !== branch) lines.push(`branch: on ${co.branch ?? 'no branch'}, the run works on ${branch}: check it out first`);
  if (co.changes.length) lines.push(`uncommitted: ${co.changes.join(', ')}`);
  let next = null;
  state.steps.forEach((step, i) => {
    const n = `${i + 1}. ${step.id}`;
    if (['done', 'skipped', 'failed'].includes(step.status)) {
      lines.push(`${n}: ${step.status}, kept`, ...(step.progress ? checkLines(step.progress, co, env) : []));
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
    const usedUp = p.interruptions > RETRIES;
    if (p.interrupted) {
      lines.push(`${n}: interrupted (${p.interrupted.reason}), ${usedUp
        ? `retries used up (${p.interruptions} interruptions): ask the user to retry, change model or stop`
        : `retry ${p.interruptions} of ${RETRIES}`}`);
    } else lines.push(`${n}: ${step.status}${p.interruptions ? `, after ${p.interruptions} interruption(s)` : ''}`);
    if (!p.next) lines.push(`${n}: incomplete progress record: no next work`);
    lines.push(`   done: ${p.done ?? 'not recorded'}`, `   next: ${p.next ?? 'not recorded'}`);
    if (p.limits) lines.push(`   limits: ${p.limits}`);
    const history = inHistory(p, co);
    if (!p.head || !co.head) lines.push('   checkout: not a git checkout: rerun every check');
    else if (p.head === co.head) lines.push(`   checkout: at the recorded commit ${short(p.head)} on ${co.branch ?? 'a detached HEAD'}`);
    else if (history) lines.push(`   checkout: ${co.commitsSince(p.head)} commit(s) after the recorded commit ${short(p.head)}`);
    else lines.push(`   checkout: recorded commit ${short(p.head)} is not in this checkout's history: stop and ask before continuing`);
    const gone = p.changes.filter((f) => !co.changes.includes(f));
    if (gone.length) lines.push(`   no longer uncommitted: ${gone.join(', ')} (committed or discarded since the record: check before continuing)`);
    lines.push(...checkLines(p, co, env));
    lines.push(`   model: ${step.model ?? 'none recorded'} as recorded; another model or family only with the user's yes`);
    next ??= usedUp || !history ? `ask the user before step ${i + 1} ${step.id}` : `step ${i + 1} ${step.id}: ${p.next ?? 'from git and the step note'}`;
  });
  lines.push(`continue: ${next ?? 'nothing left'}`);
  return lines;
}

module.exports = { checkout, recordProgress, recordCheck, recordInterruption, recovery, RESULTS, RETRIES };
