// Which model family and model each step of a run uses (skills/engineering-router/models.md).
// The run's `primary` lives in `.router/state.json`; the preferences give the models, the
// per-phase overrides and the `primary` a new run starts from.
const FAMILIES = ['claude', 'openai'];
const DEFAULT_MODELS = { claude: 'claude-bridge/claude-opus-5-5', openai: 'openai-codex/gpt-6-sol' };

const other = (family) => FAMILIES.find((f) => f !== family);
const preferredPrimary = (prefs) => (FAMILIES.includes(prefs.primary) ? prefs.primary : 'claude');
// A state written before `primary` existed follows the preferences.
const runPrimary = (state, prefs) => (FAMILIES.includes(state.primary) ? state.primary : preferredPrimary(prefs));
const familyModel = (family, prefs) => prefs.models?.[family] ?? DEFAULT_MODELS[family];

// The family set as `model` for the first phase, else the run's primary.
function phaseFamily(phases, state, prefs) {
  const override = prefs[phases?.[0]]?.model;
  return FAMILIES.includes(override) ? override : runPrimary(state, prefs);
}

// A step's family: review 2 runs on the family opposite to review 1's.
function stepFamily(state, step, prefs) {
  if (step.id !== 'review-2') return phaseFamily(step.phases, state, prefs);
  const review1 = state.steps.find((s) => s.id === 'review-1');
  return other(phaseFamily(review1?.phases ?? ['review'], state, prefs));
}

const stepModel = (state, step, prefs) => familyModel(stepFamily(state, step, prefs), prefs);

const modelsLine = (state, prefs) => `Models: ${FAMILIES.map((f) => `${f} ${familyModel(f, prefs)}`).join(' · ')}`
  + ` · primary ${runPrimary(state, prefs)} · effort ${prefs.effort ?? 'harness default'}`;

module.exports = { FAMILIES, preferredPrimary, runPrimary, stepFamily, stepModel, modelsLine };
