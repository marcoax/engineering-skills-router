// Run records (skills/engineering-router/run-record.md): reads them out of PR bodies and
// adds them up. No I/O here; scripts/stats fetches the bodies.
const MARK = /<!--\s*engineering-router:run\s*([\s\S]*?)-->/;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const DECISIONS = ['fixed', 'declined', 'deferred'];
// The review steps, plus `review-1` and `review-2`: ids of records written before ADR 0001's single review.
const REVIEWS = [...require('./state-ops').REVIEW_PHASES, 'review-1', 'review-2'];

// What is wrong with a findings list, one message per problem, each starting with `at`: an
// array of {title, severity, found_by, decision}, found_by naming steps in `ids`. A review's
// findings may still lack a decision (they are then actionable); `decided` requires one, as the
// run record does.
function findingsProblems(findings, ids, { at = 'findings', decided = true } = {}) {
  if (!Array.isArray(findings)) return [`${at}: expected a JSON array`];
  const problems = [];
  findings.forEach((f, i) => {
    const where = `${at}[${i}]`;
    if (typeof f?.title !== 'string' || !f.title.trim()) problems.push(`${where}.title: required`);
    if (!SEVERITIES.includes(f?.severity)) problems.push(`${where}.severity: one of ${SEVERITIES.join(', ')}`);
    if ((decided || f?.decision !== undefined) && !DECISIONS.includes(f?.decision)) problems.push(`${where}.decision: one of ${DECISIONS.join(', ')}`);
    if (!Array.isArray(f?.found_by) || f.found_by.length === 0) problems.push(`${where}.found_by: at least one step id`);
    else for (const id of f.found_by) if (!ids.has(id)) problems.push(`${where}.found_by: no step ${JSON.stringify(id)} in the workflow`);
  });
  return problems;
}

// The record in a PR body, or a reason it has none usable.
function parseRecord(body) {
  const m = typeof body === 'string' ? body.match(MARK) : null;
  if (!m) return { kind: 'none' };
  let raw;
  try {
    raw = JSON.parse(m[1]);
  } catch {
    return { kind: 'invalid' };
  }
  if (typeof raw !== 'object' || raw === null || raw.version !== 1) return { kind: 'version', version: raw?.version };
  const steps = Array.isArray(raw.steps) ? raw.steps.filter((s) => s && typeof s.id === 'string') : [];
  const findings = Array.isArray(raw.findings)
    ? raw.findings.filter(
        (f) =>
          f && SEVERITIES.includes(f.severity) && DECISIONS.includes(f.decision) &&
          Array.isArray(f.found_by) && f.found_by.length > 0,
      )
    : [];
  return { kind: 'ok', record: { ...raw, steps, findings } };
}

// Who a review step was: its skill and its step model. In a record from before the step model
// contract, a step that ran (done or failed) has `null` there for the session's model, so it
// reads as `session_model` and counts with records that name that model. A step that did not
// run has no model: `unknown`.
function reviewerOf(record, stepId) {
  const step = record.steps.find((s) => s.id === stepId);
  const ran = step?.status === 'done' || step?.status === 'failed';
  const model = step?.model ?? (ran ? record.session_model ?? 'session' : 'unknown');
  return { skill: step?.skill ?? '(router)', model: step?.effort ? `${model}:${step.effort}` : model };
}

const bump = (map, key, field, by = 1) => {
  const row = map.get(key) ?? {};
  row[field] = (row[field] ?? 0) + by;
  map.set(key, row);
};

// Totals over records: per review (step id + model), per skill, per severity, usage.
function aggregate(records) {
  const reviewers = new Map();
  const skills = new Map();
  const severity = new Map();
  let tokens = 0;
  let tokenRuns = 0;
  let cost = 0;
  let costRuns = 0;
  const paths = new Map();
  const checklist = { runs: 0, points: 0, agent: 0, verifiedRuns: 0, passed: 0, failed: 0 };

  for (const r of records) {
    for (const s of r.steps) {
      if (s.skill) bump(skills, `${s.id} ${s.skill}`, s.status ?? 'unknown');
    }
    const path = r.path === 'light' || r.path === 'full' ? r.path : 'unknown';
    bump(paths, path, 'runs');
    for (const f of r.findings) {
      bump(paths, path, 'findings');
      if (f.severity === 'critical' || f.severity === 'high') bump(paths, path, 'serious');
      if (f.decision === 'fixed') bump(paths, path, 'fixed');
      bump(severity, f.severity, f.decision);
      for (const id of f.found_by) {
        const who = reviewerOf(r, id);
        const key = `${id} ${who.model}`;
        bump(reviewers, key, 'found');
        bump(reviewers, key, f.decision);
        if (f.found_by.length === 1) bump(reviewers, key, 'only');
        if (f.severity === 'critical' || f.severity === 'high') bump(reviewers, key, 'serious');
      }
    }
    // A review that ran and found nothing still counts as a run.
    for (const s of r.steps) {
      if (REVIEWS.includes(s.id) && s.status === 'done') bump(reviewers, `${s.id} ${reviewerOf(r, s.id).model}`, 'runs');
    }
    const c = r.checklist;
    if (c && Number.isFinite(c.points)) {
      checklist.runs += 1;
      checklist.points += c.points;
      checklist.agent += Number.isFinite(c.agent) ? c.agent : 0;
      if (Number.isFinite(c.passed) || Number.isFinite(c.failed)) {
        checklist.verifiedRuns += 1;
        checklist.passed += Number.isFinite(c.passed) ? c.passed : 0;
        checklist.failed += Number.isFinite(c.failed) ? c.failed : 0;
      }
    }
    if (Number.isFinite(r.usage?.tokens)) { tokens += r.usage.tokens; tokenRuns += 1; }
    if (Number.isFinite(r.usage?.cost_usd)) { cost += r.usage.cost_usd; costRuns += 1; }
  }
  return {
    runs: records.length,
    reviewers: Object.fromEntries([...reviewers].sort()),
    skills: Object.fromEntries([...skills].sort()),
    severity: Object.fromEntries(SEVERITIES.filter((s) => severity.has(s)).map((s) => [s, severity.get(s)])),
    paths: Object.fromEntries([...paths].sort()),
    checklist,
    usage: { tokens: tokenRuns ? tokens : null, tokenRuns, cost_usd: costRuns ? cost : null, costRuns },
  };
}

module.exports = { parseRecord, aggregate, findingsProblems, SEVERITIES, DECISIONS };
