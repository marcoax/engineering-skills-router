// The classification policy (skills/engineering-router/classification.md) as constraints over
// explicit facts: the policy revision, each fact's minimum risk, and what §1 may offer. Judging the
// task stays with the model; this only checks a classification it wrote down. Pure: the same
// classification under the same policy gives the same result, and the task's wording is never read.
const fs = require('node:fs');
const path = require('node:path');

const POLICY_MD = path.resolve(__dirname, '../../skills/engineering-router/classification.md');
const RISKS = ['low', 'medium', 'high'];
const TYPES = ['bug', 'feature', 'refactor', 'architecture', 'performance', 'security', 'documentation',
  'investigation', 'prototype', 'review', 'maintenance'];
const REQUESTS = ['direct', 'light', 'full'];

// { revision, facts: { name: minimum risk } }, read from classification.md's title and Fact table.
function policy() {
  const text = fs.readFileSync(POLICY_MD, 'utf8');
  const revision = Number(text.match(/^# .*policy (\d+)/m)[1]);
  const facts = {};
  for (const [, name, minimum] of text.matchAll(/^\| `([\w-]+)` \| (low|medium|high) \|/gm)) facts[name] = minimum;
  return { revision, facts };
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const rank = (risk) => RISKS.indexOf(risk);

// What the policy allows for a classification `c` (type, risk, complexity, path, requested and
// classification: {policy, ticket, facts, rationale, uncertain}):
// { errors, minimum, because: facts setting it, offer: paths, proposed, uncertain }.
// `kept` skips the revision check: a run keeps the policy it was classified under.
function evaluate(c, { kept = false } = {}) {
  const { revision, facts: known } = policy();
  const errors = [];
  const k = c?.classification;
  if (typeof k !== 'object' || k === null) return { errors: ['classification: missing'], revision };
  if (!kept && k.policy !== revision) errors.push(`classification.policy: must be ${revision} (the current policy), got ${JSON.stringify(k.policy)}`);
  if (!TYPES.includes(c.type)) errors.push(`type: must be one of ${TYPES.join(' | ')}, got ${JSON.stringify(c.type)}`);
  for (const key of ['risk', 'complexity'])
    if (!RISKS.includes(c[key])) errors.push(`${key}: must be ${RISKS.join(' | ')}, got ${JSON.stringify(c[key])}`);
  if (typeof k.ticket !== 'boolean') errors.push('classification.ticket: must be true or false');
  for (const key of ['type', 'risk', 'complexity'])
    if (!isStr(k.rationale?.[key])) errors.push(`classification.rationale.${key}: needs a reason`);
  const facts = Array.isArray(k.facts) ? k.facts : [];
  if (!Array.isArray(k.facts)) errors.push('classification.facts: must be a list (empty when no fact holds)');
  let minimum = 'low';
  const because = [];
  facts.forEach((f, i) => {
    const at = `classification.facts[${i}]`;
    if (!Object.hasOwn(known, f?.fact)) return errors.push(`${at}: unknown fact ${JSON.stringify(f?.fact)} (policy ${revision}: ${Object.keys(known).join(', ')})`);
    if (!isStr(f.where) || !isStr(f.evidence)) return errors.push(`${at}: ${f.fact} needs where (task or an inspected file) and evidence`);
    if (rank(known[f.fact]) > rank(minimum)) { minimum = known[f.fact]; because.length = 0; }
    if (known[f.fact] === minimum && minimum !== 'low') because.push(f);
  });
  if (errors.length) return { errors, revision };
  if (rank(c.risk) < rank(minimum)) {
    for (const f of because) errors.push(`risk ${c.risk} is below the minimum ${minimum} set by ${f.fact} (${f.where}: ${f.evidence})`);
    return { errors, revision, minimum, because };
  }
  const offer = c.risk === 'low' ? ['direct', ...(k.ticket ? ['light'] : []), 'full']
    : c.risk === 'medium' && c.complexity === 'low' && k.ticket ? ['light', 'full'] : ['full'];
  const proposed = offer.length === 2 && offer[0] === 'light' ? 'light' : null;
  const why = `risk ${c.risk}, complexity ${c.complexity}, ${k.ticket ? 'a ticket' : 'not a ticket'}`;
  if (c.requested != null && !REQUESTS.includes(c.requested)) errors.push(`requested: must be ${REQUESTS.join(' | ')} or null, got ${JSON.stringify(c.requested)}`);
  else if (c.requested != null && !offer.includes(c.requested)) errors.push(`requested ${c.requested} is not offered (${why}): offer ${offer.join(', ')}`);
  if (c.path != null && !(offer.includes(c.path) && c.path !== 'direct')) errors.push(`path ${c.path} is not offered (${why}): offer ${offer.join(', ')}`);
  const uncertain = Array.isArray(k.uncertain) ? k.uncertain.filter(isStr) : [];
  return { errors, revision, minimum, because, offer, proposed, uncertain };
}

module.exports = { policy, evaluate };
