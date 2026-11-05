// Step results (skills/engineering-router/step-result.md): what a delegated step declares it
// must deliver, and the check that its delivery is for this step and attempt, carries a
// recognizable verdict and the declared artifacts in their formats. Pure functions on the
// parsed state; the caller reads files through `read(rel)` (its text, or null when absent).
const path = require('node:path');
const { setStep, stepIndex } = require('./state-ops');
const { findingsProblems } = require('./runs');

const VERDICTS = ['done', 'fixes', 'blocked'];
const KINDS = ['note', 'findings', 'pr-body'];
const REVIEW_STEPS = ['review', 'framework-review', 'security', 'independent-review'];
const STEPS_DIR = '.router/steps';

const clone = (s) => JSON.parse(JSON.stringify(s));
const fail = (msg) => {
  throw new Error(msg);
};

// The conventional paths of a step's result and artifacts, relative to the target repo.
function paths(state, i) {
  const base = `${STEPS_DIR}/${i + 1}-${state.steps[i].id}`;
  return { result: `${base}.result.json`, note: `${base}.md`, findings: `${base}.findings.json`, 'pr-body': `${base}.pr-body.md` };
}

// What a step delivers unless the caller declares otherwise: every step its note; a review its
// findings too; the pull-request preparation the body and the consolidated findings.
function defaultRequires(step) {
  if (step.id === 'pull-request') return ['pr-body', 'findings'];
  if (REVIEW_STEPS.includes(step.id)) return ['note', 'findings'];
  return ['note'];
}

// Opens a delivery for a running step: a new attempt, which makes any earlier attempt's result
// stale. Returns { state, lines } with the lines the step's brief carries.
function expect(state, ref, { requires, attempt }) {
  const s = clone(state);
  const i = stepIndex(s, ref);
  const step = s.steps[i];
  if (step.status !== 'running') fail(`step ${step.id} is ${step.status}: start it (step ${i + 1} running) before expecting its delivery`);
  const kinds = requires ?? defaultRequires(step);
  const unknown = kinds.filter((k) => !KINDS.includes(k));
  if (unknown.length) fail(`--requires: unknown artifact ${unknown.join(', ')} (${KINDS.join(', ')})`);
  step.result = { attempt, requires: kinds, verdict: null, artifacts: [], remaining: null };
  const p = paths(s, i);
  return {
    state: s,
    lines: [`result: ${p.result}`, `attempt: ${attempt}`, `requires: ${kinds.map((k) => `${k} ${p[k]}`).join(', ')}`],
  };
}

// The result object in a delivered text: the whole text as JSON, or its last ```json block
// (a read-only reviewer's answer, saved as it came). Never a phrase in prose.
function parseResult(text) {
  try {
    return JSON.parse(text);
  } catch {
    const blocks = [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)];
    if (!blocks.length) return undefined;
    try {
      return JSON.parse(blocks.at(-1)[1]);
    } catch {
      return undefined;
    }
  }
}

const inside = (rel) => typeof rel === 'string' && rel.trim() && !path.isAbsolute(rel) && path.normalize(rel).split(path.sep)[0] !== '..';

// Checks a delivery against the step's open expectation. Returns { problems, kept } when it is
// refused (the state is unchanged, the attempt stays open), else { state, verdict, actionable,
// lines, writes }: a done or fixes verdict keeps the step running (done lets it close), blocked
// leaves it waiting; `writes` are inline artifacts for the caller to save ({path, content}).
function deliver(state, ref, read) {
  const i = stepIndex(state, ref);
  const step = state.steps[i];
  const p = paths(state, i);
  const expected = step.result;
  const refuse = (problems, kept = []) => ({ problems, kept });
  if (!expected || expected.verdict !== null) return refuse([`step ${step.id}: no delivery expected (expect ${i + 1} first)`]);
  if (step.status !== 'running') return refuse([`step ${step.id} is ${step.status}, not running`]);
  const text = read(p.result);
  if (text == null) return refuse([`result: ${p.result} not found`]);
  const result = parseResult(text);
  if (typeof result !== 'object' || result === null || Array.isArray(result))
    return refuse([`result: no result JSON in ${p.result} (a JSON object, or a \`\`\`json block); a phrase is not a delivery`]);
  if (result.step !== step.id) return refuse([`result.step: ${JSON.stringify(result.step)} is not step ${step.id}`]);
  if (result.attempt !== expected.attempt)
    return refuse([`result.attempt: ${JSON.stringify(result.attempt)} is not the current attempt ${expected.attempt}`]);

  const problems = [];
  const verdict = result.verdict;
  if (!VERDICTS.includes(verdict)) problems.push(`result.verdict: no recognizable verdict (${VERDICTS.join(' | ')}), got ${JSON.stringify(verdict)}`);
  if (typeof result.summary !== 'string' || !result.summary.trim()) problems.push('result.summary: one line, required');
  const remaining = typeof result.remaining === 'string' && result.remaining.trim() ? result.remaining : null;
  if (verdict === 'blocked' && !remaining) problems.push('result.remaining: required when the verdict is blocked (what blocks the step, what is left)');
  const given = typeof result.artifacts === 'object' && result.artifacts !== null && !Array.isArray(result.artifacts) ? result.artifacts : {};
  for (const kind of Object.keys(given)) if (!KINDS.includes(kind)) problems.push(`artifacts.${kind}: unknown artifact (${KINDS.join(', ')})`);

  // Each declared artifact must be there and valid; a blocked step reports what it has.
  const ids = new Set(state.steps.map((s) => s.id));
  const kept = [];
  const artifacts = [];
  let findings = null;
  const writes = [];
  for (const kind of KINDS) {
    let rel = given[kind];
    const required = expected.requires.includes(kind) && verdict !== 'blocked';
    if (rel === undefined) {
      if (required) problems.push(`${kind}: required, not delivered (${p[kind]})`);
      continue;
    }
    // A read-only executor gives its findings inline; they are written to the conventional path.
    let content;
    if (kind === 'findings' && Array.isArray(rel)) {
      content = `${JSON.stringify(rel, null, 2)}\n`;
      rel = p.findings;
      writes.push({ path: rel, content });
    } else if (!inside(rel)) {
      problems.push(`${kind}: must be a path inside the target repo, got ${JSON.stringify(rel)}`);
      continue;
    } else content = read(rel);
    if (content == null) {
      problems.push(`${kind}: ${rel} not found`);
      continue;
    }
    const own = [];
    if (!content.trim()) own.push(`${kind}: ${rel} is empty`);
    else if (kind === 'findings') {
      let list;
      try {
        list = JSON.parse(content);
      } catch (e) {
        own.push(`findings: ${rel}: ${e.message}`);
      }
      if (list !== undefined) {
        own.push(...findingsProblems(list, ids, { decided: false }));
        if (!own.length) findings = list;
      }
    } else if (kind === 'pr-body' && state.handoff?.issue?.number != null) {
      const n = state.handoff.issue.number;
      if (!new RegExp(`\\bCloses #${n}\\b`, 'i').test(content)) own.push(`pr-body: must link the issue with "Closes #${n}"`);
    }
    if (own.length) problems.push(...own);
    else {
      kept.push(`${kind} ${rel}`);
      artifacts.push({ kind, path: rel });
    }
  }

  // Findings without a decision are actionable: they go to fixes, never straight on.
  const actionable = (findings ?? []).filter((f) => f.decision === undefined).length;
  const plural = (n) => `${n} actionable finding${n === 1 ? '' : 's'}`;
  if (verdict === 'done' && actionable) problems.push(`verdict done with ${plural(actionable)}: deliver fixes, or record each decision`);
  if (verdict === 'fixes' && !actionable) problems.push('verdict fixes needs at least one actionable finding (a finding without a decision)');
  if (problems.length) return refuse(problems, kept);

  let s = clone(state);
  s.steps[i].result = { attempt: expected.attempt, requires: expected.requires, verdict, artifacts, remaining };
  const lines = [];
  if (verdict === 'blocked') {
    s = setStep(s, i + 1, 'waiting');
    lines.push(`blocked: ${remaining}`);
  } else if (verdict === 'fixes') lines.push(`fixes: ${plural(actionable)}: run the fixes, then expect ${i + 1} again`);
  else lines.push(`done: ${result.summary}`);
  return { state: s, verdict, actionable, lines, writes };
}

// The path (relative to the target repo) of an artifact an accepted delivery carries.
function artifact(state, ref, kind) {
  const i = stepIndex(state, ref);
  const step = state.steps[i];
  const found = step.result?.verdict === 'done' ? step.result.artifacts.find((a) => a.kind === kind) : null;
  if (!found) fail(`step ${step.id}: no accepted ${kind} (deliver it with a done verdict first)`);
  return found.path;
}

module.exports = { expect, deliver, artifact, paths, defaultRequires, VERDICTS, KINDS };
