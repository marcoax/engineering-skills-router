// Decided phases (ADR 0005): a phase whose skill is known before selection, so no guide is
// consulted and no candidate is read for it. The first that holds decides:
//   preference   the first `ok` skill the user prefers for the phase (preferences.yaml)
//   project      the first `ok` skill the target declares for it (docs/agents/skills.yaml)
//   remembered   the skill of the target's last run whose step for the phase reached `done`
// A skill the user names in the request comes before all three; only the selector knows it, and
// marks that default `"explicit": true`. A `cost: high` skill never decides a phase: its cost is
// stated by a selection. Reads only.
const fs = require('node:fs');
const path = require('node:path');
const Catalog = require('./catalog');
const { UNFINISHED } = require('./state-ops');
const { RUNS_DIR } = require('./run-files');

const STATE_FILE = '.router/state.json';
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};

// The reviewed vendor revisions (catalog/reviewed.yaml) as a run records them at composition.
const reviewed = () => Object.entries(Catalog.readYaml(path.join(Catalog.ROOT, 'catalog/reviewed.yaml')).reviewed || {})
  .map(([source, revision]) => ({ source, revision: String(revision) }));

// The target's runs a remembered selection may come from, newest first: its archived runs and a
// finished run not archived yet (the next `compose --new` archives it as it is). Left out:
// `legacy-*` archives and states without a run id, discarded runs (marked `discarded`, or archived
// unfinished, which only a discard does) and unreadable states.
function runs(target) {
  if (!target) return [];
  const dir = path.join(target, RUNS_DIR);
  const archived = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => !name.startsWith('legacy-')).map((name) => readJson(path.join(dir, name, 'state.json')))
    : [];
  const current = readJson(path.join(target, STATE_FILE));
  return [...archived, ...(current?.status === 'done' ? [current] : [])]
    .filter((s) => isObj(s) && typeof s.run === 'string' && !s.run.startsWith('legacy-') && Array.isArray(s.steps)
      && s.discarded !== true && !UNFINISHED.includes(s.status))
    .sort((a, b) => (a.run < b.run ? 1 : a.run > b.run ? -1 : 0));
}

// The last run whose step for `phase` reached `done` with a skill, a swapped-in one included:
// { run, state, step }, or null. A run whose step was skipped or left pending is passed over.
function lastDone(phase, history) {
  for (const state of history) {
    const step = state.steps.find((s) => isObj(s) && Catalog.arr(s.phases).includes(phase) && s.status === 'done' && typeof s.skill === 'string');
    if (step) return { run: state.run, state, step };
  }
  return null;
}

// The picks the remembered run knew for the step: the skill that ran, its alternatives and, for
// a covered step, the selector's own pick and alternatives.
const known = (step) => [
  { skill: step.skill },
  ...Catalog.arr(step.alternatives),
  ...(isObj(step.selected) ? [{ skill: step.selected.skill, reason: step.selected.reason }, ...Catalog.arr(step.selected.alternatives)] : []),
].filter((p) => typeof p?.skill === 'string');

// Why the remembered selection `last` no longer holds for `phase`, or null while it does. It does
// not expire by age, nor by the task's type or risk.
function expiry(last, list, skills, revisions) {
  const { step, state } = last;
  if (list.find((c) => c.id === step.skill)?.status !== 'ok') return `no longer ok for the phase`;
  const source = skills[step.skill]?.source;
  const now = revisions.find((r) => r.source === source)?.revision;
  if (now !== undefined) {
    const then = Catalog.arr(state.reviewed).find((r) => r?.source === source)?.revision;
    if (then !== now) return `${source} was reviewed at another revision since`;
  }
  const seen = new Set(known(step).map((p) => p.skill));
  const fresh = list.filter((c) => c.status === 'ok' && !seen.has(c.id)).map((c) => c.id);
  return fresh.length ? `the run did not consider ${fresh.join(', ')}` : null;
}

// How `phase` stands before selection:
//   { skill, origin, path, alternatives: [{ skill, reason }] }   decided
//   { expired: { skill, run, why } }                              a remembered selection expired
//   {}                                                            open
// `origin` is `preference`, `project` or `remembered · <run>`: the decided step's reason.
// Alternatives need no reading either: the other explicit choices, then the last run's own picks.
function decide(phase, { target, skills = Catalog.skills(target), prefs = Catalog.preferences(), history = runs(target), revisions = reviewed() } = {}) {
  const list = Catalog.candidates(phase, skills, prefs);
  const usable = list.filter((c) => c.status === 'ok' && c.skill.cost !== 'high');
  const explicit = usable.filter((c) => c.origin === 'preference' || c.origin === 'project');
  const last = lastDone(phase, history);
  let decided = explicit[0] && { skill: explicit[0].id, origin: explicit[0].origin };
  let expired;
  // A state written before runs recorded the reviewed revisions yields no remembered selection.
  if (!decided && last && Array.isArray(last.state.reviewed) && skills[last.step.skill]?.cost !== 'high') {
    const why = expiry(last, list, skills, revisions);
    if (why) expired = { skill: last.step.skill, run: last.run, why };
    else decided = { skill: last.step.skill, origin: `remembered · ${last.run}` };
  }
  if (!decided) return expired ? { expired } : {};
  const pool = [
    ...explicit.slice(1).map((c) => ({ skill: c.id, reason: c.origin })),
    ...(last ? known(last.step).map((p) => ({ skill: p.skill, reason: p.reason || `selected in ${last.run}` })) : []),
  ];
  const seen = new Set([decided.skill]);
  const alternatives = pool
    .filter((p) => list.find((c) => c.id === p.skill)?.status === 'ok' && !Catalog.costProblem(p.skill, p.reason, skills))
    .filter((p) => !seen.has(p.skill) && seen.add(p.skill))
    .slice(0, 2);
  return { ...decided, path: skills[decided.skill].path, alternatives };
}

module.exports = { decide, runs, reviewed, STATE_FILE };
