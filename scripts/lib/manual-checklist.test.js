const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const fixture = (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'router-checklist-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  fs.mkdirSync(path.join(target, '.router'));
  const example = fs.readFileSync(path.join(ROOT, 'skills/engineering-router/state.md'), 'utf8').match(/```json\n([\s\S]*?)```/)[1];
  const file = path.join(target, '.router/state.json');
  fs.writeFileSync(file, example);
  const spawn = (input, script, args) => spawnSync(path.join(ROOT, 'scripts', script), args, {
    encoding: 'utf8', input, env: { ...process.env, ENGINEERING_ROUTER_CONFIG: '', XDG_CONFIG_HOME: path.join(target, 'config'), ROUTER_SESSION: 'session-example' },
  });
  const run = (script, ...args) => spawn(undefined, script, args);
  const state = (...args) => run('state', target, ...args);
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const set = (items) => {
    const input = path.join(target, 'checklist.json');
    fs.writeFileSync(input, JSON.stringify(items));
    return state('checklist', 'set', input);
  };
  const setLines = (lines) => {
    const input = path.join(target, 'checklist.md');
    fs.writeFileSync(input, lines.join('\n'));
    return state('checklist', 'set', input);
  };
  const setStdin = (text) => spawn(text, 'state', [target, 'checklist', 'set', '-']);
  return { target, file, read, state, set, setLines, setStdin, run };
};
const point = { action: 'Open export as a reader', expected: 'CSV contains only permitted rows' };
const passed = (r) => assert.equal(r.status, 0, r.stdout + r.stderr);

test('manual checklist persists tick and untick through the owner state command without changing evidence', (t) => {
  const f = fixture(t);
  const before = f.read();
  passed(f.set([point]));
  const item = f.read().manual_checklist[0];
  assert.deepEqual({ ...item, id: undefined }, { ...point, id: undefined, checked: false });
  passed(f.state('reply', `CHECKLIST ${before.run} ${item.id} on`));
  assert.equal(f.read().manual_checklist[0].checked, true);
  passed(f.run('check-state', f.target));
  passed(f.state('workflow', 'paused'));
  passed(f.state('reply', 'resume'));
  assert.equal(f.read().manual_checklist[0].checked, true);
  passed(f.state('checklist', 'check', before.run, item.id, 'off'));
  assert.equal(f.read().manual_checklist[0].checked, false);
  const after = f.read();
  for (const key of Object.keys(before).filter((k) => !['status', 'updated_at', 'manual_checklist'].includes(k))) assert.deepEqual(after[key], before[key], key);
});

test('replacement preserves only identical content, and stale or non-owner intents never change state', (t) => {
  const f = fixture(t);
  passed(f.set([point, { action: 'Open the panel', expected: 'Checklist appears' }]));
  const { run, manual_checklist: [first, second] } = f.read();
  passed(f.state('checklist', 'check', run, first.id, 'on'));
  passed(f.state('checklist', 'check', run, second.id, 'on'));
  passed(f.set([{ action: 'Open the panel', expected: 'Checklist appears' }, { ...point, expected: 'No export is allowed' }]));
  const [kept, edited] = f.read().manual_checklist;
  assert.equal(kept.id, second.id);
  assert.equal(kept.checked, true);
  assert.notEqual(edited.id, first.id);
  assert.equal(edited.checked, false);
  for (const args of [
    ['checklist', 'check', run, first.id, 'on'],
    ['reply', `checklist other-run ${kept.id} off`],
    ['reply', `checklist ${run.toLowerCase()} ${kept.id} off`],
    ['reply', `checklist ${run} ${kept.id} maybe`],
    ['checklist', 'check', run, kept.id, 'off', '--session', 'intruder'],
  ]) {
    const before = fs.readFileSync(f.file, 'utf8');
    assert.notEqual(f.state(...args).status, 0, args.join(' '));
    assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  }
  const before = fs.readFileSync(f.file, 'utf8');
  const input = path.join(f.target, 'other.json');
  fs.writeFileSync(input, '[]');
  assert.notEqual(f.state('checklist', 'set', input, '--session', 'intruder').status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  // A held lock refuses the owner too; no second writer bypasses it.
  fs.writeFileSync(path.join(f.target, '.router/state.lock'), JSON.stringify({ token: 'held' }));
  assert.notEqual(f.state('checklist', 'check', run, kept.id, 'off').status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});

test('check-state rejects a malformed manual checklist while missing and empty ones remain usable', (t) => {
  const f = fixture(t);
  const original = f.read();
  passed(f.run('check-state', f.target));
  for (const list of [
    null, {}, [{ id: 'a', ...point, checked: 'true' }], [{ id: '', ...point, checked: false }],
    [{ id: 'a', ...point, action: ' ', checked: false }],
    [{ id: 'a', ...point, checked: false }, { id: 'a', action: 'Other', expected: 'Result', checked: false }],
    Array.from({ length: 16 }, (_, i) => ({ id: String(i), action: String(i), expected: 'Result', checked: false })),
  ]) {
    fs.writeFileSync(f.file, JSON.stringify({ ...original, manual_checklist: list }));
    assert.notEqual(f.run('check-state', f.target).status, 0, JSON.stringify(list));
  }
  fs.writeFileSync(f.file, JSON.stringify(original));
  for (const list of [null, [{}], [{ ...point, checked: true }], [point, point], Array(16).fill(point)]) {
    const before = fs.readFileSync(f.file, 'utf8');
    assert.notEqual(f.set(list).status, 0);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  }
  passed(f.set([]));
  passed(f.state('workflow', 'done'));
  passed(f.run('check-state', f.target));
});

test('recomposition and resume retain the manual checklist, new runs archive rather than inherit, and records ignore ticks', (t) => {
  const f = fixture(t);
  const recordBefore = f.run('record', f.target, '--checklist', '2,1,1,0');
  passed(recordBefore);
  const composed = path.join(f.target, 'composed.json');
  fs.writeFileSync(composed, JSON.stringify(f.read()));
  passed(f.state('compose', composed));
  assert.deepEqual(f.read().manual_checklist, []);
  passed(f.set([point]));
  const old = f.read();
  passed(f.state('reply', `checklist ${old.run} ${old.manual_checklist[0].id} on`));
  const recordAfter = f.run('record', f.target, '--checklist', '2,1,1,0');
  passed(recordAfter);
  assert.equal(recordAfter.stdout, recordBefore.stdout);
  fs.writeFileSync(composed, JSON.stringify(f.read()));
  passed(f.state('compose', composed));
  assert.equal(f.read().manual_checklist[0].checked, true);
  passed(f.state('workflow', 'done'));
  passed(f.state('compose', '--new', composed));
  assert.deepEqual(f.read().manual_checklist, []);
  assert.notEqual(f.read().run, old.run);
  const archived = JSON.parse(fs.readFileSync(path.join(f.target, '.router/runs', old.run, 'state.json'), 'utf8'));
  assert.equal(archived.manual_checklist[0].checked, true);
  const before = fs.readFileSync(f.file, 'utf8');
  assert.notEqual(f.state('reply', `checklist ${old.run} ${old.manual_checklist[0].id} off`).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
});

test('old states without run or checklist still advance; cleared lists and unowned runs reject intents unchanged', (t) => {
  const f = fixture(t);
  const legacy = f.read();
  delete legacy.run;
  delete legacy.manual_checklist;
  fs.writeFileSync(f.file, JSON.stringify(legacy));
  passed(f.run('check-state', f.target));
  passed(f.state('workflow', 'paused'));
  const before = fs.readFileSync(f.file, 'utf8');
  assert.notEqual(f.set([point]).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  fs.writeFileSync(f.file, JSON.stringify({ ...legacy, run: 'with-run' }));
  passed(f.set([point]));
  const id = f.read().manual_checklist[0].id;
  passed(f.set([]));
  const cleared = fs.readFileSync(f.file, 'utf8');
  assert.notEqual(f.state('reply', `checklist with-run ${id} on`).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), cleared);
  passed(f.set([point]));
  assert.notEqual(f.read().manual_checklist[0].id, id);
  assert.equal(f.read().manual_checklist[0].checked, false);
  fs.writeFileSync(f.file, JSON.stringify({ ...f.read(), owner: null }));
  const unowned = fs.readFileSync(f.file, 'utf8');
  assert.notEqual(f.state('reply', `checklist with-run ${f.read().manual_checklist[0].id} on`).status, 0);
  assert.equal(fs.readFileSync(f.file, 'utf8'), unowned);
});

const fields = (f) => f.read().manual_checklist.map(({ action, expected, checked }) => ({ action, expected, checked }));

test('checklist set saves the checklist from its own lines, from a file or standard input, without markers or tags', (t) => {
  const f = fixture(t);
  passed(f.setLines([
    '- [agent] Open export as a reader → CSV contains only permitted rows',
    '',
    '2. `scripts/state x show` → run the command → it prints the state [you]',
    '* [ ] [you] Open the panel → Checklist appears',
  ]));
  assert.deepEqual(fields(f), [
    { ...point, checked: false },
    { action: '`scripts/state x show` → run the command', expected: 'it prints the state', checked: false },
    { action: 'Open the panel', expected: 'Checklist appears', checked: false },
  ]);
  passed(f.setStdin('1) Open the panel → Checklist appears\n'));
  assert.deepEqual(fields(f), [{ action: 'Open the panel', expected: 'Checklist appears', checked: false }]);
});

test('the router\'s checklist example is saved as written, from standard input, skipping its Also changed line', (t) => {
  const f = fixture(t);
  const doc = fs.readFileSync(path.join(ROOT, 'skills/engineering-router/after-implementation.md'), 'utf8');
  const [, command, lines] = doc.match(/```sh\n(scripts\/state <target repo> checklist set -) <<'EOF'\n([\s\S]*?)EOF\n```/) ?? [];
  assert.ok(command, 'after-implementation.md shows checklist set with a heredoc example');
  const points = lines.trim().split('\n');
  assert.match(points.at(-1), /^Also changed: /, 'the example ends with the closing Also changed line');
  passed(f.setStdin(lines));
  assert.equal(f.read().manual_checklist.length, points.length - 1);
  assert.ok(f.read().manual_checklist.every((p) => !/\[(agent|you)\]/.test(p.action + p.expected)));
});

test('a checklist line without action → expected is refused by its number and text, and nothing is written', (t) => {
  const f = fixture(t);
  passed(f.setLines(['Open the panel → Checklist appears']));
  for (const bad of ['Open the panel', '[you] → Checklist appears', '- Open the panel →']) {
    const before = fs.readFileSync(f.file, 'utf8');
    const r = f.setLines(['1. Open export as a reader → CSV contains only permitted rows', '', bad]);
    assert.notEqual(r.status, 0, bad);
    assert.ok(r.stderr.includes('line 3') && r.stderr.includes(bad), r.stderr);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before, bad);
  }
});

test('the closing Also changed line is skipped, after any marker', (t) => {
  const f = fixture(t);
  for (const closing of ['Also changed: the README', '- Also changed: the README → its install steps', '3. Also changed: the README']) {
    passed(f.setLines(['1. Open the panel → Checklist appears', '2. Open export as a reader → CSV contains only permitted rows', closing]));
    assert.deepEqual(fields(f), [{ action: 'Open the panel', expected: 'Checklist appears', checked: false }, { ...point, checked: false }], closing);
  }
});

test('lines keep the id and tick of unchanged points, also reordered, under the limit and the duplicate check', (t) => {
  const f = fixture(t);
  passed(f.setLines(['- [agent] Open the panel → Checklist appears', '- [you] Open export as a reader → CSV contains only permitted rows']));
  const { run, manual_checklist: [panel, csv] } = f.read();
  passed(f.state('checklist', 'check', run, csv.id, 'on'));
  passed(f.setLines(['1. [you] Open export as a reader → CSV contains only permitted rows', '2. [agent] Open the panel → Checklist appears']));
  assert.deepEqual(f.read().manual_checklist, [{ ...csv, checked: true }, panel]);
  // The same content under another tag is the same point.
  passed(f.setLines(['- [agent] Open the panel → Checklist appears', '- [agent] Open export as a reader → CSV contains only permitted rows']));
  assert.deepEqual(f.read().manual_checklist, [panel, { ...csv, checked: true }]);
  for (const lines of [
    ['[agent] Open the panel → Checklist appears', '[you] Open the panel → Checklist appears'],
    Array.from({ length: 16 }, (_, i) => `${i + 1}. Step ${i} → Result`),
  ]) {
    const before = fs.readFileSync(f.file, 'utf8');
    assert.notEqual(f.setLines(lines).status, 0, lines[0]);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before);
  }
});

test('the [agent]/[you] tags are dropped wherever they stand as a token, also in bold or code', (t) => {
  const f = fixture(t);
  passed(f.setLines([
    '- **[you]** Open the panel → Checklist appears',
    '- [agent] [you] Open export as a reader → CSV contains only permitted rows',
    '1. Open the menu → `[agent]` it lists every entry `[you]`',
    '2. Open the log [agent] → it shows [x][you]-tagged rows',
  ]));
  assert.deepEqual(fields(f), [
    { action: 'Open the panel', expected: 'Checklist appears', checked: false },
    { ...point, checked: false },
    { action: 'Open the menu', expected: 'it lists every entry', checked: false },
    { action: 'Open the log', expected: 'it shows [x][you]-tagged rows', checked: false },
  ]);
});

test('input is JSON only when it parses as JSON; a bare task-box line is a checklist line', (t) => {
  const f = fixture(t);
  passed(f.setStdin('[ ] [you] Open the panel → Checklist appears\n'));
  assert.deepEqual(fields(f), [{ action: 'Open the panel', expected: 'Checklist appears', checked: false }]);
  passed(f.setStdin('[x] Open export as a reader → CSV contains only permitted rows'));
  assert.deepEqual(fields(f), [{ ...point, checked: false }]);
  for (const [bad, message] of [
    ['[{"action": "Open the panel"', 'JSON'],
    ['["Open the panel → Checklist appears"]', 'must be an array of checklist points'],
  ]) {
    const before = fs.readFileSync(f.file, 'utf8');
    const r = f.setStdin(bad);
    assert.notEqual(r.status, 0, bad);
    assert.ok(r.stderr.includes(message), r.stderr);
    assert.equal(fs.readFileSync(f.file, 'utf8'), before, bad);
  }
});
