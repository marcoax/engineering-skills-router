// The mechanical changes to `.router/state.json` (format: skills/engineering-router/state.md),
// as pure functions on the parsed state: each returns a new state or throws an Error saying
// why the change does not apply. scripts/state reads, applies, validates and writes.
const STEP_STATUSES = ['pending', 'running', 'waiting', 'done', 'skipped', 'failed'];
const WORKFLOW_STATUSES = ['selecting', 'running', 'waiting', 'done', 'paused', 'stopped'];
// A step still to run, and one that has ended.
const OPEN = ['pending', 'running', 'waiting'];
const CLOSED = ['done', 'skipped', 'failed'];
// A started workflow that has not ended: resumed (resume.md), never replaced by a new run.
const UNFINISHED = ['running', 'waiting', 'paused', 'stopped'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
// Optional steps that switch together (state.md, SKILL.md §5).
const SWITCH_TOGETHER = ['review-2', 'comparison'];
const OFF = 'off (optional)';

// A step that ran: it stays as it ran when the workflow is recomposed. An optional step that is
// off never ran.
const ran = (step) => ['done', 'failed'].includes(step.status) || (step.status === 'skipped' && step.outcome !== OFF);
// Phases whose checks a swap restores as a step of their own when the old skill ran them inside.
const RESTORED_PHASES = ['testing', 'review'];

const clone = (s) => JSON.parse(JSON.stringify(s));
const fail = (msg) => {
  throw new Error(msg);
};

// A step by 1-based position or by id.
function stepIndex(state, ref) {
  const n = Number(ref);
  const i = Number.isInteger(n) && String(n) === String(ref) ? n - 1 : state.steps.findIndex((s) => s.id === ref);
  if (i < 0 || i >= state.steps.length) fail(`no step ${JSON.stringify(ref)} (1-${state.steps.length} or an id)`);
  return i;
}

// Sets a step's status (and outcome, model, effort when given). A step that covers others
// carries them along: running starts them, done or failed closes the ones still open. A
// carried step gets the covering step's model and effort: when it starts, if it has no
// model yet; when it is closed by the covering step, always. A covered step with its own
// agent record is closed on its own (before or after), so the covering step leaves it alone
// or is overwritten by it.
function setStep(state, ref, status, opts = {}) {
  if (!STEP_STATUSES.includes(status)) fail(`step status must be one of ${STEP_STATUSES.join(', ')}`);
  const s = clone(state);
  const i = stepIndex(s, ref);
  const step = s.steps[i];
  step.status = status;
  // An open step has no outcome yet; a stale one (e.g. `off (optional)`) goes.
  if (opts.outcome !== undefined) step.outcome = opts.outcome;
  else if (OPEN.includes(status)) step.outcome = null;
  if (opts.model !== undefined) step.model = opts.model || null;
  if (opts.effort !== undefined) step.effort = opts.effort || null;
  if (CLOSED.includes(status) && !(step.outcome ?? '').trim()) {
    fail(`step ${step.id}: an outcome is required when it is ${status} (--outcome "...")`);
  }
  const takeStepModel = (covered) => {
    covered.model = step.model ?? null;
    covered.effort = step.effort ?? null;
  };
  const closesCovered = status === 'done' || status === 'failed';
  for (const covered of s.steps.filter((c) => c.covered_by === step.id && !CLOSED.includes(c.status))) {
    if (status === 'running') {
      if (covered.status === 'pending') covered.status = 'running';
      if (covered.model == null) takeStepModel(covered);
    }
    if (closesCovered) {
      covered.status = status;
      covered.outcome = covered.outcome ?? `ran inside ${step.id}`;
      takeStepModel(covered);
    }
  }
  // A step that runs or waits sets the workflow's status (unless the user is still choosing).
  if (s.status !== 'selecting') {
    if (status === 'running') s.status = 'running';
    if (status === 'waiting') s.status = 'waiting';
    if (s.status === 'waiting' && !s.steps.some((x) => x.status === 'waiting')) s.status = 'running';
    // The last open step ended: the workflow is done.
    if (s.status === 'running' && !s.steps.some((x) => OPEN.includes(x.status))) s.status = 'done';
  }
  return s;
}

function setWorkflow(state, status) {
  if (!WORKFLOW_STATUSES.includes(status)) fail(`workflow status must be one of ${WORKFLOW_STATUSES.join(', ')}`);
  return { ...clone(state), status };
}

// The run's primary family is chosen before the workflow starts; a started run keeps its own.
function checkPrimaryOpen(state) {
  if (state.status !== 'selecting') fail(`primary is chosen before the workflow starts; this run is ${state.status} and keeps ${state.primary ?? 'its family'}`);
}

function setPrimary(state, family) {
  checkPrimaryOpen(state);
  return { ...clone(state), primary: family };
}

// Handoff values: issue <n> <url>, spec <path>, ticket <n> <url> (added), branch <name>,
// base <sha>, pr <n> <url>.
function setHandoff(state, field, args) {
  const s = clone(state);
  const h = s.handoff;
  const ref = () => {
    const number = Number(args[0]);
    if (!Number.isInteger(number) || number <= 0) fail(`${field}: expected <number> <url>`);
    return { number, url: args[1] ?? '' };
  };
  const one = () => {
    if (!args[0]) fail(`${field}: expected a value`);
    return args[0];
  };
  switch (field) {
    case 'issue': h.issue = ref(); break;
    case 'pr': h.pr = ref(); break;
    case 'ticket': {
      const t = ref();
      h.tickets = [...(h.tickets ?? []).filter((x) => x.number !== t.number), t];
      break;
    }
    case 'spec': h.spec = one(); break;
    case 'branch': h.branch = one(); break;
    case 'base': h.base_commit = one(); break;
    default: fail(`handoff field must be one of issue, spec, ticket, branch, base, pr`);
  }
  return s;
}

function swap(state, i, letter) {
  const s = clone(state);
  const step = s.steps[i];
  const j = LETTERS.indexOf(letter);
  const alt = step.alternatives[j];
  if (!alt) fail(`step ${i + 1} (${step.id}) has no alternative ${letter}`);
  // The old skill takes the swapped alternative's place.
  step.alternatives[j] = { skill: step.skill, reason: step.reason };
  step.skill = alt.skill;
  step.reason = alt.reason;
  return s;
}

// Recalculates which open steps run inside another step, from what the selected skills actually
// invoke (SKILL.md §4). `invokes(skill, phases)` lists the skills `skill` runs internally that are
// tagged with one of `phases`. A pending, non-optional step is covered by the first earlier open
// step, itself not covered, whose skill invokes one for its phases; it then takes that invoked
// skill and has no alternatives, and keeps the selector's own pick in `selected`. A covered step
// no such step runs any more runs on its own again, with the selector's pick restored, so a swap
// never leaves a check covered by a skill that does not run it. A light path never covers
// review 1. Returns { state, notes }: one line per changed step.
function recalculateCoverage(state, invokes) {
  const s = clone(state);
  const notes = [];
  s.steps.forEach((step, k) => {
    if (step.status !== 'pending' || step.optional || step.skill == null || !(step.phases ?? []).length) return;
    const phases = s.path === 'light' ? step.phases.filter((p) => p !== 'review') : step.phases;
    const cover = phases.length === 0 ? undefined : s.steps.slice(0, k)
      .find((x) => x.skill && x.covered_by == null && OPEN.includes(x.status) && invokes(x.skill, phases).length > 0);
    if (cover) {
      const runs = invokes(cover.skill, phases);
      if (step.covered_by === cover.id && runs.includes(step.skill)) return;
      if (step.covered_by == null) step.selected = { skill: step.skill, reason: step.reason, alternatives: step.alternatives ?? [] };
      Object.assign(step, { covered_by: cover.id, skill: runs[0], reason: `runs inside ${cover.skill}`, alternatives: [] });
      notes.push(`${step.id} runs inside ${cover.id} (${cover.skill} runs ${runs[0]})`);
    } else if (step.covered_by != null) {
      const coverId = step.covered_by;
      const was = s.steps.find((x) => x.id === coverId);
      const by = was?.skill ?? coverId;
      if (step.selected) Object.assign(step, step.selected);
      else step.reason = `runs on its own: ${by} does not run it`;
      Object.assign(step, { covered_by: null, selected: null });
      notes.push(`${step.id} runs on its own (${by} does not run it)`);
    }
  });
  return { state: s, notes };
}

// After step `i` swapped from `previous` to another skill: the checks `previous` ran inside it
// (testing, review) that the new skill does not run and no step of the workflow holds come back
// as a pending step of their own right after it, with the skill `previous` ran. Returns
// { state, notes }.
function restoreChecks(state, i, previous, invokes) {
  const s = clone(state);
  const notes = [];
  const step = s.steps[i];
  let at = i + 1;
  for (const phase of RESTORED_PHASES) {
    const ranInside = invokes(previous, [phase]);
    if (!ranInside.length || invokes(step.skill, [phase]).length || s.steps.some((x) => (x.phases ?? []).includes(phase))) continue;
    let id = phase;
    for (let n = 2; s.steps.some((x) => x.id === id); n++) id = `${phase}-${n}`;
    s.steps.splice(at++, 0, {
      id, phases: [phase], skill: ranInside[0], reason: `${previous} ran it inside ${step.id}; ${step.skill} does not`,
      summary: `Run the ${phase} ${previous} ran inside ${step.id}`, alternatives: [], confirm: false, optional: false,
      covered_by: null, model: null, effort: null, status: 'pending', outcome: null,
    });
    notes.push(`${id} restored as a step of its own (${previous} ran ${ranInside[0]} inside ${step.id})`);
  }
  return { state: s, notes };
}

// Optional steps switch until they start: while selecting, and later for a step still
// pending or off. A finished workflow switches nothing.
function toggle(state, i, on) {
  const s = clone(state);
  const step = s.steps[i];
  if (!step.optional) fail(`step ${i + 1} (${step.id}) is not optional`);
  if (s.status === 'done' || s.status === 'stopped') fail(`the workflow is ${s.status}: nothing switches`);
  const ids = SWITCH_TOGETHER.includes(step.id) ? SWITCH_TOGETHER : [step.id];
  const group = s.steps.filter((x) => ids.includes(x.id) && x.optional);
  const started = group.find((x) => !['pending', 'skipped'].includes(x.status));
  if (started) fail(`step ${started.id} is ${started.status}: it can no longer be switched`);
  for (const t of group) {
    t.status = on ? 'pending' : 'skipped';
    t.outcome = on ? null : OFF;
  }
  return s;
}

// A reply in the selection syntax (state.md): go, <n><letter>, <n>on, <n>off, stop, pause,
// resume. `edit` and `full` are not state changes: the router reselects and recomposes (§3-§4).
function applyReply(state, reply) {
  const r = String(reply).trim().toLowerCase();
  if (r === 'edit' || r === 'full') {
    const keep = state.primary ? `, and keep "primary": "${state.primary}"` : '';
    const e = new Error(`${r} reopens SKILL.md §3-§4: select and recompose the workflow, then write it with \`scripts/state <target repo> compose <file>\`, which keeps the handoff and completed steps${keep}`);
    e.code = 'RECOMPOSE';
    throw e;
  }
  if (r === 'go') {
    if (state.status !== 'selecting') fail(`go: the workflow is ${state.status}, not selecting`);
    return setWorkflow(state, 'running');
  }
  if (r === 'stop') return setWorkflow(state, 'stopped');
  if (r === 'pause') return setWorkflow(state, 'paused');
  if (r === 'resume') {
    if (state.status !== 'paused') fail(`resume: the workflow is ${state.status}, not paused`);
    return setWorkflow(state, state.steps.some((s) => s.status === 'waiting') ? 'waiting' : 'running');
  }
  const m = r.match(/^(\d+)(on|off|[a-z])$/);
  if (!m) fail(`not a selection reply: ${JSON.stringify(reply)}`);
  const i = stepIndex(state, m[1]);
  if (m[2] === 'on' || m[2] === 'off') return toggle(state, i, m[2] === 'on');
  if (state.status !== 'selecting') fail(`${r}: swaps apply while selecting, the workflow is ${state.status}`);
  return swap(state, i, m[2]);
}

// A selection reply with what it changed: a swap restores the checks the old skill ran inside
// the step and recalculates coverage from the newly selected skill. Returns { state, notes }.
function reply(state, text, invokes) {
  const next = applyReply(state, text);
  const m = String(text).trim().toLowerCase().match(/^(\d+)[a-z]$/);
  if (!m) return { state: next, notes: [] };
  const i = Number(m[1]) - 1;
  const restored = restoreChecks(next, i, state.steps[i].skill, invokes);
  const covered = recalculateCoverage(restored.state, invokes);
  return { state: covered.state, notes: [...restored.notes, ...covered.notes] };
}

module.exports = { recalculateCoverage, reply, ran, setStep, setWorkflow, checkPrimaryOpen, setPrimary, setHandoff, applyReply, stepIndex, STEP_STATUSES, WORKFLOW_STATUSES, UNFINISHED, LETTERS };
