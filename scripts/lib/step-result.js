// Step results (skills/engineering-router/step-result.md): what a delegated step declares it
// must deliver, and the check that its delivery is for this step and attempt, carries a
// recognizable verdict and the declared artifacts in their formats. Pure functions on the
// parsed state; the caller reads files through `read(rel)` (its text, or null when absent).
const path = require('node:path');
const { clone, fail, setStep, setHandoff, stepIndex, REVIEW_PHASES } = require('./state-ops');
const { findingsProblems, DECISIONS } = require('./runs');
const { STEPS_DIR, notePath, noteRun, noteBody } = require('./run-files');

const VERDICTS = ['done', 'fixes', 'blocked'];
const KINDS = ['note', 'findings', 'pr-body'];
// Phases whose steps converse with the user and run in the main session (SKILL.md §6).
const MAIN_SESSION_PHASES = ['requirements', 'clarification', 'specification', 'setup'];


// The conventional paths of a step's result and artifacts, relative to the target repo.
function paths(state, i) {
  const base = `${STEPS_DIR}/${i + 1}-${state.steps[i].id}`;
  return { result: `${base}.result.json`, note: notePath(state, i), findings: `${base}.findings.json`, 'pr-body': `${base}.pr-body.md` };
}

// A fixes run delivers on its review step (the coordinating step), beside the review's files:
// its result, its note and the findings it fixed.
function fixesPaths(i) {
  const base = `${STEPS_DIR}/${i + 1}-fixes`;
  return { result: `${base}.result.json`, note: `${base}.md`, findings: `${base}.findings.json` };
}
// The paths of the step's current attempt: a fixes attempt's, else the step's own.
const attemptPaths = (state, i) => (state.steps[i].result?.kind === 'fixes' ? fixesPaths(i) : paths(state, i));

const isReview = (step) => REVIEW_PHASES.includes(step.id);
// A step's actionable findings, numbered as reported: those without a decision.
const actionableOf = (findings) => (findings ?? []).map((f, j) => ({ f, n: j + 1 })).filter(({ f }) => f?.decision === undefined);

// Whether a step is delegated, so it owes a delivery: a skill step of a run (a state written
// before runs is legacy), neither run inside another step nor conversational.
const delegated = (state, step) => Boolean(state.run) && step.skill != null && !step.covered_by
  && !(step.phases ?? []).some((p) => MAIN_SESSION_PHASES.includes(p));

// Delegated work and PR preparation use start/deliver; other main-session work uses step.
function stepProblem(state, ref, status, { inSession = false } = {}) {
  const i = stepIndex(state, ref);
  const step = state.steps[i];
  const preparation = Boolean(state.run) && step.id === 'pull-request' && step.skill != null;
  if (!['running', 'done'].includes(status) || (!preparation && (inSession || !delegated(state, step)))) return null;
  return `step ${step.id}: ${preparation ? 'PR preparation needs an accepted delivery, including in the main session' : 'a delegated step uses start and deliver'}: use \`start ${i + 1}\`, then \`deliver ${i + 1}\` (step-result.md); other main-session skill steps use --main-session`;
}

// What a step delivers unless the caller declares otherwise: every step its note; a review its
// findings too; the pull-request preparation the body and the consolidated findings.
function defaultRequires(step) {
  if (step.id === 'pull-request') return ['pr-body', 'findings'];
  if (isReview(step)) return ['note', 'findings'];
  return ['note'];
}

// Opens a delivery for a running step: a new attempt, which makes any earlier attempt's result
// stale; the earlier attempts stay listed. A review pass counts once per purpose (#81): the first
// one's is the step's summary, and another pass after an accepted verdict declares a distinct
// `purpose`; a retry of an attempt that delivered nothing keeps its purpose. `fixes` opens the
// fixes run's attempt on a review with actionable findings instead (#99): not a review pass, it
// delivers its note and the findings it fixed. Returns { state, lines } with the lines the
// step's brief carries.
function openAttempt(state, ref, { requires, attempt, purpose, fixes = false }) {
  const s = clone(state);
  const i = stepIndex(s, ref);
  const step = s.steps[i];
  if (step.status !== 'running') fail(`step ${step.id} is ${step.status}: start it with start ${i + 1}`);
  const old = step.result;
  const earlier = old ? [...(old.earlier ?? []), {
    attempt: old.attempt, purpose: old.purpose ?? null, verdict: old.verdict,
    ...(old.kind ? { kind: old.kind } : {}), ...(old.summary ? { summary: old.summary } : {}),
  }] : [];
  // The review's findings and their decisions so far stay with the step across attempts.
  const carried = old?.findings ? { findings: old.findings, recheck: old.recheck ?? null } : {};
  if (fixes) {
    if (!isReview(step) || !actionableOf(old?.findings).length)
      fail(`step ${step.id}: no finding to fix: the fixes run starts after a review's accepted fixes verdict, while a finding is actionable`);
    if (purpose || requires) fail('--fixes takes no --purpose or --requires: the fixes run is not a review pass, it delivers its note and the findings it fixed');
    step.result = { attempt, kind: 'fixes', requires: ['note', 'findings'], verdict: null, artifacts: [], remaining: null, purpose: null, earlier, ...carried };
    const p = fixesPaths(i);
    return { state: s, lines: [`result: ${p.result}`, `attempt: ${attempt}`, `requires: note ${p.note}, findings ${p.findings}`,
      ...actionableOf(old.findings).map(({ f, n }) => `fix: ${n}. ${f.title} (${f.severity})`),
      'findings: deliver each finding you fixed with "decision": "fixed"; the main session records declined and deferred (step-result.md)'] };
  }
  const kinds = requires ?? defaultRequires(step);
  const unknown = kinds.filter((k) => !KINDS.includes(k));
  if (unknown.length) fail(`--requires: unknown artifact ${unknown.join(', ')} (${KINDS.join(', ')})`);
  if (step.id === 'pull-request' && defaultRequires(step).some((k) => !kinds.includes(k)))
    fail('pull-request requires pr-body and findings, in the main session or a subagent');
  // A fixes attempt is no review pass: it neither counts as one nor lends a retry its purpose.
  const passed = earlier.filter((e) => e.verdict !== null && e.kind !== 'fixes');
  if (isReview(step) && passed.length) {
    if (!purpose) fail(`another pass of ${step.id} needs --purpose "<what it checks that the earlier passes did not>": a review counts once per purpose`);
    if (passed.some((e) => e.purpose === purpose)) fail(`${step.id} already ran for that purpose (${purpose}): declare what this pass adds`);
  }
  const pass = purpose || old?.purpose || step.summary || null;
  step.result = { attempt, requires: kinds, verdict: null, artifacts: [], remaining: null, purpose: pass, earlier, ...carried };
  const p = paths(s, i);
  const lines = [`result: ${p.result}`, `attempt: ${attempt}`, `requires: ${kinds.map((k) => `${k} ${p[k]}`).join(', ')}`];
  if (pass) lines.push(`purpose: ${pass}`);
  // A review whose executor writes no note is read-only: its answer goes to this attempt's file.
  if (isReview(step) && !kinds.includes('note')) lines.push(`answer: ${STEPS_DIR}/${i + 1}-${step.id}.${attempt}.answer.md`);
  // The note's line comes from run-files.js startNote, which heads the note with its run.
  return { state: s, lines };
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

// The checks every delivery shares: the result names this step and its current attempt, and
// carries a verdict, a summary and the declared artifacts in their formats; `findingsOf(list)`
// returns the problems of a parsed findings artifact. Returns { problems, kept } for a refusal
// that ends the check early, else the checked delivery, whose `problems` the caller adds to.
function check(state, i, read, handoffValue, findingsOf) {
  const step = state.steps[i];
  const p = attemptPaths(state, i);
  const expected = step.result;
  const refuse = (problems) => ({ problems, kept: [] });
  if (!expected || expected.verdict !== null) return refuse([`step ${step.id}: no delivery expected (start ${i + 1} first)`]);
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
  let s = clone(state);
  if (result.handoff !== undefined) {
    if (!result.handoff || typeof result.handoff !== 'object' || Array.isArray(result.handoff))
      problems.push('result.handoff: must be an object');
    else for (const [field, value] of Object.entries(result.handoff)) {
      try {
        const reference = ['issue', 'ticket', 'pr'].includes(field);
        if (reference && (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isInteger(value.number)))
          fail(`${field}: expected {number, url}`);
        s = handoffValue(s, field, reference ? [value.number, value.url] : [value]);
      } catch (e) { problems.push(`result.handoff.${field}: ${e.message}`); }
    }
  }
  const verdict = result.verdict;
  if (!VERDICTS.includes(verdict)) problems.push(`result.verdict: no recognizable verdict (${VERDICTS.join(' | ')}), got ${JSON.stringify(verdict)}`);
  const recheck = typeof result.recheck === 'string' && result.recheck.trim() ? result.recheck.trim() : null;
  if (result.recheck !== undefined && result.recheck !== null && !recheck) problems.push('result.recheck: the behavior-changing fix to re-check, in one line, or null');
  if (typeof result.summary !== 'string' || !result.summary.trim()) problems.push('result.summary: one line, required');
  const remaining = typeof result.remaining === 'string' && result.remaining.trim() ? result.remaining : null;
  if (verdict === 'blocked' && !remaining) problems.push('result.remaining: required when the verdict is blocked (what blocks the step, what is left)');
  const given = typeof result.artifacts === 'object' && result.artifacts !== null && !Array.isArray(result.artifacts) ? result.artifacts : {};
  for (const kind of Object.keys(given)) if (!KINDS.includes(kind)) problems.push(`artifacts.${kind}: unknown artifact (${KINDS.join(', ')})`);

  // Each declared artifact must be there and valid; a blocked step reports what it has.
  const issue = (verdict === 'done' ? s : state).handoff?.issue;
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
    // A run's note must identify that run, including notes left by older executions.
    const run = kind === 'note' ? noteRun(content) : null;
    if (!noteBody(content).trim()) own.push(`${kind}: ${rel} is empty`);
    else if (kind === 'note' && state.run && !run) own.push(`note: ${rel} needs first line "run: ${state.run}"`);
    else if (run && state.run && run !== state.run) own.push(`note: ${rel} belongs to run ${run}, not this run`);
    else if (kind === 'findings') {
      let list;
      try {
        list = JSON.parse(content);
      } catch (e) {
        own.push(`findings: ${rel}: ${e.message}`);
      }
      if (list !== undefined) {
        own.push(...findingsOf(list));
        if (!own.length) findings = list;
      }
    } else if (kind === 'pr-body' && issue?.number != null) {
      const n = issue.number;
      if (!new RegExp(`\\bCloses #${n}\\b`, 'i').test(content)) own.push(`pr-body: must link the issue with "Closes #${n}"`);
    }
    if (own.length) problems.push(...own);
    else {
      kept.push(`${kind} ${rel}`);
      artifacts.push({ kind, path: rel });
    }
  }
  return { problems, kept, checked: { s, verdict, recheck, remaining, summary: result.summary, artifacts, findings, writes } };
}

// Accepts a checked delivery, given the step's findings after it (`merged`), its re-check and
// the lines naming what it delivered. Returns { state, verdict, lines, writes }.
function accept(state, i, d, merged, recheck, delivered) {
  const { verdict, remaining } = d;
  let s = verdict === 'done' ? d.s : clone(state);
  const accepted = { ...state.steps[i].result, verdict, artifacts: d.artifacts, remaining, summary: d.summary };
  const writes = [...d.writes];
  if (merged) {
    accepted.findings = merged;
    if (verdict !== 'blocked') accepted.recheck = recheck;
    // The review's findings file holds them with their decisions, as scripts/record reads them,
    // and the step's recorded findings artifact is that file, wherever this delivery put its own.
    const decided = paths(state, i).findings;
    writes.splice(0, writes.length, ...writes.filter((w) => w.path !== decided), { path: decided, content: `${JSON.stringify(merged, null, 2)}\n` });
    accepted.artifacts = [...d.artifacts.filter((a) => a.kind !== 'findings'), { kind: 'findings', path: decided }];
  }
  s.steps[i].result = accepted;
  const lines = [];
  if (verdict === 'blocked') {
    s = setStep(s, i + 1, 'waiting');
    lines.push(`blocked: ${remaining}`);
  } else if (verdict === 'fixes') lines.push(`fixes: ${plural(actionableOf(merged).length)}`);
  lines.push(...delivered);
  // Every finding still actionable on the step, then what comes next, or the close.
  if (verdict !== 'blocked') s = settle(s, i, lines);
  return { state: s, verdict, lines, writes };
}

// Checks a delivery against the step's open expectation. Returns { problems, kept } when it is
// refused (the state is unchanged, the attempt stays open), else { state, verdict, lines,
// writes }: done closes the step with its summary, fixes keeps it running, blocked leaves it
// waiting; `writes` are inline artifacts for the caller to save ({path, content}). The fixes
// run's attempt is checked by deliverFixes.
function deliver(state, ref, read, handoffValue = setHandoff) {
  const i = stepIndex(state, ref);
  const step = state.steps[i];
  if (step.result?.kind === 'fixes') return deliverFixes(state, i, read, handoffValue);
  const ids = new Set(state.steps.map((x) => x.id));
  const { problems, kept, checked: d } = check(state, i, read, handoffValue, (list) => [
    ...findingsProblems(list, ids, { decided: false }),
    // A review reports; its findings are decided by the fixes run and the main session.
    ...(isReview(step) && Array.isArray(list) ? list.flatMap((f, j) => (f?.decision === undefined ? []
      : [`findings[${j}].decision: a review never decides its own findings: deliver fixes, then the fixes run and decide ${i + 1} record the decisions`])) : []),
  ]);
  if (!d) return { problems, kept };
  if (d.recheck) problems.push('result.recheck: only a fixes run declares a re-check');
  // Findings without a decision are actionable: they go to fixes, never straight on.
  const actionable = actionableOf(d.findings).length;
  if (d.verdict === 'done' && actionable) problems.push(`verdict done with ${plural(actionable)}: deliver fixes, or record each decision`);
  if (d.verdict === 'fixes' && !actionable) problems.push('verdict fixes needs at least one actionable finding (a finding without a decision)');
  if (problems.length) return { problems, kept };

  // A later pass's findings join those reported before; one reported again is actionable again,
  // whatever was decided on it. A blocked delivery leaves them as they were.
  const before = step.result.findings ?? null;
  const found = d.findings;
  let merged = before;
  if (d.verdict !== 'blocked' && found) {
    if (before) merged = [...before.map((m) => found.find((f) => f.title === m.title) ?? m),
      ...found.filter((f) => !before.some((m) => m.title === f.title))];
    else if (d.verdict === 'fixes') merged = found;
  }
  // The delivered findings in a line each, so the next decision needs no other read.
  const delivered = found ? (found.length ? found.map((f) => `finding: ${f.severity}: ${f.title}`) : ['findings: none']) : [];
  return accept(state, i, d, merged, null, delivered);
}

// The fixes run's delivery on its review step: done (its fixes are in) or blocked, its note,
// and as findings each finding the review reported that it fixed, with "decision": "fixed".
function deliverFixes(state, i, read, handoffValue) {
  const reported = state.steps[i].result.findings ?? [];
  const { problems, kept, checked: d } = check(state, i, read, handoffValue, (list) => {
    if (!Array.isArray(list)) return ['findings: expected a JSON array of the findings this run fixed'];
    return list.flatMap((f, j) => {
      const r = reported.find((x) => x.title === f?.title);
      if (!r) return [`findings[${j}]: ${JSON.stringify(f?.title)} is not a finding the review reported`];
      if (f.decision !== 'fixed') return [`findings[${j}].decision: the fixes run records "fixed" on each finding it fixed; declined and deferred are recorded with decide ${i + 1}`];
      if (r.decision !== undefined) return [`findings[${j}]: ${JSON.stringify(f.title)} is already ${r.decision}`];
      return [];
    });
  });
  if (!d) return { problems, kept };
  if (d.verdict === 'fixes') problems.push('result.verdict: a fixes run delivers done (its fixes are in) or blocked, never fixes');
  if (problems.length) return { problems, kept };
  const fixed = d.verdict !== 'blocked' ? d.findings ?? [] : [];
  const merged = reported.map((f) => (fixed.some((x) => x.title === f.title) ? { ...f, decision: 'fixed' } : f));
  // Only a review clears pending re-checks; later fixes can add another change to check.
  const recheck = [...new Set([state.steps[i].result.recheck, d.recheck].filter(Boolean))].join('; ') || null;
  return accept(state, i, d, merged, recheck, (d.findings ?? []).map((f) => `fixed: ${f.title}`));
}

const plural = (n) => `${n} actionable finding${n === 1 ? '' : 's'}`;

// Closes a review step once its accepted deliveries leave no finding actionable and no re-check
// pending, with the outcome taken from those deliveries; otherwise it stays running and says
// what is left. A step without findings closes on its accepted done delivery.
function settle(s, i, lines) {
  const step = s.steps[i];
  const r = step.result;
  if (r.verdict === null || r.verdict === 'blocked') {
    if (r.verdict === null) lines.push(`open: attempt ${r.attempt} still expects its delivery (deliver ${i + 1})`);
    return s;
  }
  const open = actionableOf(r.findings);
  if (open.length) {
    lines.push(...open.map(({ f, n }) => `actionable: ${n}. ${f.title} (${f.severity})`),
      `next: start ${i + 1} --fixes for those to fix; decide ${i + 1} <n> declined|deferred --reason "..." for the others`);
    return s;
  }
  if (r.recheck) {
    lines.push(`recheck: ${r.recheck}: start ${i + 1} --purpose "re-check ${r.recheck}"`);
    return s;
  }
  // A step whose review reported findings: each accepted delivery's summary, then the decisions.
  let outcome = r.summary;
  if (r.findings?.length) {
    const summaries = [...(r.earlier ?? []), r].filter((e) => ['done', 'fixes'].includes(e.verdict) && e.summary).map((e) => e.summary);
    const tally = DECISIONS.map((d) => [d, r.findings.filter((f) => f.decision === d).length]).filter(([, n]) => n);
    outcome = [...new Set(summaries), `findings: ${tally.map(([d, n]) => `${n} ${d}`).join(', ')}`].join('; ');
  }
  // First, right under the state line: the adapters read it as the step boundary.
  lines.unshift(`done: ${outcome}`);
  return setStep(s, i + 1, 'done', { outcome });
}

// Records the main session's decision on a finding a review reported: declined (with the
// evidence) or deferred (with the reason), once the review's fixes verdict was accepted. The
// step closes when that leaves nothing actionable. Returns { state, lines, writes }.
function decide(state, ref, which, decision, reason) {
  let s = clone(state);
  const i = stepIndex(s, ref);
  const step = s.steps[i];
  const r = step.result;
  if (!isReview(step) || !r?.findings) fail(`step ${step.id}: no reported finding to decide: decisions come after a review's accepted fixes verdict (deliver fixes first)`);
  if (step.status !== 'running') fail(`step ${step.id} is ${step.status}, not running`);
  // The main session's decisions: every one but fixed, which comes with the fixes run.
  const ours = DECISIONS.filter((d) => d !== 'fixed');
  if (!ours.includes(decision))
    fail(`decision: ${ours.join(' | ')}, got ${JSON.stringify(decision)} (a fixed finding comes with the fixes run's delivery: start ${i + 1} --fixes)`);
  if (typeof reason !== 'string' || !reason.trim()) fail(`--reason "...": ${decision === 'declined' ? 'the evidence it is not a problem' : 'why it is left for later (an issue, a TODO)'}`);
  const n = Number(which);
  const k = Number.isInteger(n) && String(n) === String(which) ? n - 1 : r.findings.findIndex((f) => f.title === which);
  const f = r.findings[k];
  if (!f) fail(`no finding ${JSON.stringify(which)} on step ${step.id}: ${r.findings.map((x, j) => `${j + 1}. ${x.title}`).join('; ')}`);
  if (f.decision !== undefined) fail(`finding ${k + 1}. ${f.title} is already ${f.decision}`);
  r.findings[k] = { ...f, decision, reason: reason.trim() };
  const lines = [`decided: ${k + 1}. ${f.title}: ${decision}`];
  s = settle(s, i, lines);
  return { state: s, lines, writes: [{ path: paths(s, i).findings, content: `${JSON.stringify(r.findings, null, 2)}\n` }] };
}

// The path (relative to the target repo) of an artifact an accepted delivery carries.
function artifact(state, ref, kind) {
  const i = stepIndex(state, ref);
  const step = state.steps[i];
  const found = step.result?.verdict === 'done' ? step.result.artifacts.find((a) => a.kind === kind) : null;
  if (!found) fail(`step ${step.id}: no accepted ${kind} (deliver it with a done verdict first)`);
  return found.path;
}

module.exports = { openAttempt, delegated, deliver, decide, artifact, paths, attemptPaths, actionableOf, defaultRequires, stepProblem, VERDICTS, KINDS };
