#!/usr/bin/env node
// Prints the router's repo root (the checkout holding catalog/) and how it was found, plus
// `skill: <root>/skills/<name>/SKILL.md` when that file exists outside this folder, <name> being
// the `name:` of the SKILL.md beside this file (engineering-router or skill-selector; each skill
// ships an identical copy). Run as `node <skill-dir>/resolve-root.js`. Reads only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const piAgentDir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi/agent');
const piRepo = path.join(piAgentDir, 'git/github.com/marcoax/engineering-skills-router');
const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share');
const dataDir = path.join(dataHome, 'engineering-skills-router');
// This skill's own name, so either installed skill hands over to its own checkout copy.
const ownSkill = path.join(__dirname, 'SKILL.md');
const skillName = (fs.existsSync(ownSkill) && fs.readFileSync(ownSkill, 'utf8').match(/^---\r?\n[\s\S]*?^name:\s*([\w.-]+)\s*$/m)?.[1])
  || path.basename(fs.realpathSync(__dirname));
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
    // A copy outside the checkout defers to the checkout's own skill, so the two never drift.
    const skill = path.resolve(dir, 'skills', skillName, 'SKILL.md');
    if (fs.existsSync(skill) && fs.realpathSync(skill) !== fs.realpathSync(ownSkill)) {
      process.stdout.write(`skill: ${skill}\n`);
    }
    process.exit(0);
  }
}
process.stdout.write(`missing\ndata-dir: ${dataDir}\n`);
process.exit(2);
