#!/usr/bin/env node
// Prints the router's repo root (the checkout holding catalog/) and how it was found.
// Run as `node <skill-dir>/resolve-root.js`. Reads only; never writes anything.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const piAgentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi/agent');
const piRepo = path.join(piAgentDir, 'git/github.com/marcoax/engineering-skills-router');
const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share');
const dataDir = path.join(dataHome, 'engineering-skills-router');
const candidates = [
  ['skill-dir', path.resolve(fs.realpathSync(__dirname), '../..')],
  ['env', process.env.ENGINEERING_ROUTER_HOME],
  ['pi', piRepo],
  ['data-dir', dataDir],
];

for (const [how, dir] of candidates) {
  if (dir && fs.existsSync(path.join(dir, 'catalog/skills.yaml'))) {
    // Pi owns this checkout even when the skill or an env override finds it first.
    const found = fs.existsSync(piRepo) && fs.realpathSync(dir) === fs.realpathSync(piRepo) ? 'pi' : how;
    process.stdout.write(`root: ${path.resolve(dir)}\nfound: ${found}\n`);
    process.exit(0);
  }
}
process.stdout.write(`missing\ndata-dir: ${dataDir}\n`);
process.exit(2);
