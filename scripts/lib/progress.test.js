const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkout, recordCheck, recovery } = require('./progress');
const gitEnv = require('./git-env')();

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'router-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8', env: gitEnv });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(root, 'run.sh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'source.txt'), 'deleted');
  git('add', '.');
  git('commit', '-qm', 'base');
  const record = (command, scope) => recordCheck({
    task: 'sample', status: 'running', handoff: { branch: 'main' },
    steps: [{ id: 'implementation', status: 'running', model: 'same', progress: null }],
  }, 'implementation', { result: 'pass', command, scope, environment: 'same environment' }, checkout(root), '2026-11-05T00:00:00Z');
  const plan = (state) => recovery(state, checkout(root), 'same environment').join('\n');
  const execute = (command, args = []) => spawnSync(command, args, { cwd: root });
  return { root, git, record, plan, execute };
}

test('an unchanged file reuses a check; changing executable bits invalidates it', { skip: process.platform === 'win32' }, (t) => {
  const f = fixture(t);
  assert.equal(f.execute('./run.sh').status, 0);
  const state = f.record('./run.sh', ['run.sh']);
  assert.match(f.plan(state), /reuse: \.\/run.sh .*: pass/);
  fs.chmodSync(path.join(f.root, 'run.sh'), 0o644);
  assert.equal(f.execute('./run.sh').error.code, 'EACCES');
  assert.match(f.plan(state), /rerun: \.\/run.sh .*: its files changed since/);
});

test('deleting a file containing the old missing-file marker invalidates its check', (t) => {
  const f = fixture(t);
  assert.equal(f.execute('test', ['-f', 'source.txt']).status, 0);
  const state = f.record('test -f source.txt', ['source.txt']);
  assert.match(f.plan(state), /reuse: test -f source.txt .*: pass/);
  fs.unlinkSync(path.join(f.root, 'source.txt'));
  assert.equal(f.execute('test', ['-f', 'source.txt']).status, 1);
  assert.match(f.plan(state), /rerun: test -f source.txt .*: its files changed since/);
});

test('committing a tested deletion reuses checks, while restoring the file invalidates them', (t) => {
  const f = fixture(t);
  fs.unlinkSync(path.join(f.root, 'source.txt'));
  assert.equal(f.execute('test', ['!', '-e', 'source.txt']).status, 0);
  const states = [['source.txt'], ['.']].map((scope) => f.record('test ! -e source.txt', scope));
  f.git('add', '-u');
  f.git('commit', '-qm', 'remove unused source');
  for (const state of states) assert.match(f.plan(state), /reuse: test ! -e source.txt .*: pass/);
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'restored');
  assert.equal(f.execute('test', ['!', '-e', 'source.txt']).status, 1);
  for (const state of states) assert.match(f.plan(state), /rerun: test ! -e source.txt .*: its files changed since/);
});

test('a scoped submodule is unprovable, while checks outside it remain reusable', (t) => {
  const f = fixture(t);
  const child = fixture(t);
  fs.mkdirSync(path.join(child.root, 'src'));
  fs.writeFileSync(path.join(child.root, 'src/run.sh'), '#!/bin/sh\nexit 0\n');
  child.git('add', 'src');
  child.git('commit', '-qm', 'nested source');
  f.git('-c', 'protocol.file.allow=always', 'submodule', 'add', child.root, 'lib');
  f.git('commit', '-qam', 'submodule');
  assert.equal(f.execute('sh', ['lib/run.sh']).status, 0);
  const state = f.record('sh lib/run.sh', ['lib']);
  assert.equal(state.steps[0].progress.checks[0].content, null);
  assert.match(f.plan(state), /rerun: sh lib\/run.sh/);
  const nested = [
    { command: 'sh lib/run.sh', scope: ['lib/run.sh'] },
    { command: 'sh lib/src/run.sh', scope: ['lib/src'] },
    { command: 'sh lib/src/run.sh', scope: ['source.txt', 'lib/src/run.sh'] },
    { command: 'sh lib/run.sh', scope: ['./lib/src/../run.sh'] },
  ].map(({ command, scope }) => {
    const recorded = f.record(command, scope);
    assert.equal(recorded.steps[0].progress.checks[0].content, null, scope.join(', '));
    return recorded;
  });
  const outside = f.record('test -f source.txt', ['source.txt']);
  fs.writeFileSync(path.join(f.root, 'lib/run.sh'), '#!/bin/sh\nexit 1\n');
  fs.writeFileSync(path.join(f.root, 'lib/src/run.sh'), '#!/bin/sh\nexit 1\n');
  assert.equal(f.execute('sh', ['lib/run.sh']).status, 1);
  assert.equal(f.execute('sh', ['lib/src/run.sh']).status, 1);
  assert.match(f.plan(state), /rerun: sh lib\/run.sh/);
  assert.doesNotMatch(f.plan(state), /reuse:/);
  for (const recorded of nested) {
    assert.match(f.plan(recorded), /rerun:/);
    assert.doesNotMatch(f.plan(recorded), /reuse:/);
  }
  assert.match(f.plan(outside), /reuse: test -f source.txt .*: pass/);
  assert.equal(checkout(f.root).content(['.']), null);
});

test('a scoped symbolic link is unprovable rather than treated as a regular file', (t) => {
  const f = fixture(t);
  fs.symlinkSync('source.txt', path.join(f.root, 'link'));
  const state = f.record('test -f link', ['link']);
  assert.equal(state.steps[0].progress.checks[0].content, null);
  assert.match(f.plan(state), /rerun: test -f link/);
});
