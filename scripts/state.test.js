// The delegated lifecycle through the CLI; all state and configuration live in scratch repos.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

function fixture(t) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'router-lifecycle-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  const config = path.join(target, 'config');
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, 'preferences.yaml'), 'preferences:\n  primary: openai\n  effort: high\n');
  const env = { ...process.env, ENGINEERING_ROUTER_CONFIG: config, ROUTER_SESSION: 'session-example' };
  const file = path.join(target, '.router/state.json');
  fs.mkdirSync(path.dirname(file));
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills/engineering-router/state.md'), 'utf8').match(/```json\n([\s\S]*?)```/)[1]);
  Object.assign(state.steps[2], { status: 'pending', model: null, effort: null, progress: null });
  fs.writeFileSync(file, JSON.stringify(state));
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const st = (...args) => spawnSync(path.join(ROOT, 'scripts/state'), [target, ...args], { encoding: 'utf8', env });
  const ok = (...args) => { const r = st(...args); assert.equal(r.status, 0, r.stdout + r.stderr); return r.stdout; };
  const put = (rel, content) => fs.writeFileSync(path.join(target, rel), content);
  const attempt = (out) => out.match(/^attempt: (\S+)$/m)[1];
  const result = (at, extra = {}) => ({ step: 'implementation', attempt: at, verdict: 'done', summary: 'Built once',
    artifacts: { findings: [] }, ...extra });
  const deliver = (value) => { put('.router/steps/3-implementation.result.json', JSON.stringify(value)); return st('deliver', '3'); };
  return { target, file, state, read, st, ok, put, attempt, result, deliver, env };
}

test('start opens and restarts a delegated attempt, and done delivery closes covered steps', (t) => {
  const f = fixture(t);
  const first = f.ok('start', '3', '--requires', 'findings');
  assert.match(first, /model: claude-bridge\/claude-opus-5-5/); // stored run primary wins preferences
  assert.match(first, /effort: high/);
  assert.match(first, /purpose: Build the CSV export/);
  assert.match(first, /requires: findings .router\/steps\/3-implementation.findings.json/);
  assert.equal(fs.readFileSync(path.join(f.target, '.router/steps/3-implementation.md'), 'utf8'), `run: ${f.state.run}\n`);
  assert.equal(f.read().steps[3].status, 'running');
  const old = f.attempt(first);
  const again = f.attempt(f.ok('start', '3', '--requires', 'findings', '--env', 'node 22'));
  assert.notEqual(again, old);
  const saved = fs.readFileSync(f.file, 'utf8');
  const stale = f.deliver(f.result(old));
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /not the current attempt/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
  const done = f.deliver(f.result(again));
  assert.equal(done.status, 0, done.stderr);
  assert.equal(f.read().steps[2].status, 'done');
  assert.equal(f.read().steps[2].outcome, 'Built once');
  assert.equal(f.read().steps[3].status, 'done');
  assert.equal(f.read().status, 'running'); // the review remains
});

test('done delivery records handoff values from its result', (t) => {
  const f = fixture(t);
  const at = f.attempt(f.ok('start', '3', '--requires', 'findings'));
  const handoff = { issue: { number: 95, url: 'https://example.test/issues/95' }, spec: 'docs/spec.md',
    ticket: { number: 96, url: 'https://example.test/issues/96' }, branch: '95-lifecycle', base: 'abc123',
    pr: { number: 97, url: 'https://example.test/pull/97' } };
  const r = f.deliver(f.result(at, { handoff }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.read().handoff, { issue: handoff.issue, spec: handoff.spec, tickets: [handoff.ticket],
    branch: handoff.branch, base_commit: handoff.base, pr: handoff.pr });
});

test('done delivery validates its PR body against the issue handoff it records', (t) => {
  const f = fixture(t);
  const at = f.attempt(f.ok('start', '3', '--requires', 'findings,pr-body'));
  const body = '.router/steps/3-implementation.pr-body.md';
  f.put(body, 'Closes #95\n');
  const issue = { number: 95, url: 'https://example.test/issues/95' };
  const r = f.deliver(f.result(at, { artifacts: { findings: [], 'pr-body': body }, handoff: { issue } }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(f.read().handoff.issue, issue);
  assert.equal(f.read().steps[2].status, 'done');
});

test('done delivery refuses a PR body linking the stale issue without state or inline artifact writes', (t) => {
  const f = fixture(t);
  const at = f.attempt(f.ok('start', '3', '--requires', 'findings,pr-body'));
  const body = '.router/steps/3-implementation.pr-body.md';
  const findings = '.router/steps/3-implementation.findings.json';
  f.put(body, 'Closes #42\n');
  f.put(findings, 'existing findings\n');
  const saved = fs.readFileSync(f.file, 'utf8');
  const r = f.deliver(f.result(at, { artifacts: { findings: [], 'pr-body': body },
    handoff: { issue: { number: 95, url: 'https://example.test/issues/95' } } }));
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /pr-body: must link the issue with "Closes #95"/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
  assert.equal(f.read().steps[2].result.verdict, null);
  assert.equal(fs.readFileSync(path.join(f.target, findings), 'utf8'), 'existing findings\n');
  assert.equal(fs.readFileSync(path.join(f.target, body), 'utf8'), 'Closes #42\n');
});

for (const verdict of ['fixes', 'blocked']) {
  test(`${verdict} delivery validates its PR body against the persisted issue, not the unapplied handoff`, (t) => {
    const f = fixture(t);
    const at = f.attempt(f.ok('start', '3', '--requires', 'findings,pr-body'));
    const body = '.router/steps/3-implementation.pr-body.md';
    const handoff = f.read().handoff;
    const findings = verdict === 'fixes' ? [{ title: 'Needs a fix', severity: 'high', found_by: ['implementation'] }] : [];
    const result = f.result(at, { verdict, remaining: 'Needs a decision', artifacts: { findings, 'pr-body': body },
      handoff: { issue: { number: 95, url: 'https://example.test/issues/95' } } });
    f.put(body, 'Closes #95\n');
    const saved = fs.readFileSync(f.file, 'utf8');
    const refused = f.deliver(result);
    assert.equal(refused.status, 1, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /pr-body: must link the issue with "Closes #42"/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
    assert.equal(fs.existsSync(path.join(f.target, '.router/steps/3-implementation.findings.json')), false);
    f.put(body, 'Closes #42\n');
    const accepted = f.deliver(result);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.deepEqual(f.read().handoff, handoff);
    assert.equal(f.read().steps[2].status, verdict === 'fixes' ? 'running' : 'waiting');
  });
}

test('invalid handoff refuses delivery without state or inline artifact writes, leaving the attempt open', (t) => {
  const f = fixture(t);
  const at = f.attempt(f.ok('start', '3', '--requires', 'findings'));
  const artifact = '.router/steps/3-implementation.findings.json';
  f.put(artifact, 'existing artifact\n');
  for (const [handoff, reason] of [
    [{ spec: '../outside.md' }, /handoff.spec: must be a path relative/],
    [{ unknown: 'x' }, /handoff field must be one of/],
    [{ branch: 42 }, /branch: expected/],
    [{ issue: { number: -1, url: 'x' } }, /issue: expected/],
    [{ pr: { number: true, url: 'x' } }, /pr: expected/],
    [{ ticket: '95' }, /ticket: expected/],
    [[], /result.handoff: must be an object/],
  ]) {
    const saved = fs.readFileSync(f.file, 'utf8');
    const r = f.deliver(f.result(at, { handoff }));
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, reason);
    assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
    assert.equal(fs.readFileSync(path.join(f.target, artifact), 'utf8'), 'existing artifact\n');
    assert.equal(f.read().steps[2].result.verdict, null);
  }
  assert.equal(f.deliver(f.result(at, { handoff: { branch: '95-fixed' } })).status, 0);
});

test('start refuses nondelegated and closed steps and removed commands leave state unchanged', (t) => {
  const f = fixture(t);
  for (const args of [ ['expect', '3'], ['model', '3'], ['step', '3', 'running'],
    ['step', '3', 'done', '--outcome', 'copied'], ['start', 'branch'], ['start', 'specification'], ['start', 'testing'],
    ['start', '3', '--requires', 'unknown'], ['start', '3', '--model', ''], ['start', '3', '--effort', 'max'] ]) {
    const saved = fs.readFileSync(f.file, 'utf8');
    const r = f.st(...args);
    assert.equal(r.status, 1, `${args}: ${r.stdout}${r.stderr}`);
    if (args[0] === 'step') assert.match(r.stderr, /use `start 3`, then `deliver 3`/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
    assert.equal(fs.existsSync(path.join(f.target, '.router/steps/3-implementation.md')), false);
  }
  f.ok('step', '3', 'running', '--main-session', '--model', 'session-model');
  f.ok('step', '3', 'done', '--main-session', '--outcome', 'Main session work');
  assert.equal(f.read().steps[2].outcome, 'Main session work');
  assert.equal(f.st('start', '3').status, 1);
});

test('start records retry approval, keeps the recorded model and prints reusable checks', (t) => {
  const f = fixture(t);
  const git = (...args) => {
    const r = spawnSync('git', ['-C', f.target, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', env: require('./lib/git-env')() });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git('init', '-q', '--template=', '-b', '95-lifecycle');
  f.put('source.js', 'v1\n');
  git('add', 'source.js');
  git('commit', '-qm', 'base');
  f.ok('start', '3', '--requires', 'findings', '--model', 'approved-model', '--effort', 'low');
  f.ok('check', '3', 'pass', '--command', 'node --check source.js', '--scope', 'source.js', '--env', 'node 22');
  for (let i = 0; i < 3; i++) f.ok('interrupt', '3', '--reason', 'quota');
  const saved = fs.readFileSync(f.file, 'utf8');
  const r = f.st('start', '3');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /retries used up/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), saved);
  const out = f.ok('start', '3', '--requires', 'findings', '--user-approved', '--env', 'node 22');
  assert.match(out, /reuse: node --check source.js \(node 22\) on source.js: pass/);
  assert.equal(f.read().steps[2].model, 'approved-model');
  assert.equal(f.read().steps[2].effort, 'low');
  assert.equal(f.read().steps[2].progress.approved, 3);
  assert.equal(f.read().steps[2].progress.interrupted, null);
  const at = f.read().steps[2].result.attempt;
  assert.equal(f.deliver(f.result(at, { handoff: { base: 'HEAD' } })).status, 0);
  assert.equal(f.read().handoff.base_commit, git('rev-parse', 'HEAD'));
});

test('done delivery closes the workflow when it carries the last open covered step', (t) => {
  const f = fixture(t);
  f.state.steps[4].status = 'skipped';
  f.state.steps[4].outcome = 'not in this workflow';
  fs.writeFileSync(f.file, JSON.stringify(f.state));
  const at = f.attempt(f.ok('start', '3', '--requires', 'findings'));
  assert.equal(f.deliver(f.result(at)).status, 0);
  assert.equal(f.read().status, 'done');
  assert.equal(f.read().steps[3].model, f.read().steps[2].model);
});

test('states and archives from before start remain valid, readable and remembered without rewrites', (t) => {
  const f = fixture(t);
  const old = fs.readFileSync(path.join(__dirname, 'fixtures/state-before-start.json'), 'utf8');
  const state = JSON.parse(old);
  fs.writeFileSync(f.file, old);
  const check = (target) => {
    const r = spawnSync(path.join(ROOT, 'scripts/check-state'), [target], { encoding: 'utf8', env: f.env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  };
  check(f.target);
  assert.match(f.ok('show'), /security.*No findings/);
  const archive = path.join(f.target, '.router/runs', state.run);
  fs.mkdirSync(path.join(archive, '.router'), { recursive: true });
  fs.writeFileSync(path.join(archive, 'state.json'), old);
  // check-state reads a target's .router/state.json; check the archived bytes through that seam too.
  fs.writeFileSync(path.join(archive, '.router/state.json'), old);
  check(archive);
  fs.rmSync(path.join(archive, '.router'), { recursive: true });
  const listed = spawnSync(path.join(ROOT, 'scripts/list-skills'), ['--target', f.target, 'security'], { encoding: 'utf8', env: f.env });
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /decided: addyosmani\/security-and-hardening  \[remembered/);
  assert.equal(fs.readFileSync(f.file, 'utf8'), old);
  fs.rmSync(f.file);
  const archived = spawnSync(path.join(ROOT, 'scripts/list-skills'), ['--target', f.target, 'security'], { encoding: 'utf8', env: f.env });
  assert.equal(archived.status, 0, archived.stderr);
  assert.match(archived.stdout, /decided: addyosmani\/security-and-hardening  \[remembered/);
  assert.equal(fs.readFileSync(path.join(archive, 'state.json'), 'utf8'), old);
});

test('fixes and blocked keep handoff unchanged and do not close the step', (t) => {
  for (const verdict of ['fixes', 'blocked']) {
    const f = fixture(t);
    const at = f.attempt(f.ok('start', '3', '--requires', 'findings'));
    const handoff = f.read().handoff;
    const findings = verdict === 'fixes' ? [{ title: 'Needs a fix', severity: 'high', found_by: ['implementation'] }] : [];
    const r = f.deliver(f.result(at, { verdict, remaining: 'Needs a decision', artifacts: { findings }, handoff: { branch: 'not-final' } }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(f.read().steps[2].status, verdict === 'fixes' ? 'running' : 'waiting');
    assert.equal(f.read().steps[2].outcome, null);
    assert.deepEqual(f.read().handoff, handoff);
  }
});
