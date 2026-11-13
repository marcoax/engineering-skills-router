#!/usr/bin/env node
// Workflow overhead on a bounded sample task (#81): runs the router's scripts on one scratch
// target repo and measures what they hand to a step agent, which checks and review passes repeat,
// and what survives an interruption. Usage:
//
//   node evals/workflow-overhead/run.js [--before <router root>] [--json]
//
// `--before` names another router checkout (for example master, extracted with `git archive`):
// the same scenario runs there as far as its scripts support it, and every command it lacks is
// reported as such, never assumed. No agent and no provider runs: the times are the local
// scripts' own, so no provider latency is in them. Exits 1 when a property below does not hold
// on this checkout. A sample, not a benchmark.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const AFTER = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const beforeAt = argv.indexOf('--before');
const BEFORE = beforeAt >= 0 ? path.resolve(argv[beforeAt + 1]) : null;
const asJson = argv.includes('--json');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'router-overhead-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
// Scratch git and configuration: never the caller's repository or preferences.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k === 'GIT_EXEC_PATH' || !k.startsWith('GIT_')));
Object.assign(env, { XDG_CONFIG_HOME: path.join(tmp, 'xdg'), ROUTER_SESSION: 'session-example' });
for (const k of ['ENGINEERING_ROUTER_CONFIG', 'CLAUDE_CODE_SESSION_ID', 'PI_SESSION_ID']) delete env[k];

const MODEL = 'claude-bridge/claude-opus-5-5';
const ENV = 'node 22';
// The sample task's required checks, each with the files it covers.
const CHECKS = [
  { command: 'npm test', scope: 'src,test' },
  { command: 'npm run lint', scope: 'src' },
  { command: 'npm run docs', scope: 'README.md' },
  { command: 'npm run e2e', scope: '.' },
];
const E2E = CHECKS.length - 1;

function scenario(root, label) {
  const repo = fs.mkdtempSync(path.join(tmp, `${label}-`));
  const calls = [];
  const st = (...a) => {
    const t = process.hrtime.bigint();
    const r = spawnSync(path.join(root, 'scripts/state'), [repo, ...a], { encoding: 'utf8', env });
    calls.push(Number(process.hrtime.bigint() - t) / 1e6);
    return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` };
  };
  const g = (...a) => spawnSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', env });
  const put = (f, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
    fs.writeFileSync(path.join(repo, f), text);
  };
  const stateFile = path.join(repo, '.router/state.json');
  const read = () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  const missing = (r) => /unknown command|usage:/.test(r.out) && !r.ok;

  // The sample task: the state.md example (CSV export), implementation running on a fresh branch.
  // Exercise clients that initialize repositories without Git's default template.
  g('init', '-q', '--template=', '-b', 'export');
  put('src/export.js', 'v1');
  put('test/export.test.js', 't1');
  put('README.md', 'r1');
  put('.git/info/exclude', '.router/\n');
  g('add', '.');
  g('commit', '-qm', 'base');
  const doc = fs.readFileSync(path.join(root, 'skills/engineering-router/state.md'), 'utf8');
  const state = JSON.parse(doc.match(/```json\n([\s\S]*?)```/)[1]);
  state.handoff.branch = 'export';
  const impl = state.steps.findIndex((s) => s.id === 'implementation');
  delete state.steps[impl].progress;
  state.steps[impl].model = MODEL;
  fs.mkdirSync(path.dirname(stateFile));
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const n = impl + 1;
  const m = { label, root, commands: {} };

  // 1. Context handed to the implementation agent: the brief SKILL.md §6 asks for (fields, with
  // paths), next to one that recopies what those paths point at.
  const expected = st('start', String(n));
  m.commands.start = !missing(expected);
  const notes = state.steps.slice(0, impl).map((s, i) => `.router/steps/${i + 1}-${s.id}.md`);
  for (const [i, s] of state.steps.slice(0, impl).entries()) put(notes[i], `run: ${state.run ?? 'none'}\n${s.id}: ${s.outcome}\n`);
  const references = [path.join(root, 'skills/engineering-router/SKILL.md'), path.join(root, 'skills/engineering-router/autonomy.md'),
    ...notes.map((f) => path.join(repo, f))];
  const brief = [
    `Goal: ${state.task}: ${state.steps[impl].summary}`,
    `Authorized scope: ${repo}, branch export, policy autonomy.md`,
    `References: ${references.join(', ')}`,
    'Constraints: the target AGENTS.md; save progress with scripts/state progress/check',
    'Evidence already available: none (first attempt)',
    `Expected output: ${m.commands.start ? expected.out.trim().split('\n').join('; ') : 'a one-line outcome'}`,
  ].join('\n');
  const recopied = brief + references.map((f) => `\n\n--- ${f}\n${fs.readFileSync(f, 'utf8')}`).join('');
  m.brief = { fields_bytes: Buffer.byteLength(brief), recopied_bytes: Buffer.byteLength(recopied) };

  // 2. Work, checks and an interruption: committed work, three passing checks, then a timeout
  // that cuts off the end-to-end run.
  put('src/export.js', 'v2');
  put('test/export.test.js', 't2');
  g('add', '.');
  g('commit', '-qm', 'export');
  const checked = CHECKS.map((c, i) => st('check', String(n), i === E2E ? 'interrupted' : 'pass', '--command', c.command, '--scope', c.scope, '--env', ENV));
  m.commands.check = checked.every((r) => r.ok);
  const progressed = st('progress', String(n), '--done', 'export written and tested, committed', '--next', 'rerun the e2e check');
  m.commands.progress = progressed.ok;
  const interrupted = st('interrupt', String(n), '--reason', 'timeout');
  m.commands.interrupt = interrupted.ok;
  const checkName = (l) => l.trim().replace(/^(reuse|rerun): /, '').split(' (')[0];
  const listed = (out, kind) => out.split('\n').filter((l) => l.trim().startsWith(`${kind}:`)).map(checkName);
  const first = st('recover', '--env', ENV);
  // Without a record every required check runs again; with one, only those it cannot prove.
  m.checks = { required: CHECKS.length, rerun_after_timeout: first.ok ? listed(first.out, 'rerun') : null, reused_after_timeout: first.ok ? listed(first.out, 'reuse') : null };
  m.checks.reused_without_env = listed(st('recover').out, 'reuse').length;

  // 3. A partial fix left uncommitted in src/, then a quota stop: what is kept, where it resumes,
  // which checks rerun (those covering src/), on which model.
  put('src/fix.js', 'partial');
  st('progress', String(n), '--done', 'export tested and committed; fix half done', '--next', 'finish the fix in src/fix.js');
  st('interrupt', String(n), '--reason', 'quota');
  const saved = fs.readFileSync(stateFile, 'utf8');
  const rec = st('recover', '--env', ENV);
  m.commands.recover = rec.ok;
  const lines = rec.ok ? rec.out.split('\n') : [];
  m.recovery = {
    partial_work_kept: fs.readFileSync(path.join(repo, 'src/fix.js'), 'utf8') === 'partial' && lines.some((l) => l.includes('uncommitted: src/fix.js')),
    commits_kept: g('rev-list', '--count', 'HEAD').stdout.trim() === '2',
    resumes_at_next: lines.some((l) => l === `continue: step ${n} implementation: finish the fix in src/fix.js`),
    model_kept: lines.some((l) => l.includes(`model: ${MODEL} as recorded`)) && read().steps[impl].model === MODEL,
    recover_changes_nothing: fs.readFileSync(stateFile, 'utf8') === saved,
  };
  m.checks.after_partial_fix = { rerun: listed(rec.out, 'rerun'), reused: listed(rec.out, 'reuse') };

  // Retries stay bounded: past two the step goes on only with the user's yes.
  st('interrupt', String(n), '--reason', 'quota');
  const unapproved = st('progress', String(n), '--done', 'fix half done', '--next', 'finish the fix');
  const approved = st('progress', String(n), '--done', 'fix half done', '--next', 'finish the fix', '--user-approved');
  m.retries = { refused_past_two: m.commands.progress && !unapproved.ok, continued_with_approval: approved.ok, model_kept: read().steps[impl].model === MODEL };

  // 4. Review passes: the implementation closes on its delivery, the review runs once per purpose.
  put('src/fix.js', 'done');
  g('add', '.');
  g('commit', '-qm', 'fix');
  const closeWithout = st('step', String(n), 'done', '--outcome', 'Built');
  m.delivery = { close_without_delivery_refused: !closeWithout.ok };
  if (m.commands.start) {
    const again = st('start', String(n));
    const attempt = again.out.match(/^attempt: (\S+)/m)?.[1];
    const note = `.router/steps/${n}-implementation.md`;
    put(note, `run: ${read().run}\nBuilt the CSV export; tests pass.\n`);
    put(`.router/steps/${n}-implementation.result.json`, JSON.stringify({ step: 'implementation', attempt, verdict: 'done', summary: 'Built', artifacts: { note }, remaining: null }));
    m.delivery.accepted = st('deliver', String(n)).ok;
    m.delivery.closed_after_delivery = read().steps[impl].status === 'done' && read().steps[impl].outcome === 'Built';
    const r = state.steps.findIndex((s) => s.id === 'review') + 1;
    const pass = (...a) => st('start', String(r), ...a);
    const deliverReview = (verdict, findings) => {
      const at = pass(...(m.reviewPasses ? ['--purpose', m.reviewPasses] : [])).out.match(/^attempt: (\S+)/m)?.[1];
      fs.appendFileSync(path.join(repo, `.router/steps/${r}-review.md`), 'Reviewed the export.\n');
      put(`.router/steps/${r}-review.findings.json`, JSON.stringify(findings));
      put(`.router/steps/${r}-review.result.json`, JSON.stringify({ step: 'review', attempt: at, verdict, summary: verdict,
        artifacts: { note: `.router/steps/${r}-review.md`, findings: `.router/steps/${r}-review.findings.json` }, remaining: null }));
      return st('deliver', String(r)).ok;
    };
    const finding = { title: 'the export ignores the date filter', severity: 'high', found_by: ['review'] };
    const first = deliverReview('fixes', [finding]);
    m.reviewPasses = null;
    const noPurpose = pass();
    const samePurpose = pass('--purpose', state.steps[r - 1].summary);
    m.reviewPasses = 'record the decisions after the fixes';
    const second = deliverReview('done', [{ ...finding, decision: 'fixed' }]);
    m.reviews = {
      first_pass_accepted: first,
      another_pass_without_purpose_refused: !noPurpose.ok,
      same_purpose_refused: !samePurpose.ok,
      declared_second_pass_accepted: second,
      purposes: (read().steps[r - 1].result?.earlier ?? []).map((e) => e.purpose).concat(read().steps[r - 1].result?.purpose ?? []),
    };
    delete m.reviewPasses;
  }

  m.script_time_ms = { calls: calls.length, total: Math.round(calls.reduce((a, b) => a + b, 0)), median: Math.round([...calls].sort((a, b) => a - b)[Math.floor(calls.length / 2)]) };
  return m;
}

const after = scenario(AFTER, 'after');
const before = BEFORE ? scenario(BEFORE, 'before') : null;

// What must hold on this checkout.
const problems = [];
const need = (ok, what) => { if (!ok) problems.push(what); };
need(Object.values(after.commands).every(Boolean), `every command ran: ${JSON.stringify(after.commands)}`);
for (const [k, v] of Object.entries(after.recovery)) need(v, `recovery: ${k}`);
const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...b].sort());
need(same(after.checks.reused_after_timeout, ['npm test', 'npm run lint', 'npm run docs']) && same(after.checks.rerun_after_timeout, ['npm run e2e']),
  `after the timeout only the cut-off check reruns: ${JSON.stringify(after.checks)}`);
need(after.checks.reused_without_env === 0, 'no check reused without --env');
need(same(after.checks.after_partial_fix.reused, ['npm run docs']) && same(after.checks.after_partial_fix.rerun, ['npm test', 'npm run lint', 'npm run e2e']),
  `a partial fix in src/ reruns only the checks covering it: ${JSON.stringify(after.checks.after_partial_fix)}`);
need(after.brief.fields_bytes < after.brief.recopied_bytes, 'the brief with paths is smaller than a recopied one');
for (const [k, v] of Object.entries(after.retries)) need(v, `retries: ${k}`);
need(after.delivery.close_without_delivery_refused && after.delivery.accepted && after.delivery.closed_after_delivery, `delivery: ${JSON.stringify(after.delivery)}`);
for (const [k, v] of Object.entries(after.reviews ?? { ran: false })) if (k !== 'purposes') need(v, `reviews: ${k}`);

if (asJson) console.log(JSON.stringify({ after, before, problems }, null, 2));
else {
  const row = (name, f) => `| ${name} | ${before ? `${f(before)} | ` : ''}${f(after)} |`;
  const yes = (v) => (v === undefined ? 'not run' : v ? 'yes' : 'no');
  const has = (m, c) => (m.commands[c] ? 'yes' : 'no (command absent)');
  console.log([
    `| Measure | ${before ? 'before | ' : ''}after |`,
    `|---|${before ? '---|' : ''}---|`,
    row('brief with paths (bytes)', (m) => m.brief.fields_bytes),
    row('brief recopying its references (bytes)', (m) => m.brief.recopied_bytes),
    row('progress and checks recorded', (m) => `${has(m, 'check')}`),
    row('required checks to rerun after a timeout in e2e', (m) => (m.commands.recover ? `${m.checks.rerun_after_timeout.length} of ${m.checks.required} (${m.checks.rerun_after_timeout.join(', ')})` : `${m.checks.required} of ${m.checks.required} (nothing recorded)`)),
    row('checks reused without --env', (m) => (m.commands.recover ? m.checks.reused_without_env : 'n/a')),
    row('after a partial fix in src/: rerun / reused', (m) => (m.commands.recover ? `${m.checks.after_partial_fix.rerun.join(', ')} / ${m.checks.after_partial_fix.reused.join(', ')}` : 'n/a')),
    row('partial work and commits kept and listed', (m) => (m.commands.recover ? yes(m.recovery.partial_work_kept && m.recovery.commits_kept) : 'kept in the checkout, not listed (no record)')),
    row('resumes at the recorded next work', (m) => (m.commands.recover ? yes(m.recovery.resumes_at_next) : 'no record to resume from')),
    row('model unchanged after interruptions', (m) => (m.commands.recover ? yes(m.recovery.model_kept && m.retries.model_kept) : 'not recorded')),
    row('a third retry needs the user\'s yes', (m) => yes(m.retries.refused_past_two)),
    row('delegated step closed without a delivery refused', (m) => yes(m.delivery.close_without_delivery_refused)),
    row('another review pass without a declared purpose refused', (m) => yes(m.reviews?.another_pass_without_purpose_refused)),
    row('review purposes', (m) => (m.reviews ? m.reviews.purposes.join('; ') : 'not run')),
    row('scripts/state calls, total / median ms', (m) => `${m.script_time_ms.calls}, ${m.script_time_ms.total} / ${m.script_time_ms.median}`),
  ].join('\n'));
  if (problems.length) console.log(`\nFAIL:\n- ${problems.join('\n- ')}`);
}
process.exit(problems.length ? 1 : 0);
