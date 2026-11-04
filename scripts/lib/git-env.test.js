const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const gitEnv = require('./git-env');

test('isolating a repository preserves the Git runtime helper path used by Desktop', () => {
  const execPath = path.join(os.tmpdir(), 'router git helpers');
  const env = gitEnv({ ...process.env, GIT_EXEC_PATH: execPath,
    GIT_DIR: '/not/the/target/repo', GIT_WORK_TREE: '/not/the/target/worktree',
    GIT_INDEX_FILE: '/not/the/target/index' });
  const result = spawnSync('git', ['--exec-path'], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), execPath);
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) assert.equal(env[key], undefined);
});
