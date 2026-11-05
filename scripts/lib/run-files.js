// The files of a run beside its state (ADR 0002): the lock that serializes writing commands, the
// step notes headed by their run, the archive in `.router/runs/<run>/`, and the reconciliation a
// resume reads. scripts/state decides when; this module does the file and git work.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { OPEN } = require('./state-ops');

const STEPS_DIR = '.router/steps';
const RUNS_DIR = '.router/runs';
// A lock older than this is a crashed command's.
const STALE_MS = 30000;

// A random hex token: a run id's suffix, a delivery's attempt.
const token = (bytes) => crypto.randomBytes(bytes).toString('hex');
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// The first of `<base><ext>`, `<base>-2<ext>`, `<base>-3<ext>`… that does not exist yet.
function freePath(base, ext = '') {
  let p = `${base}${ext}`;
  for (let i = 2; fs.existsSync(p); i++) p = `${base}-${i}${ext}`;
  return p;
}

// Holds `<routerDir>/state.lock`, created exclusively, until the process exits. A stale lock is
// broken only by the holder of `state.lock.break`, which checks it again first: two commands that
// found the same stale lock never remove a fresh one between them. Throws after `timeoutMs`.
function lock(routerDir, { timeoutMs = 10000 } = {}) {
  const lockFile = path.join(routerDir, 'state.lock');
  const breaker = `${lockFile}.break`;
  const mine = `${process.pid} ${token(4)}\n`;
  fs.mkdirSync(routerDir, { recursive: true });
  const create = (f) => {
    try {
      fs.writeFileSync(f, mine, { flag: 'wx' });
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      return false;
    }
  };
  const isStale = (f) => {
    try {
      return Date.now() - fs.statSync(f).mtimeMs > STALE_MS;
    } catch {
      return false; // released meanwhile
    }
  };
  const deadline = Date.now() + timeoutMs;
  while (!create(lockFile)) {
    // A breaker left by a command that crashed while breaking (a moment's window) is stale too.
    if (isStale(breaker)) fs.rmSync(breaker, { force: true });
    if (create(breaker)) {
      try {
        if (isStale(lockFile)) fs.rmSync(lockFile, { force: true });
      } finally {
        fs.rmSync(breaker, { force: true });
      }
    }
    if (Date.now() > deadline) throw new Error(`another scripts/state command holds ${lockFile}: retry, or remove it if none is running`);
    sleep(20);
  }
  // Released only while it is still this command's: a lock broken as stale is another's by then.
  process.on('exit', () => {
    try {
      if (fs.readFileSync(lockFile, 'utf8') === mine) fs.rmSync(lockFile);
    } catch {
      // Already gone.
    }
  });
}

// A run id as a directory name inside .router/runs/: never `.`, `..` or a path.
const runDirName = (run) => String(run).replace(/[^\w.-]/g, '-').replace(/^\./, '-');

// The run a note belongs to: its first line `run: <run>`, else null.
const NOTE_RUN = /^run: (\S+)/;
const noteRun = (text) => text.match(NOTE_RUN)?.[1] ?? null;
// A note's text without its run line.
const noteBody = (text) => text.replace(/^run: \S+\n?/, '');
// A step's note path, relative to the target repo (SKILL.md §6 point 5).
const notePath = (state, i) => `${STEPS_DIR}/${i + 1}-${state.steps[i].id}.md`;

// A run's archive, .router/runs/<run>/ (a state without a run: legacy-<updated_at>), never reused.
function archiveDir(target, state) {
  const run = state?.run ?? `legacy-${String(state?.updated_at ?? 'unknown').replace(/\W/g, '')}`;
  return freePath(path.join(target, RUNS_DIR, runDirName(run)));
}

// Moves the run `state` (its state, and `.router/steps/`) to its archive; returns the archive,
// relative to the target.
function archive(target, state) {
  const dir = archiveDir(target, state);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
  const steps = path.join(target, STEPS_DIR);
  if (fs.existsSync(steps)) fs.renameSync(steps, path.join(dir, 'steps'));
  return path.relative(target, dir);
}

// A started step's note, headed `run: <run>`. A missing note is started with that line, so the
// step appends to it. A note another run left at that path moves to that run's archive; one of
// this run, or without a run line (perhaps this step's own, before an interruption), stays.
// Returns the `note:` line.
function startNote(target, state, i) {
  const rel = notePath(state, i);
  const note = path.join(target, rel);
  const line = `note: ${rel}, first line \`run: ${state.run}\``;
  const header = `run: ${state.run}\n`;
  if (!fs.existsSync(note)) {
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, header);
    return line;
  }
  const other = noteRun(fs.readFileSync(note, 'utf8'));
  if (other === null || other === state.run) return line;
  const dir = path.join(target, RUNS_DIR, runDirName(other), 'steps');
  fs.mkdirSync(dir, { recursive: true });
  const dest = freePath(path.join(dir, path.basename(note, '.md')), '.md');
  fs.renameSync(note, dest);
  fs.writeFileSync(note, header);
  return `${line} (the note of run ${other} there moved to ${path.relative(target, dest)})`;
}

// What a resume compares (resume.md): the state against the branch, the commits since the base,
// the PR and the notes, as lines. Prints facts; deciding what they prove is the router's.
function reconcile(target, state, ownerLine) {
  const h = state.handoff ?? {};
  const open = state.steps.filter((s) => OPEN.includes(s.status));
  const env = require('./git-env')();
  const git = (...a) => spawnSync('git', ['-C', target, ...a], { encoding: 'utf8', env });
  const lines = [`run: ${state.run ?? 'none recorded (a state written before runs)'}`, ownerLine, `workflow: ${state.status}`];
  const head = git('rev-parse', '--abbrev-ref', 'HEAD');
  const current = head.status === 0 ? head.stdout.trim() : null;
  if (!h.branch) lines.push(`branch: none recorded${current ? ` (checked out: ${current})` : ''}`);
  else lines.push(`branch: ${h.branch} (${current === h.branch ? 'checked out' : current ? `not checked out; ${current} is` : 'no git repository'})`);
  if (h.base_commit) {
    const tip = h.branch && git('rev-parse', '--verify', '--quiet', h.branch).status === 0 ? h.branch : 'HEAD';
    const count = git('rev-list', '--count', `${h.base_commit}..${tip}`);
    lines.push(count.status === 0
      ? `commits: ${count.stdout.trim()} since base ${h.base_commit.slice(0, 7)}`
      : `commits: unknown, base ${h.base_commit.slice(0, 7)} not found`);
  } else lines.push('commits: no base recorded');
  if (h.pr) {
    const gh = spawnSync('gh', ['pr', 'view', h.pr.url || String(h.pr.number), '--json', 'state', '-q', '.state'], { cwd: target, encoding: 'utf8', timeout: 15000 });
    const prState = gh.status === 0 ? gh.stdout.trim() : null;
    const openIds = open.map((s) => s.id).join(', ');
    if (!prState) lines.push(`pr: #${h.pr.number} state unknown (gh: ${(gh.stderr || gh.error?.message || '').trim().split('\n')[0]})`);
    else if (prState === 'MERGED' && open.length) lines.push(`pr: #${h.pr.number} MERGED: evidence to reconcile, not proof the open steps ran (open: ${openIds})`);
    else lines.push(`pr: #${h.pr.number} ${prState}`);
  } else lines.push('pr: none');
  const dir = path.join(target, STEPS_DIR);
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : []) {
    const run = noteRun(fs.readFileSync(path.join(dir, name), 'utf8'));
    const whose = run === null ? 'no run line: unverified' : run === state.run ? 'this run' : `run ${run}: not evidence for this run`;
    lines.push(`note: ${STEPS_DIR}/${name} (${whose})`);
  }
  const i = state.steps.findIndex((s) => !['done', 'skipped'].includes(s.status));
  lines.push(i < 0 ? 'next: none, every step closed' : `next: ${i + 1}. ${state.steps[i].id} (${state.steps[i].status})`);
  return lines;
}

module.exports = { lock, token, freePath, archive, startNote, reconcile, noteRun, noteBody, notePath, STEPS_DIR };
