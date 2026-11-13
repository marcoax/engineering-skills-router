// Shared loader for catalog/*.yaml, the user configuration (preferences.yaml, personal-skills.yaml)
// and a target repo's docs/agents/skills.yaml. Node stdlib + yaml.
const fs = require('node:fs');
const os = require('node:os');
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

const isDir = (p) => !!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory();
const expandHome = (p) => p.replace(/^~(?=$|\/)/, os.homedir());

const sources = () => read('catalog/sources.yaml').sources || {};
const PROJECT_CATALOG = 'docs/agents/skills.yaml';

// User configuration (docs/configuration.md). One directory holds both files; the first that applies:
//   explicit     $ENGINEERING_ROUTER_CONFIG, whatever it holds (empty = defaults)
//   external     $XDG_CONFIG_HOME/engineering-skills-router (~/.config/...) when it holds either file
//   clone-local  config/ in this checkout when it holds either file (a package update may clean it)
//   defaults     none of these; new configuration belongs in the external directory
// Files are never merged across directories: clone-local files a higher source hides are `shadowed`.
const CONFIG_ENV = 'ENGINEERING_ROUTER_CONFIG';
const CONFIG_FILES = ['preferences.yaml', 'personal-skills.yaml'];
const CLONE_CONFIG = path.join(ROOT, 'config');
const externalConfigDir = (env = process.env) =>
  path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'engineering-skills-router');
const configFilesIn = (dir) => CONFIG_FILES.map((f) => path.join(dir, f)).filter(isFile);

function config(env = process.env) {
  const external = externalConfigDir(env);
  const explicit = env[CONFIG_ENV];
  const problems = [];
  let source;
  let dir;
  if (explicit) {
    source = 'explicit';
    dir = path.resolve(expandHome(explicit));
    if (!isDir(dir)) problems.push(`${CONFIG_ENV}: not a directory: ${explicit}`);
  } else if (configFilesIn(external).length > 0) [source, dir] = ['external', external];
  else if (configFilesIn(CLONE_CONFIG).length > 0) [source, dir] = ['clone-local', CLONE_CONFIG];
  else [source, dir] = ['defaults', external];
  const isClone = path.resolve(dir) === CLONE_CONFIG;
  return {
    source, dir, external, problems,
    preferencesFile: path.join(dir, CONFIG_FILES[0]),
    personalFile: path.join(dir, CONFIG_FILES[1]),
    // A relative personal_path keeps its meaning: the checkout for clone-local files, else their directory.
    base: isClone ? ROOT : dir,
    shadowed: isClone ? [] : configFilesIn(CLONE_CONFIG),
  };
}

// How messages name a file: relative inside the checkout, absolute elsewhere.
const label = (file) => {
  const rel = path.relative(ROOT, file);
  return rel.startsWith('..') || path.isAbsolute(rel) ? file : rel;
};

// What makes the configuration files in effect unreadable: malformed YAML, or no top-level
// `preferences:` / `skills:` mapping. A missing file is the defaults; a broken one is never read as absent.
function configErrors(cfg = config()) {
  const errors = [];
  const isMap = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
  for (const [file, key] of [[cfg.preferencesFile, 'preferences'], [cfg.personalFile, 'skills']]) {
    if (!isFile(file)) continue;
    let doc;
    try { doc = readYaml(file); } catch (e) {
      errors.push(`${label(file)}: malformed YAML: ${e.message.split('\n')[0]}`);
      continue;
    }
    if (!isMap(doc) || (Object.hasOwn(doc, key) ? doc[key] != null && !isMap(doc[key]) : true))
      errors.push(`${label(file)}: expected a top-level '${key}:' mapping`);
  }
  return errors;
}

// For the scripts that act on the configuration: exits 1 naming every problem with it, so a
// broken configuration is never mistaken for an absent one.
function requireConfig(cfg = config()) {
  const errors = [...cfg.problems, ...configErrors(cfg)];
  if (errors.length === 0) return cfg;
  errors.forEach((e) => console.error(`error: ${e}`));
  console.error('The user configuration in effect cannot be read: fix it (scripts/config shows where, scripts/validate-catalog checks it).');
  process.exit(1);
}
// The phases of the router's default flow (skills/engineering-router/SKILL.md §2) a selection must
// decide on. issue-tracking is left out: only a skill selected for another phase fills it.
const DEFAULT_FLOW = ['requirements', 'specification', 'planning', 'implementation', 'review', 'framework-review',
  'security', 'independent-review', 'pull-request'];
// Phases only project skills fill.
const PROJECT_PHASES = ['framework-review'];

const categories = () => read('catalog/categories.yaml').categories || {};
const preferences = (cfg = config()) => readYaml(cfg.preferencesFile).preferences || {};
const vendorSkills = () => read('catalog/skills.yaml').skills || {};
// Vendor guides (catalog/guides.yaml): advisory entry points, kept apart from executable skills.
const guides = () => read('catalog/guides.yaml').guides || {};

// Whether a ROOT-relative path lies inside the vendor checkout of `source`.
function ownedBy(filePath, source) {
  const rel = path.relative(path.resolve(ROOT, String(source?.local_path ?? '')), path.resolve(ROOT, String(filePath ?? '')));
  return !!source && rel !== '' && !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`);
}

// Skills listed in `file` with paths relative to `root`, tagged with `source` and resolved.
// A path that is absolute or leads outside the root is flagged `outside` and never available.
const rootedSkills = (file, root, source) => Object.fromEntries(Object.entries(readYaml(file).skills || {})
  .map(([id, s]) => {
    const declaredPath = String(s?.path ?? '');
    const resolved = path.resolve(root, declaredPath);
    const rel = path.relative(root, resolved);
    const outside = path.isAbsolute(declaredPath) || rel === '..' || rel.startsWith(`..${path.sep}`);
    return [id, { ...s, source, path: resolved, declaredPath, outside }];
  }));

// The target repo's own skills, with source 'project' and paths resolved against the target.
const projectSkills = (target) => (target ? rootedSkills(path.join(target, PROJECT_CATALOG), target, 'project') : {});

// preferences.personal_path with a leading ~ expanded; a relative path resolves against the
// configuration's base (config().base).
function personalPath(prefs = preferences(), base = config().base) {
  const p = prefs.personal_path;
  return typeof p === 'string' && p !== '' ? path.resolve(base, expandHome(p)) : undefined;
}

// The user's own skills, with source 'personal' and paths resolved against `root`, personal_path
// by default. Needs personal_path; the scripts only read from it.
const personalSkills = (root = personalPath(), file = config().personalFile) => (root ? rootedSkills(file, root, 'personal') : {});

// The cataloged vendor skill sharing a personal id's name (personal/tdd -> mattpocock/tdd), if any.
const namesake = (id, vendor = vendorSkills()) => Object.keys(vendor).find((v) => v.split('/')[1] === id.split('/')[1]);

// Vendor skills, plus personal/ skills and, with a target, the target repo's project/ skills.
// Other ids, and personal skills with a vendor namesake, are left out (validate-catalog reports them).
function skills(target) {
  const vendor = vendorSkills();
  return {
    ...vendor,
    ...Object.fromEntries(Object.entries(personalSkills())
      .filter(([id]) => id.startsWith('personal/') && !namesake(id, vendor))),
    ...Object.fromEntries(Object.entries(projectSkills(target)).filter(([id]) => id.startsWith('project/'))),
  };
}

// Catalog paths are relative to ROOT; personal and project paths are already absolute.
const available = (skill) => !!skill && !skill.outside && isFile(path.resolve(ROOT, String(skill.path ?? '')));

// The skill's own description, read from its SKILL.md frontmatter at the checked-out revision.
// Only YAML parsing and whitespace normalization touch the text; there is no catalog copy.
// Returns { text } or { error } naming why none could be read.
function description(skill) {
  if (!available(skill)) return { error: 'skill file not found' };
  const source = fs.readFileSync(path.resolve(ROOT, String(skill.path)), 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { error: 'no frontmatter' };
  let front;
  try { front = YAML.parse(match[1]); } catch (e) { return { error: `malformed frontmatter: ${e.message.split('\n')[0]}` }; }
  const text = front?.description;
  if (text == null || (typeof text === 'string' && text.trim() === '')) return { error: 'missing description' };
  if (typeof text !== 'string') return { error: 'description is not text' };
  return { text: text.replace(/\s+/g, ' ').trim() };
}

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

const status = (skill, id, excluded) => (!skill ? 'unknown'
  : excluded.includes(id) ? 'excluded'
  : !available(skill) ? 'missing'
  : 'ok');

// Candidates for a phase on equal standing: explicit user preferences first, then the target's
// project skills, then every other tagged skill (personal or vendor) sorted by skill name so
// neither vendor nor catalog order shows; the order is not a ranking. Origins:
// preference | project | personal | vendor. A project phase lists only project skills.
function candidates(category, allSkills = skills(), prefs = preferences()) {
  const tagged = Object.keys(allSkills).filter((id) => arr(allSkills[id].categories).includes(category));
  const sourceOf = (id) => allSkills[id]?.source;
  const byName = (a, b) => a.split('/')[1].localeCompare(b.split('/')[1]) || a.localeCompare(b);
  const ordered = PROJECT_PHASES.includes(category)
    ? tagged.filter((id) => sourceOf(id) === 'project').map((id) => [id, 'project'])
    : [
      ...arr((prefs[category] || {}).prefer).filter((id) => sourceOf(id) !== 'project').map((id) => [id, 'preference']),
      ...tagged.filter((id) => sourceOf(id) === 'project').map((id) => [id, 'project']),
      ...tagged.filter((id) => sourceOf(id) !== 'project').sort(byName)
        .map((id) => [id, sourceOf(id) === 'personal' ? 'personal' : 'vendor']),
    ];
  const excluded = arr(prefs.exclude);
  const seen = new Set();
  return ordered
    .filter(([id]) => !seen.has(id) && seen.add(id))
    .map(([id, origin]) => ({ id, origin, status: status(allSkills[id], id, excluded), skill: allSkills[id] }));
}

// Why `id` cannot be picked for a step filling `phases` (it must be an `ok` candidate of one of
// them), or null when it can: { message, replaceable }. `replaceable` problems (unknown, excluded,
// missing) leave the step needing another pick or a missing capability; the others are misplacements.
function pickProblem(id, phases, allSkills = skills(), prefs = preferences()) {
  if (Object.hasOwn(guides(), id)) return { message: 'a guide, not an executable skill', replaceable: false };
  if (!Object.hasOwn(allSkills, id)) return { message: 'unknown skill', replaceable: true };
  const candidate = phases.flatMap((p) => candidates(p, allSkills, prefs)).find((c) => c.id === id);
  if (!candidate) return { message: `not a candidate for ${phases.join(', ') || 'a step without phases'}`, replaceable: false };
  return candidate.status === 'ok' ? null : { message: candidate.status, replaceable: true };
}

// Harness capabilities a skill may list under `requires`; a selection states which it has.
// Other `requires` values (tracker-config) are target-repo prerequisites, met by the workflow.
const HARNESS_CAPABILITIES = ['subagents', 'isolated-outputs'];
// One-word `requires` values the router acts on; anything else is a prose prerequisite.
const REQUIRES_TOKENS = ['tracker-config', ...HARNESS_CAPABILITIES];
// The opening a pick's reason needs when the skill's catalog `cost` is high (selector §6).
const HIGH_COST = /^high cost\b/i;

// Why a pick of `id` with `reason` breaks the cost rule, or null: a `cost: high` skill always
// shows its cost first, wherever it is proposed or selected.
const costProblem = (id, reason, allSkills = skills()) =>
  (allSkills[id]?.cost === 'high' && !HIGH_COST.test(String(reason ?? '').trim())
    ? 'high cost: its reason must start with "High cost"' : null);

// Why `id` cannot run on a harness with `capabilities` (a list, or undefined when not stated), or null.
function capabilityProblem(id, capabilities, allSkills = skills()) {
  const needed = arr(allSkills[id]?.requires).filter((r) => HARNESS_CAPABILITIES.includes(r));
  if (needed.length === 0) return null;
  if (capabilities === undefined) return `requires ${needed.join(', ')}: the selection states no capabilities`;
  const lacking = needed.filter((r) => !capabilities.includes(r));
  return lacking.length ? `requires ${lacking.join(', ')}, which the harness lacks` : null;
}

module.exports = {
  HARNESS_CAPABILITIES, REQUIRES_TOKENS, costProblem, capabilityProblem,
  ROOT, PROJECT_CATALOG, PROJECT_PHASES, DEFAULT_FLOW, CONFIG_ENV, CONFIG_FILES, CLONE_CONFIG, config, configErrors, requireConfig, label, readYaml, arr, sources, skills, vendorSkills, guides, ownedBy, projectSkills,
  personalPath, personalSkills, namesake, categories, preferences, available, description, targetArg, upstreamPaths, candidates, pickProblem,
};
