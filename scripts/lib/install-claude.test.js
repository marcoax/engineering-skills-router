const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('Claude installer links safely, repeats, supports skills only and stops on conflicts', () => {
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'router-install-')));
  try {
    const root = path.join(tmp, 'checkout with spaces');
    const config = path.join(tmp, 'claude config');
    const log = path.join(tmp, 'calls');
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'bin'));
    for (const name of ['engineering-router', 'skill-selector']) {
      fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
    }
    fs.copyFileSync(path.join(__dirname, '../install-claude'), path.join(root, 'scripts/install-claude'));
    for (const file of [path.join(root, 'scripts/setup'), path.join(tmp, 'bin/claude')]) {
      fs.writeFileSync(file, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$INSTALL_TEST_LOG"\n', { mode: 0o755 });
    }
    const run = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/install-claude'), ...args], {
      encoding: 'utf8', env: { ...process.env, HOME: tmp, CLAUDE_CONFIG_DIR: config,
        PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`, INSTALL_TEST_LOG: log },
    });
    assert.equal(run('--help').status, 0);
    assert.equal(run('--unknown').status, 1);
    assert.equal(fs.existsSync(log), false);
    assert.equal(run().status, 0);
    for (const name of ['engineering-router', 'skill-selector']) {
      assert.equal(fs.readlinkSync(path.join(config, 'skills', name)), path.join(root, 'skills', name));
    }
    assert.match(fs.readFileSync(log, 'utf8'), /plugin marketplace add .*checkout with spaces/);
    assert.equal(run().status, 0);
    fs.writeFileSync(log, '');
    assert.equal(run('--no-panel').status, 0);
    assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /plugin|--version/);
    const target = path.join(config, 'skills/skill-selector');
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(tmp, 'missing'), target);
    fs.writeFileSync(log, '');
    assert.equal(run().status, 1);
    assert.equal(fs.readlinkSync(target), path.join(tmp, 'missing'));
    assert.equal(fs.readFileSync(log, 'utf8'), '');
    fs.unlinkSync(target);
    fs.mkdirSync(target);
    assert.equal(run().status, 1);
    assert.equal(fs.statSync(target).isDirectory(), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
