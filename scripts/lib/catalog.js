// Shared loader for catalog/*.yaml and config/preferences.yaml. Node stdlib + yaml.
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
function read(rel) {
  const file = path.join(ROOT, rel);
  return isFile(file) ? (YAML.parse(fs.readFileSync(file, 'utf8'), { uniqueKeys: false }) || {}) : {};
}

const sources = () => read('catalog/sources.yaml').sources || {};
const skills = () => read('catalog/skills.yaml').skills || {};
const categories = () => read('catalog/categories.yaml').categories || {};
const rankings = () => read('catalog/rankings.yaml').rankings || {};
const preferences = () => read('config/preferences.yaml').preferences || {};

const available = (skill) => !!skill && isFile(path.join(ROOT, String(skill.path ?? '')));

// Repo-relative SKILL.md paths currently present upstream for one source.
function upstreamPaths(source) {
  return arr(source.skill_globs)
    .flatMap((glob) => fs.globSync(glob, { cwd: path.join(ROOT, String(source.local_path ?? '')) })
      .map((p) => path.join(source.local_path, p)))
    .sort();
}

// Ordered candidates for a phase: user preference, catalog preferred, fallback,
// then any other cataloged skill tagged with the phase.
function candidates(category, allSkills = skills(), allRankings = rankings(), prefs = preferences()) {
  const rank = allRankings[category] || {};
  const pref = (prefs[category] || {}).prefer;
  const ordered = [['preference', pref], ['preferred', rank.preferred], ['fallback', rank.fallback]]
    .flatMap(([origin, ids]) => arr(ids).map((id) => [id, origin]));
  const others = Object.keys(allSkills)
    .filter((id) => arr(allSkills[id].categories).includes(category))
    .map((id) => [id, 'other']);
  const excluded = arr(prefs.exclude);
  const seen = new Set();
  return [...ordered, ...others]
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

module.exports = { ROOT, arr, sources, skills, categories, rankings, preferences, available, upstreamPaths, candidates };
