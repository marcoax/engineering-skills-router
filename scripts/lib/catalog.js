// Shared loader for catalog/*.yaml, config/preferences.yaml and a target repo's
// docs/agents/skills.yaml. Node stdlib + yaml.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '../..');

// Ruby-style Array(): null -> [], scalar -> [scalar], array -> array.
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const isFile = (p) => {
  try { return fs.statSync(p).isFile(); } catch { return false; }
};

// uniqueKeys: false so duplicate skill ids reach validate-catalog's own check instead of throwing.
const readYaml = (file) => (isFile(file) ? (YAML.parse(fs.readFileSync(file, 'utf8'), { uniqueKeys: false }) || {}) : {});
const read = (rel) => readYaml(path.join(ROOT, rel));

const sources = () => read('catalog/sources.yaml').sources || {};
const PROJECT_CATALOG = 'docs/agents/skills.yaml';
// v1: project skills fill only these phases.
const PROJECT_PHASES = ['framework-review'];

// The target repo's own skills, with source 'project' and the path resolved against the target.
// A path that is absolute or leads outside the target is flagged `outside` and never available.
function projectSkills(target) {
  if (!target) return {};
  return Object.fromEntries(Object.entries(readYaml(path.join(target, PROJECT_CATALOG)).skills || {})
    .map(([id, s]) => {
      const declaredPath = String(s?.path ?? '');
      const resolved = path.resolve(target, declaredPath);
      const rel = path.relative(target, resolved);
      const outside = path.isAbsolute(declaredPath) || rel === '..' || rel.startsWith(`..${path.sep}`);
      return [id, { ...s, source: 'project', path: resolved, declaredPath, outside }];
    }));
}

// Catalog skills, plus the target repo's project/ skills when a target is given. Other ids in
// the project catalog are ignored here (validate-catalog --target reports them).
const skills = (target) => ({
  ...(read('catalog/skills.yaml').skills || {}),
  ...Object.fromEntries(Object.entries(projectSkills(target)).filter(([id]) => id.startsWith('project/'))),
});
const categories = () => read('catalog/categories.yaml').categories || {};
const rankings = () => read('catalog/rankings.yaml').rankings || {};
const preferences = () => read('config/preferences.yaml').preferences || {};

// Catalog paths are relative to ROOT; project paths are already absolute.
const available = (skill) => !!skill && !skill.outside && isFile(path.resolve(ROOT, String(skill.path ?? '')));

// Takes `--target <path>` out of a script's argv. Exits when the path is not a directory.
function targetArg(argv) {
  const i = argv.indexOf('--target');
  if (i === -1) return { target: undefined, args: argv };
  const target = argv[i + 1] && path.resolve(argv[i + 1]);
  if (!target || !fs.statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`--target: not a directory: ${argv[i + 1] ?? '(none)'}`);
    process.exit(1);
  }
  return { target, args: argv.filter((_, j) => j !== i && j !== i + 1) };
}

// Repo-relative SKILL.md paths currently present upstream for one source.
function upstreamPaths(source) {
  return arr(source.skill_globs)
    .flatMap((glob) => fs.globSync(glob, { cwd: path.join(ROOT, String(source.local_path ?? '')) })
      .map((p) => path.join(source.local_path, p)))
    .sort();
}

// Ordered candidates for a phase: user preference, catalog preferred, fallback, then any other
// cataloged skill tagged with the phase. A project phase lists only the target's project skills,
// and no other phase lists them.
function candidates(category, allSkills = skills(), allRankings = rankings(), prefs = preferences()) {
  const rank = allRankings[category] || {};
  const pref = (prefs[category] || {}).prefer;
  const tagged = Object.keys(allSkills).filter((id) => arr(allSkills[id].categories).includes(category));
  const isProject = (id) => allSkills[id]?.source === 'project';
  const ordered = PROJECT_PHASES.includes(category)
    ? tagged.filter(isProject).map((id) => [id, 'project'])
    : [['preference', pref], ['preferred', rank.preferred], ['fallback', rank.fallback], ['other', tagged]]
      .flatMap(([origin, ids]) => arr(ids).map((id) => [id, origin]))
      .filter(([id]) => !isProject(id));
  const excluded = arr(prefs.exclude);
  const seen = new Set();
  return ordered
    .filter(([id]) => !seen.has(id) && seen.add(id))
    .map(([id, origin]) => {
      const skill = allSkills[id];
      const status = !skill ? 'unknown'
        : excluded.includes(id) ? 'excluded'
        : !available(skill) ? 'missing'
        : 'ok';
      return { id, origin, status, skill };
    });
}

module.exports = {
  ROOT, PROJECT_CATALOG, PROJECT_PHASES, arr, sources, skills, projectSkills, categories, rankings, preferences,
  available, targetArg, upstreamPaths, candidates,
};
