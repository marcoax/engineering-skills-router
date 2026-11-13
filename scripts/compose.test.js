// compose builds the workflow's steps from the checked classification and selection (issue #96),
// through the CLI; all state and configuration live in scratch repos.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');

const pick = (skill, reason = `${skill} fits`) => ({ skill, reason });
const phase = (name, skill, extra = {}) => ({ phase: name, reason: `the task needs ${name}`, default: pick(skill), alternatives: [], ...extra });
// A full-path feature: specification + issue, implementation with its tests, one review, the PR.
const FEATURE = {
  phases: [
    phase('specification', 'mattpocock/to-spec', { alternatives: [pick('addyosmani/spec-driven-development', 'spec as a repo document')],
      prerequisites: ['gh logged in, to publish the issue'], tie: 'to-spec and spec-driven-development; publishing separates them' }),
    phase('implementation', 'mattpocock/implement', { alternatives: [pick('addyosmani/incremental-implementation', 'thin slices')] }),
    phase('testing', 'addyosmani/test-driven-development', { alternatives: [pick('pstack/tdd', 'small steps')] }),
    phase('review', 'addyosmani/code-review-and-quality', { alternatives: [pick('mattpocock/code-review', 'standards and spec axes')] }),
    phase('pull-request', 'mattpocock/pr'),
  ],
  omitted: [
    { phase: 'requirements', reason: 'settled in the conversation' },
    { phase: 'planning', reason: 'a single ticket' },
    { phase: 'security', reason: 'no input, auth or secrets touched' },
    { phase: 'independent-review', reason: 'medium risk' },
  ],
  missing: [{ phase: 'framework-review', reason: 'no docs/agents/skills.yaml' }],
  capabilities: ['subagents'],
};
const CLASSIFICATION = {
  type: 'feature', risk: 'medium', complexity: 'medium', path: 'full', properties: ['brownfield', 'user-facing'],
  classification: { policy: 3, ticket: false, facts: [],
    rationale: { type: 'a new capability', risk: 'contained and reversible', complexity: 'three files' }, uncertain: [] },
  requested: null,
};

function fixture(t) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'router-compose-'));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'router-compose-input-'));
  t.after(() => { fs.rmSync(target, { recursive: true, force: true }); fs.rmSync(scratch, { recursive: true, force: true }); });
  const config = path.join(scratch, 'config');
  fs.mkdirSync(config);
  fs.writeFileSync(path.join(config, 'preferences.yaml'), 'preferences:\n  primary: claude\n');
  const env = { ...process.env, ENGINEERING_ROUTER_CONFIG: config, ROUTER_SESSION: 'session-example' };
  // The tracker is configured, so to-spec needs no setup step unless a test removes it.
  fs.mkdirSync(path.join(target, 'docs/agents'), { recursive: true });
  fs.writeFileSync(path.join(target, 'docs/agents/issue-tracker.md'), 'GitHub issues\n');
  const file = path.join(target, '.router/state.json');
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const input = (name, value) => {
    const f = path.join(scratch, name);
    fs.writeFileSync(f, JSON.stringify(value));
    return f;
  };
  const st = (...args) => spawnSync(path.join(ROOT, 'scripts/state'), [target, ...args], { encoding: 'utf8', env });
  // compose with the given classification and selection (defaults: the feature above).
  const compose = ({ classification = CLASSIFICATION, selection = FEATURE, task = 'Add CSV export to the reports page', isNew = true, extra = [] } = {}) =>
    st('compose', ...(isNew ? ['--new'] : []), '--classification', input('classification.json', classification),
      '--selection', input('selection.json', selection), ...(task == null ? [] : ['--task', task]), ...extra);
  const ok = (r) => { assert.equal(r.status, 0, r.stdout + r.stderr); return r.stdout; };
  const step = (id) => read().steps.find((s) => s.id === id);
  const ids = () => read().steps.map((s) => s.id);
  return { target, file, read, input, st, compose, ok, step, ids, env };
}

test('compose --new builds a selecting state from the classification and the selection', (t) => {
  const f = fixture(t);
  f.ok(f.compose());
  const s = f.read();
  assert.equal(s.status, 'selecting');
  assert.equal(s.task, 'Add CSV export to the reports page');
  assert.deepEqual([s.type, s.risk, s.complexity, s.path], ['feature', 'medium', 'medium', 'full']);
  assert.deepEqual(s.properties, ['brownfield', 'user-facing']);
  assert.equal(s.classification.policy, 3);
  assert.equal(s.requested, undefined);
  assert.deepEqual(f.ids(), ['specification', 'branch', 'implementation', 'testing', 'review', 'verification', 'pull-request']);
});

test('each step carries the selection unchanged; covered steps keep the pick, optional steps start off', (t) => {
  const f = fixture(t);
  const out = f.ok(f.compose());
  const spec = f.step('specification');
  assert.deepEqual(spec.phases, ['specification', 'issue-tracking']);
  assert.equal(spec.skill, 'mattpocock/to-spec');
  assert.equal(spec.reason, 'mattpocock/to-spec fits');
  assert.equal(spec.summary, 'the task needs specification');
  assert.deepEqual(spec.alternatives, [{ skill: 'addyosmani/spec-driven-development', reason: 'spec as a repo document' }]);
  assert.deepEqual(spec.prerequisites, ['gh logged in, to publish the issue']);
  assert.equal(spec.cost, null);
  assert.equal(spec.tie, 'to-spec and spec-driven-development; publishing separates them');
  assert.equal(spec.confirm, false);
  // implement runs tdd inside: testing is covered, the selector's pick kept aside.
  const testing = f.step('testing');
  assert.equal(testing.covered_by, 'implementation');
  assert.equal(testing.skill, 'mattpocock/tdd');
  assert.deepEqual(testing.selected, { skill: 'addyosmani/test-driven-development', reason: 'addyosmani/test-driven-development fits',
    alternatives: [{ skill: 'pstack/tdd', reason: 'small steps' }] });
  assert.match(out, /coverage: testing runs inside implementation/);
  assert.equal(f.step('review').covered_by, null);
  assert.deepEqual([f.step('verification').optional, f.step('verification').status, f.step('verification').outcome], [true, 'skipped', 'off (optional)']);
  assert.equal(f.step('pull-request').skill, 'mattpocock/pr');
  assert.equal(f.step('branch').skill, null);
  // The selector's skipped and missing phases stay with the run.
  assert.deepEqual(f.read().missing, [{ phase: 'framework-review', reason: 'no docs/agents/skills.yaml' }]);
  assert.equal(f.read().omitted.length, 4);
});

test('the default flow changes by type: debugging and code-understanding before requirements', (t) => {
  const f = fixture(t);
  const selection = {
    ...FEATURE,
    phases: [phase('requirements', 'mattpocock/grill-me'), phase('debugging', 'mattpocock/diagnosing-bugs'),
      phase('code-understanding', 'pstack/how'), ...FEATURE.phases],
    omitted: FEATURE.omitted.filter((o) => o.phase !== 'requirements'),
  };
  f.ok(f.compose({ selection, classification: { ...CLASSIFICATION, type: 'bug' } }));
  assert.deepEqual(f.ids(), ['debugging', 'code-understanding', 'requirements', 'specification', 'branch', 'implementation', 'testing',
    'review', 'verification', 'pull-request']);
});

test('multi-session: only the multi-session step; implementation happens in later sessions', (t) => {
  const f = fixture(t);
  const later = ['specification', 'implementation', 'review', 'pull-request'].map((p) => ({ phase: p, reason: 'a later session, from its output' }));
  const selection = {
    ...FEATURE,
    phases: [phase('multi-session', 'mattpocock/wayfinder'), phase('planning', 'mattpocock/wayfinder')],
    omitted: [...FEATURE.omitted.filter((o) => o.phase !== 'planning'), ...later],
  };
  f.ok(f.compose({ selection }));
  assert.deepEqual(f.ids(), ['multi-session']);
  assert.deepEqual(f.step('multi-session').phases, ['multi-session', 'planning', 'issue-tracking']);
  // Work for the later sessions selected alongside it is refused, naming the phases.
  const both = { ...selection, phases: [...selection.phases, ...FEATURE.phases.filter((p) => p.phase !== 'specification')],
    omitted: [...FEATURE.omitted.filter((o) => o.phase !== 'planning'), { phase: 'specification', reason: 'wayfinder maps the route' }] };
  const r = f.compose({ selection: both, isNew: false });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /multi-session: implementation happens in later sessions from its output \(SKILL\.md §2\): omit implementation, testing, review, pull-request/);
  assert.deepEqual(f.ids(), ['multi-session']);
});

test('refactor: code-understanding before the specification; refactoring or architecture implements it', (t) => {
  const f = fixture(t);
  const REFACTOR = { ...CLASSIFICATION, type: 'refactor' };
  const without = (...names) => FEATURE.phases.filter((p) => !names.includes(p.phase));
  const front = [phase('code-understanding', 'pstack/how'), phase('architecture', 'mattpocock/codebase-design')];
  const implemented = { phase: 'implementation', reason: 'the refactoring skill implements it' };
  // Refactoring selected: it implements after the branch; architecture stays a design step in front.
  f.ok(f.compose({ classification: REFACTOR, selection: { ...FEATURE, phases: [...front, phase('refactoring', 'addyosmani/code-simplification'),
    ...without('implementation', 'testing')], omitted: [...FEATURE.omitted, implemented] } }));
  assert.deepEqual(f.ids(), ['code-understanding', 'architecture', 'specification', 'branch', 'refactoring', 'review', 'verification', 'pull-request']);
  // Architecture alone: it implements, after the branch.
  f.ok(f.compose({ classification: REFACTOR, selection: { ...FEATURE, phases: [...front, ...without('implementation', 'testing')],
    omitted: [...FEATURE.omitted, implemented] } }));
  assert.deepEqual(f.ids(), ['code-understanding', 'specification', 'branch', 'architecture', 'review', 'verification', 'pull-request']);
});

test('the light path: branch, implementation, review, security, framework-review, pull request', (t) => {
  const f = fixture(t);
  const selection = {
    phases: [phase('implementation', 'addyosmani/incremental-implementation'), phase('review', 'addyosmani/code-review-and-quality'),
      phase('security', 'addyosmani/security-and-hardening'), phase('pull-request', 'mattpocock/pr')],
    omitted: ['requirements', 'specification', 'planning', 'independent-review'].map((p) => ({ phase: p, reason: 'not on the light path' })),
    missing: [{ phase: 'framework-review', reason: 'no project skills' }],
  };
  const classification = { ...CLASSIFICATION, risk: 'low', complexity: 'low', path: 'light',
    classification: { ...CLASSIFICATION.classification, ticket: true } };
  f.ok(f.compose({ selection, classification, extra: ['--issue', 'https://github.com/acme/app/issues/42'] }));
  assert.deepEqual(f.ids(), ['branch', 'implementation', 'review', 'security', 'pull-request']);
  assert.equal(f.read().path, 'light');
  assert.deepEqual(f.read().handoff.issue, { number: 42, url: 'https://github.com/acme/app/issues/42' });
  assert.equal(f.step('branch').summary, 'Create 42-<slug>');
});

test('issue-tracking gets no step of its own; a workflow nothing publishes from is issue-free', (t) => {
  const f = fixture(t);
  const own = { ...FEATURE, phases: [...FEATURE.phases, phase('issue-tracking', 'mattpocock/triage')] };
  const r = f.compose({ selection: own });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /issue-tracking: mattpocock\/triage: gets no step of its own/);
  assert.equal(fs.existsSync(f.file), false);
  const free = { ...FEATURE, phases: [phase('specification', 'addyosmani/spec-driven-development'), ...FEATURE.phases.slice(1)] };
  const out = f.ok(f.compose({ selection: free }));
  assert.deepEqual(f.step('specification').phases, ['specification']);
  assert.equal(f.step('branch').summary, 'Create <slug> (issue-free.md)');
  assert.match(out, /^Issue-free: no selected skill publishes an issue \(issue-free\.md\)$/m);
});

test('an existing spec file is the handoff at composition', (t) => {
  const f = fixture(t);
  const selection = { ...FEATURE, phases: FEATURE.phases.slice(1),
    omitted: [...FEATURE.omitted, { phase: 'specification', reason: 'the task is a spec file' }] };
  const missing = f.compose({ selection, extra: ['--spec', 'docs/specs/csv-export.md'] });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--spec docs\/specs\/csv-export\.md: no such file in the target repo/);
  assert.equal(fs.existsSync(f.file), false);
  fs.mkdirSync(path.join(f.target, 'docs/specs'), { recursive: true });
  fs.writeFileSync(path.join(f.target, 'docs/specs/csv-export.md'), '# CSV export\n');
  const out = f.ok(f.compose({ selection, extra: ['--spec', 'docs/specs/csv-export.md'] }));
  assert.equal(f.read().handoff.spec, 'docs/specs/csv-export.md');
  assert.match(out, /^Issue-free: the spec file docs\/specs\/csv-export.md is the handoff/m);
});

test('setup is prepended when a selected skill needs tracker configuration the target lacks', (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.target, 'docs/agents/issue-tracker.md'));
  f.ok(f.compose());
  assert.equal(f.ids()[0], 'setup');
  assert.equal(f.step('setup').skill, 'mattpocock/setup-matt-pocock-skills');
  assert.match(f.step('setup').reason, /mattpocock\/to-spec requires tracker-config/);
});

test('independent-review is optional and off; a requested checkpoint is recorded on its step', (t) => {
  const f = fixture(t);
  const selection = { ...FEATURE, phases: [...FEATURE.phases, phase('independent-review', 'pstack/blast-radius')],
    omitted: FEATURE.omitted.filter((o) => o.phase !== 'independent-review') };
  const classification = { ...CLASSIFICATION, risk: 'high' };
  const out = f.ok(f.compose({ selection, classification, extra: ['--checkpoint', 'review'] }));
  assert.deepEqual(f.ids().slice(4), ['review', 'independent-review', 'verification', 'pull-request']);
  assert.deepEqual([f.step('independent-review').optional, f.step('independent-review').status], [true, 'skipped']);
  assert.equal(f.step('review').confirm, true);
  assert.match(out, /^5\. addyosmani\/code-review-and-quality {3}review {3}on openai-codex\/gpt-6-sol {3}⏸$/m);
  assert.match(out, /^6\. pstack\/blast-radius {3}independent-review .*\(off\)$/m);
  const unknown = f.compose({ selection, classification, isNew: false, extra: ['--checkpoint', 'deploy'] });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /checkpoint deploy: no step or phase "deploy"/);
});

test('a decided phase keeps its origin as its reason', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.env.ENGINEERING_ROUTER_CONFIG, 'preferences.yaml'),
    'preferences:\n  primary: claude\n  review:\n    prefer: [mattpocock/code-review]\n');
  const decided = { ...FEATURE, phases: FEATURE.phases.map((p) => (p.phase === 'review'
    ? phase('review', 'mattpocock/code-review', { default: pick('mattpocock/code-review', 'preference') }) : p)) };
  f.ok(f.compose({ selection: decided }));
  assert.equal(f.step('review').reason, 'preference');
});

test('a classification or selection that fails its check is refused with its errors, and nothing is written', (t) => {
  const f = fixture(t);
  const wrong = { ...FEATURE, phases: FEATURE.phases.map((p) => (p.phase === 'review' ? phase('review', 'mattpocock/tdd') : p)) };
  let r = f.compose({ selection: wrong });
  assert.equal(r.status, 1);
  const check = spawnSync(path.join(ROOT, 'scripts/check-selection'), ['--target', f.target, f.input('wrong.json', wrong)], { encoding: 'utf8', env: f.env });
  const errors = check.stdout.split('\n').filter((l) => l.startsWith('error:'));
  assert.ok(errors.length > 0);
  for (const line of errors) assert.ok(r.stderr.includes(line), `${line}\n${r.stderr}`);
  assert.match(r.stderr, /error: review: default mattpocock\/tdd: not a candidate for review/);
  assert.equal(fs.existsSync(f.file), false);
  const authz = { fact: 'authorization', where: 'src/auth/guard.ts', evidence: 'changes which roles pass canEditInvoice' };
  r = f.compose({ classification: { ...CLASSIFICATION, risk: 'low', classification: { ...CLASSIFICATION.classification, facts: [authz] } } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /error: risk low is below the minimum high set by authorization/);
  assert.equal(fs.existsSync(f.file), false);
});

test('compose and show print the workflow for the reply, and reply works on it', (t) => {
  const f = fixture(t);
  const out = f.ok(f.compose());
  for (const want of [/^Task: Add CSV export to the reports page$/m,
    /^Type: feature {3}Risk: medium {3}Complexity: medium {3}Path: full {3}Properties: brownfield, user-facing$/m,
    /^1\. mattpocock\/to-spec {3}specification, issue-tracking$/m, /^ {3}a\) addyosmani\/spec-driven-development: spec as a repo document$/m,
    /^ {3}needs: gh logged in, to publish the issue · tie: to-spec/m, /^2\. branch {3}Create <issue-number>-<slug> once the issue is published$/m,
    /^4\. mattpocock\/tdd {3}testing {3}inside implementation$/m, /^6\. verification {3}Work through the \[agent\] checklist points {3}\(off\)$/m,
    /^Models: claude .* · primary claude/m, /^Skipped: planning: a single ticket$/m, /^Missing: framework-review: no available skill/m, /^Reply: go \| /m]) {
    assert.match(out, want);
  }
  const shown = f.ok(f.st('show'));
  assert.ok(out.includes(shown), `show should print what compose printed\n${shown}`);
  f.ok(f.st('reply', '3a'));
  assert.equal(f.step('implementation').skill, 'addyosmani/incremental-implementation');
  assert.equal(f.step('testing').covered_by, null);
  f.ok(f.st('reply', '6on'));
  assert.equal(f.step('verification').status, 'pending');
  f.ok(f.st('reply', 'primary', 'openai'));
  f.ok(f.st('reply', 'go'));
  assert.equal(f.read().status, 'running');
  assert.match(f.ok(f.st('show')), /^Status: running$/m);
});

test('a recomposition keeps completed steps, primary, handoff, checklist and reviewed revisions', (t) => {
  const f = fixture(t);
  f.ok(f.compose({ extra: ['--issue', '42'] }));
  f.ok(f.st('reply', 'primary', 'openai'));
  f.ok(f.st('reply', 'go'));
  f.ok(f.st('step', '1', 'running', '--main-session'));
  f.ok(f.st('step', '1', 'done', '--outcome', 'Published #42', '--main-session'));
  const points = f.input('checklist.json', [{ action: 'Open reports', expected: 'An Export button' }]);
  f.ok(f.st('checklist', 'set', points));
  const before = f.read();
  const swapped = { ...FEATURE, phases: FEATURE.phases.map((p) => (p.phase === 'implementation'
    ? phase('implementation', 'addyosmani/incremental-implementation') : p)) };
  const out = f.ok(f.compose({ isNew: false, selection: swapped, task: null }));
  assert.match(out, /classification: kept \(policy 3\)/);
  const s = f.read();
  assert.deepEqual(s.steps[0], before.steps[0]);
  assert.equal(s.status, 'selecting');
  assert.equal(s.task, before.task);
  for (const k of ['run', 'owner', 'primary', 'handoff', 'manual_checklist', 'reviewed']) assert.deepEqual(s[k], before[k], k);
  assert.equal(f.step('implementation').skill, 'addyosmani/incremental-implementation');
  // Dropping a completed step is refused.
  const dropped = { ...FEATURE, phases: FEATURE.phases.slice(1), omitted: [...FEATURE.omitted, { phase: 'specification', reason: 'done' }] };
  const r = f.compose({ isNew: false, selection: dropped });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /specification: a recomposition keeps completed steps/);
});

test('a file holding a complete state is refused with a pointer to the new input', (t) => {
  const f = fixture(t);
  const state = f.input('state.json', { version: 1, steps: [] });
  const r = f.st('compose', '--new', state);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a file holding a complete state is refused/);
  assert.match(r.stderr, /--classification <file> --selection <file>/);
  assert.equal(fs.existsSync(f.file), false);
  // The same pointer when the state comes as the selection.
  const asSelection = f.compose({ selection: { version: 1, task: 'x', steps: [] } });
  assert.equal(asSelection.status, 1);
  assert.match(asSelection.stderr, /a file holding a complete state is refused/);
  assert.match(asSelection.stderr, /--classification <file> --selection <file>/);
  assert.doesNotMatch(asSelection.stdout + asSelection.stderr, /check-selection/);
  assert.equal(fs.existsSync(f.file), false);
});
