// Which model family and model each step of a run uses (skills/engineering-router/models.md).
// The run's `primary` lives in `.router/state.json`; the preferences give the models, the
// per-phase overrides and the `primary` a new run starts from.
const FAMILIES = ['claude', 'openai'];
const DEFAULT_MODELS = { claude: 'claude-bridge/claude-opus-5-5', openai: 'openai-codex/gpt-6-sol' };

const other = (family) => FAMILIES.find((f) => f !== family);
// The family the user's preferences name as `primary`, or null when they name none.
const presetPrimary = (prefs) => (FAMILIES.includes(prefs.primary) ? prefs.primary : null);
const preferredPrimary = (prefs) => presetPrimary(prefs) ?? 'claude';
// A state written before `primary` existed follows the preferences.
const runPrimary = (state, prefs) => (FAMILIES.includes(state.primary) ? state.primary : preferredPrimary(prefs));
const familyModel = (family, prefs) => prefs.models?.[family] ?? DEFAULT_MODELS[family];

// The family set as `model` for the first phase, else the run's primary.
function phaseFamily(phases, state, prefs) {
  const override = prefs[phases?.[0]]?.model;
  return FAMILIES.includes(override) ? override : runPrimary(state, prefs);
}

// Phases of a step that reviews code, and of a step that writes it (ADR 0001).
const { REVIEW_PHASES } = require('./state-ops');
const WRITING_PHASES = ['implementation', 'refactoring', 'debugging', 'performance'];
const has = (step, list) => (step?.phases ?? []).some((p) => list.includes(p));

// The family a recorded model ID belongs to: one of the preferences' models, else by its name;
// null when it names neither.
function modelFamily(id, prefs) {
  if (typeof id !== 'string' || !id) return null;
  const bare = (m) => m.split('/').pop();
  const exact = FAMILIES.find((f) => bare(familyModel(f, prefs)) === bare(id));
  if (exact) return exact;
  if (/claude|opus|sonnet|haiku/i.test(id)) return 'claude';
  if (/gpt|codex|openai/i.test(id)) return 'openai';
  return null;
}

// The family a writing step runs on: the one it actually ran on once its model is recorded,
// else its first phase's `model`, else the run's primary.
const writerFamily = (writer, state, prefs) =>
  modelFamily(writer?.model, prefs) ?? phaseFamily(writer?.phases ?? ['implementation'], state, prefs);

// A step's family. A review step (review, framework-review, security, independent-review) is a
// cross-family review: it runs on the family opposite to the last earlier step that wrote the
// code, whatever a phase's `model` says. Every other step: its first phase's `model`, else the
// run's primary.
function stepFamily(state, step, prefs) {
  if (!has(step, REVIEW_PHASES) || has(step, WRITING_PHASES)) return phaseFamily(step.phases, state, prefs);
  const at = state.steps.indexOf(step);
  const writer = state.steps.slice(0, at < 0 ? state.steps.length : at).reverse().find((s) => has(s, WRITING_PHASES));
  return other(writerFamily(writer, state, prefs));
}

// The step that wrote the code a review step reviews: the last earlier writing step, or null.
function writerOf(state, step) {
  const at = state.steps.indexOf(step);
  return state.steps.slice(0, at < 0 ? state.steps.length : at).reverse().find((s) => has(s, WRITING_PHASES)) ?? null;
}

// The model a review's fixes run on: the model the code's writer ran on, else its family's.
const fixesModel = (state, step, prefs) => {
  const writer = writerOf(state, step);
  return writer?.model ?? familyModel(writerFamily(writer, state, prefs), prefs);
};

// For a review step that ran: true when it ran on a family other than the step that wrote the
// code, false for a same-family review, null when either family is unknown. Not a review: null.
function crossFamily(state, step, prefs) {
  if (!has(step, REVIEW_PHASES) || has(step, WRITING_PHASES) || !step.model) return null;
  const at = state.steps.indexOf(step);
  const writer = state.steps.slice(0, at).reverse().find((s) => has(s, WRITING_PHASES));
  const reviewer = modelFamily(step.model, prefs);
  const wrote = modelFamily(writer?.model, prefs);
  return reviewer && wrote ? reviewer !== wrote : null;
}

const stepModel = (state, step, prefs) => familyModel(stepFamily(state, step, prefs), prefs);

const modelsLine = (state, prefs) => `Models: ${FAMILIES.map((f) => `${f} ${familyModel(f, prefs)}`).join(' · ')}`
  + ` · primary ${runPrimary(state, prefs)} · effort ${prefs.effort ?? 'harness default'}`;

// The primary question's options: the run's family first, so the preselected option keeps it.
function primaryOptions(state, prefs) {
  const current = runPrimary(state, prefs);
  return [current, other(current)].map((family) => ({ family, label: `${family} (${familyModel(family, prefs)})`, current: family === current }));
}

const primaryQuestion = (state, prefs) => `Primary model family for this run:\n${primaryOptions(state, prefs)
  .map((o, i) => `${i + 1}. ${o.label}${o.current ? '  current' : ''}`).join('\n')}`;

// When the preferences name `primary`, no question: the run's family, to show in the workflow,
// and the reply that changes it.
const primaryPreset = (state, prefs) => {
  const run = runPrimary(state, prefs);
  return `primary: ${run} (preferences.yaml sets primary: ${presetPrimary(prefs)}): no question.`
    + ` Name it in the workflow's Models line; the reply "primary ${other(run)}" changes it before go.`;
};

// The primary question's answer, as a family name or its option number; null when it is neither.
function primaryAnswer(state, prefs, answer) {
  const options = primaryOptions(state, prefs);
  return (options.find((o) => o.family === answer) ?? options[Number(answer) - 1])?.family ?? null;
}

module.exports = { FAMILIES, REVIEW_PHASES, modelFamily, crossFamily, writerOf, fixesModel, presetPrimary, preferredPrimary, primaryPreset, runPrimary, stepFamily, stepModel, modelsLine, primaryOptions, primaryQuestion, primaryAnswer };
