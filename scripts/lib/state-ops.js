// The mechanical changes to `.router/state.json` (format: skills/engineering-router/state.md),
// as pure functions on the parsed state: each returns a new state or throws an Error saying
// why the change does not apply. scripts/state reads, applies, validates and writes.
const STEP_STATUSES = ['pending', 'running', 'waiting', 'done', 'skipped', 'failed'];
const WORKFLOW_STATUSES = ['selecting', 'running', 'waiting', 'done', 'paused', 'stopped'];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
// Optional steps that switch together (state.md, SKILL.md §5).
const SWITCH_TOGETHER = ['review-2', 'comparison'];
const OFF = 'off (optional)';

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

const CLOSED = ['done', 'skipped', 'failed'];

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
  else if (['pending', 'running', 'waiting'].includes(status)) step.outcome = null;
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
    if (s.status === 'running' && !s.steps.some((x) => ['pending', 'running', 'waiting'].includes(x.status))) s.status = 'done';
  }
  return s;
}

function setWorkflow(state, status) {
  if (!WORKFLOW_STATUSES.includes(status)) fail(`workflow status must be one of ${WORKFLOW_STATUSES.join(', ')}`);
  return { ...clone(state), status };
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
// resume. `edit` and `full` are not state changes: the router reopens §2-§4.
function applyReply(state, reply) {
  const r = String(reply).trim().toLowerCase();
  if (r === 'edit' || r === 'full') {
    const e = new Error(`${r} reopens SKILL.md §2-§4: recompose the workflow and write it again`);
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

module.exports = { setStep, setWorkflow, setHandoff, applyReply, stepIndex, STEP_STATUSES, WORKFLOW_STATUSES };
