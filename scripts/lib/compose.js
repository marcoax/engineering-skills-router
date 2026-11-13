// The workflow's steps, built from the checked classification and selection (SKILL.md §2, §4),
// and the workflow as SKILL.md §5 shows it. scripts/state compose checks the inputs with
// check-classification and check-selection, then builds, validates and writes the state; show
// prints the same presentation. Pure, apart from what the catalog says about the skills.
const Catalog = require('./catalog');
const models = require('./models');
const { LETTERS, OFF } = require('./state-ops');

// The default flow's order (SKILL.md §2), with the changes by type: debugging and code-understanding
// come before requirements and the specification, multi-session replaces the whole flow. Phases the flow
// does not name run with the build, before the reviews.
const FRONT = ['setup', 'debugging', 'code-understanding', 'discovery', 'research', 'multi-session', 'requirements',
  'clarification', 'prototype', 'architecture', 'specification', 'planning'];
const BUILD = ['implementation', 'refactoring', 'performance', 'testing', 'documentation'];
// The checks after the build: the full path's order, and light.md's.
const CHECKS = {
  full: ['review', 'framework-review', 'security', 'independent-review'],
  light: ['review', 'security', 'framework-review'],
};
const END = ['pull-request', 'release'];
// Steps the user switches on during selection; they start off.
const OPTIONAL = ['independent-review', 'verification'];
const TRACKER_FILE = 'docs/agents/issue-tracker.md';

// Each phase's place in the workflow; `branch` and `verification` are the router's steps.
function order(path, type, phases) {
  const front = [...FRONT];
  const build = [...BUILD];
  // A refactor is implemented via refactoring or architecture (§2): refactoring has its place in the
  // build, and architecture moves there only when neither implementation nor refactoring is selected.
  if (type === 'refactor' && !phases.some((p) => ['implementation', 'refactoring'].includes(p))) build.unshift(...front.splice(front.indexOf('architecture'), 1));
  const checks = CHECKS[path] ?? CHECKS.full;
  return [...front, 'branch', ...build, '*', ...checks, ...(path === 'light' ? [] : ['verification']), ...END];
}

const strings = (v) => Catalog.arr(v).filter((x) => typeof x === 'string');
const note = (v) => (typeof v === 'string' && v.trim() ? v : null);
const routerStep = (id, reason, summary, extra = {}) => ({
  id, phases: [], skill: null, reason, summary, alternatives: [], confirm: false, optional: false,
  covered_by: null, model: null, effort: null, status: 'pending', outcome: null, ...extra,
});
const off = (step) => Object.assign(step, { optional: true, status: 'skipped', outcome: OFF });

// The router's steps (§2): the work branch, verification on the full path, and the pull request
// when no selected skill writes its body (that skill's step is the pull-request step then).
function routerSteps(path, issue, issueFree, steps) {
  const out = [routerStep('branch', 'the work branch, from the default branch',
    issue ? `Create ${issue.number}-<slug>` : issueFree ? 'Create <slug> (issue-free.md)' : 'Create <issue-number>-<slug> once the issue is published')];
  if (path !== 'light') out.push(off(routerStep('verification', 'agent-checkable points in the manual checklist', 'Work through the [agent] checklist points')));
  if (!steps.some((s) => s.id === 'pull-request')) out.push(routerStep('pull-request', 'the router opens the pull request', 'Open the pull request'));
  return out;
}

// The steps for a checked `selection` under the checked `classification` (type, path), for a target
// with or without tracker configuration. `issue` ({number, url} | null) when the task is an issue;
// `checkpoints` the step ids or phases the user asked to stop before. Returns
// { steps, errors, missing, issueFree }: `missing` adds the phases compose could not fill.
function build({ classification, selection, skills, trackerConfigured, issue = null, checkpoints = [] }) {
  const errors = [];
  const missing = [];
  const path = classification.path === 'light' ? 'light' : 'full';
  const selected = Catalog.arr(selection.phases);
  const rankOf = (() => {
    const list = order(path, classification.type, selected.map((p) => p.phase));
    return (p) => (list.includes(p) ? list.indexOf(p) : list.indexOf('*'));
  })();

  // One step per selected skill: a skill selected for two phases fills both in one step, at the
  // earlier one's place. issue-tracking gets no step of its own (§4).
  const groups = [];
  for (const p of [...selected].sort((a, b) => rankOf(a.phase) - rankOf(b.phase))) {
    if (p.phase === 'issue-tracking') continue;
    const group = groups.find((g) => g.skill === p.default.skill);
    if (group) group.entries.push(p);
    else groups.push({ skill: p.default.skill, entries: [p] });
  }
  for (const p of selected.filter((x) => x.phase === 'issue-tracking')) {
    const group = groups.find((g) => g.skill === p.default.skill);
    if (group) group.entries.push(p);
    else errors.push(`issue-tracking: ${p.default.skill}: gets no step of its own; only a skill selected for another phase fills it (SKILL.md §4)`);
  }
  // Multi-session replaces the whole flow: its output routes the later sessions, which implement (§2).
  const multi = groups.find((g) => g.entries.some((e) => e.phase === 'multi-session'));
  const later = multi ? groups.filter((g) => g !== multi && g.entries.some((e) => e.phase !== 'setup')) : [];
  if (later.length) {
    errors.push(`multi-session: implementation happens in later sessions from its output (SKILL.md §2): omit ${
      later.flatMap((g) => g.entries.map((e) => e.phase)).join(', ')} from this selection`);
  }
  const steps = groups.map(({ skill, entries }) => {
    const [first] = entries;
    const phases = entries.map((e) => e.phase);
    // A skill tagged issue-tracking fills it in its step (to-spec, to-tickets).
    if (Catalog.arr(skills[skill]?.categories).includes('issue-tracking') && !phases.includes('issue-tracking')) phases.push('issue-tracking');
    const seen = new Set([skill]);
    const alternatives = entries.flatMap((e) => Catalog.arr(e.alternatives))
      .filter((a) => !seen.has(a.skill) && seen.add(a.skill))
      .slice(0, 2)
      .map((a) => ({ skill: a.skill, reason: a.reason }));
    const joined = (key) => entries.map((e) => note(e[key])).filter(Boolean).join('; ') || null;
    const step = {
      id: first.phase, phases, skill, reason: first.default.reason, summary: first.reason, alternatives,
      prerequisites: [...new Set(entries.flatMap((e) => strings(e.prerequisites)))], cost: joined('cost'), tie: joined('tie'),
      confirm: false, optional: false, covered_by: null, model: null, effort: null, status: 'pending', outcome: null,
    };
    return OPTIONAL.includes(step.id) ? off(step) : step;
  });

  const fillsIssue = steps.some((s) => s.phases.includes('issue-tracking'));
  const issueFree = !issue && !fillsIssue;
  if (!multi) steps.push(...routerSteps(path, issue, issueFree, steps));

  // A selected skill that publishes to the tracker needs its configuration first (§4).
  const needing = steps.find((s) => s.skill && Catalog.arr(skills[s.skill]?.requires).includes('tracker-config'));
  if (needing && !trackerConfigured && !steps.some((s) => s.phases.includes('setup'))) {
    const usable = Catalog.candidates('setup', skills).filter((c) => c.status === 'ok' && c.skill.cost !== 'high');
    const source = needing.skill.split('/')[0];
    const setup = usable.find((c) => c.id.startsWith(`${source}/`)) ?? usable[0];
    if (setup) {
      steps.push({ ...routerStep('setup', `${needing.skill} requires tracker-config; the target has no ${TRACKER_FILE}`,
        `Configure the issue tracker ${needing.skill} publishes to`), phases: ['setup'], skill: setup.id });
    } else missing.push({ phase: 'setup', reason: `${needing.skill} requires tracker-config and no setup skill is usable` });
  }
  const rank = (s) => {
    const own = s.phases.filter((p) => p !== 'issue-tracking');
    return own.length ? Math.min(...own.map(rankOf)) : rankOf(s.id);
  };
  steps.sort((a, b) => rank(a) - rank(b));

  for (const c of checkpoints) {
    const step = steps.find((s) => s.id === c) ?? steps.find((s) => s.phases.includes(c));
    if (step) step.confirm = true;
    else errors.push(`checkpoint ${c}: no step or phase ${JSON.stringify(c)} in the workflow (${steps.map((s) => s.id).join(', ')})`);
  }
  return { steps, errors, missing, issueFree };
}

// The workflow as SKILL.md §5 shows it before `go`, and as `show` prints it later on: one entry per
// step with its alternatives and the selector's notes, the Models line, and the skipped and missing
// phases. A started workflow also shows each step's status and outcome.
function present(state, prefs) {
  const mark = { done: '✓', running: '▶', pending: '○', waiting: '⏸', skipped: '–', failed: '✗' };
  const started = state.status !== 'selecting';
  const lines = [`Task: ${state.task}`];
  const props = Catalog.arr(state.properties).join(', ') || 'none';
  lines.push(`Type: ${state.type}   Risk: ${state.risk}   Complexity: ${state.complexity ?? '-'}   Path: ${state.path ?? 'full'}   Properties: ${props}`);
  if (started) lines.push(`Status: ${state.status}`);
  lines.push('', 'Workflow:');
  state.steps.forEach((s, i) => {
    const head = s.skill ? `${s.skill}   ${Catalog.arr(s.phases).join(', ') || s.id}` : `${s.id}   ${s.summary}`;
    const inside = s.covered_by ? `   inside ${s.covered_by}` : '';
    const reviews = Catalog.arr(s.phases).some((p) => models.REVIEW_PHASES.includes(p));
    const model = s.model ?? (reviews && !s.covered_by ? models.stepModel(state, s, prefs) : null);
    const on = model ? `   on ${model}${s.effort ? ` · effort ${s.effort}` : ''}` : '';
    const switched = s.optional && s.status === 'skipped' && s.outcome === OFF ? '   (off)' : '';
    const checkpoint = s.confirm ? '   ⏸' : '';
    const outcome = started && s.outcome && !switched ? `  → ${s.outcome}` : '';
    lines.push(`${started ? `${mark[s.status] ?? '?'} ` : ''}${i + 1}. ${head}${inside}${on}${switched}${checkpoint}${outcome}`);
    if (s.skill) lines.push(`   ${s.summary}`, `   why: ${s.reason}`);
    Catalog.arr(s.alternatives).forEach((a, j) => lines.push(`   ${LETTERS[j]}) ${a.skill}: ${a.reason}`));
    const notes = [s.prerequisites?.length ? `needs: ${s.prerequisites.join('; ')}` : null,
      s.cost ? `cost: ${s.cost}` : null, s.tie ? `tie: ${s.tie}` : null].filter(Boolean);
    if (notes.length) lines.push(`   ${notes.join(' · ')}`);
  });
  lines.push('', models.modelsLine(state, prefs));
  const preset = models.presetPrimary(prefs);
  if (preset) lines.push(`        (primary from preferences.yaml: the reply "primary ${preset === 'claude' ? 'openai' : 'claude'}" changes it)`);
  for (const o of Catalog.arr(state.omitted)) lines.push(`Skipped: ${o.phase}: ${o.reason}`);
  for (const m of Catalog.arr(state.missing)) lines.push(`Missing: ${m.phase}: no available skill (${m.reason})`);
  const fillsIssue = state.steps.some((s) => Catalog.arr(s.phases).includes('issue-tracking'));
  if (!state.handoff?.issue && !fillsIssue) lines.push(`Issue-free: ${state.handoff?.spec ? `the spec file ${state.handoff.spec} is the handoff` : 'no selected skill publishes an issue'} (issue-free.md)`);
  if (!started) {
    lines.push('Execution: go authorizes this workflow through commit, push and the open PR; stops only for exceptions or checkpoints you request. Merge and deployment are separate.');
    if (state.steps.some((s) => s.id === 'security')) lines.push('Security: runs if the diff or task triggers the conditional check (after-implementation.md).');
    lines.push('', `Reply: go | <step><letter> to swap (e.g. 2b) | <step>on / <step>off (e.g. 5on) | primary <family>${state.path === 'light' ? ' | full' : ''} | edit | stop`);
  }
  return lines;
}

module.exports = { build, present, order, TRACKER_FILE };
