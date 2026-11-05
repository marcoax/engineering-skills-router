const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SKILLS = ['engineering-router', 'skill-selector'];

// A throwaway checkout and Claude config: `scripts/setup` and `claude` are stubs that log their arguments.
function fixture(t) {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'router-install-')));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'checkout with spaces');
  const config = path.join(tmp, 'claude config');
  const log = path.join(tmp, 'calls');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'bin'));
  for (const name of SKILLS) fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../install-claude'), path.join(root, 'scripts/install-claude'));
  for (const file of [path.join(root, 'scripts/setup'), path.join(tmp, 'bin/claude')]) {
    fs.writeFileSync(file, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$INSTALL_TEST_LOG"\n', { mode: 0o755 });
  }
  const run = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/install-claude'), ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tmp, CLAUDE_CONFIG_DIR: config,
      PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`, INSTALL_TEST_LOG: log },
  });
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');
  const target = (name) => path.join(config, 'skills', name);
  return { tmp, root, config, run, calls, clearCalls: () => fs.writeFileSync(log, ''), target };
}

test('--help and unknown options run nothing', (t) => {
  const f = fixture(t);
  assert.equal(f.run('--help').status, 0);
  assert.equal(f.run('--unknown').status, 1);
  assert.equal(f.calls(), '');
});

test('a fresh install runs setup, links both skills and installs the panel', (t) => {
  const f = fixture(t);
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  for (const name of SKILLS) assert.equal(fs.readlinkSync(f.target(name)), path.join(f.root, 'skills', name));
  assert.match(f.calls(), /plugin marketplace add .*checkout with spaces/);
  assert.match(f.calls(), /plugin install engineering-router-panel@engineering-skills-router/);
});

test('a fresh --no-panel install links both skills and never calls claude', (t) => {
  const f = fixture(t);
  const r = f.run('--no-panel');
  assert.equal(r.status, 0, r.stderr);
  for (const name of SKILLS) assert.equal(fs.readlinkSync(f.target(name)), path.join(f.root, 'skills', name));
  assert.equal(f.calls(), '\n', 'only the setup stub (no arguments) runs');
});

test('a repeat run keeps the links and reports them as already linked', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const r = f.run();
  assert.equal(r.status, 0, r.stderr);
  for (const name of SKILLS) assert.match(r.stdout, new RegExp(`Already linked: .*${name}`));
});

test('a link to this checkout through another path counts as already linked', (t) => {
  const f = fixture(t);
  const alias = path.join(f.tmp, 'alias');
  fs.symlinkSync(f.root, alias, 'dir');
  fs.mkdirSync(path.dirname(f.target(SKILLS[0])), { recursive: true });
  for (const name of SKILLS) fs.symlinkSync(path.join(alias, 'skills', name), f.target(name), 'dir');
  const r = f.run('--no-panel');
  assert.equal(r.status, 0, r.stderr);
  for (const name of SKILLS) assert.equal(fs.readlinkSync(f.target(name)), path.join(alias, 'skills', name));
});

for (const [kind, occupy] of [
  ['a dangling link', (f, target) => fs.symlinkSync(path.join(f.tmp, 'missing'), target)],
  ['a link to another existing directory', (f, target) => {
    fs.mkdirSync(path.join(f.tmp, 'other clone'));
    fs.symlinkSync(path.join(f.tmp, 'other clone'), target, 'dir');
  }],
  ['a plain directory', (f, target) => fs.mkdirSync(target)],
]) {
  test(`${kind} at a skill path stops the install before any change`, (t) => {
    const f = fixture(t);
    const target = f.target('skill-selector');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    occupy(f, target);
    const before = fs.lstatSync(target).isSymbolicLink() ? fs.readlinkSync(target) : 'directory';
    const r = f.run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Left unchanged: .*skill-selector/);
    assert.equal(fs.lstatSync(target).isSymbolicLink() ? fs.readlinkSync(target) : 'directory', before);
    assert.equal(fs.existsSync(f.target('engineering-router')), false);
    assert.equal(f.calls(), '');
  });
}
