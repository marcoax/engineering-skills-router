// The classification policy (skills/engineering-router/classification.md) as constraints over
// explicit facts: the policy revision, each fact's minimum risk, and what §1 may offer. Judging the
// task stays with the model; this only checks a classification it wrote down. Pure: the same
// classification under the same policy gives the same result, and the task's wording is never read.
const fs = require('node:fs');
const path = require('node:path');

const POLICY_MD = path.resolve(__dirname, '../../skills/engineering-router/classification.md');
const RISKS = ['low', 'medium', 'high'];
const REQUESTS = ['direct', 'light', 'full'];

// The table rows of the `## <name>` section, as trimmed cells; header and rule rows left out.
const tableRows = (text, name) => {
  const section = text.split(/^## /m).find((s) => s.startsWith(`${name}\n`)) ?? '';
  return section.split('\n').filter((l) => l.startsWith('|')).slice(2)
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
};

// The whole policy, read from classification.md so the check cannot diverge from it:
// { revision, types, facts: { name: minimum risk }, offers: [{ risk, complexity, ticket, offer, proposed }] }.
// An Offers cell left empty, `any` or `any other` matches every value; the first matching row applies.
function policy() {
  const text = fs.readFileSync(POLICY_MD, 'utf8');
  const revision = Number(text.match(/^# .*policy (\d+)/m)[1]);
  const types = [...(text.match(/^- \*\*type\*\*: .*$/m)?.[0] ?? '').matchAll(/`([\w-]+)`/g)].map((m) => m[1]);
  const facts = {};
  for (const [name, minimum] of tableRows(text, 'Facts')) facts[name.replace(/`/g, '')] = minimum;
  const anyOf = (cell) => (['', 'any', 'any other'].includes(cell) ? null : cell);
  const offers = tableRows(text, 'Offers').map(([risk, complexity, ticket, offer]) => {
    const paths = offer.split(/,| or /).map((p) => p.trim()).filter(Boolean);
    return {
      risk: anyOf(risk), complexity: anyOf(complexity), ticket: anyOf(ticket) === null ? null : ticket === 'yes',
      offer: paths.map((p) => p.replace(/ \(proposed\)$/, '')),
      proposed: paths.find((p) => p.endsWith('(proposed)'))?.replace(/ \(proposed\)$/, '') ?? null,
    };
  });
  return { revision, types, facts, offers };
}

const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const rank = (risk) => RISKS.indexOf(risk);

// What the policy allows for a classification `c` (type, risk, complexity, path, requested and
// classification: {policy, ticket, facts, rationale, uncertain}):
// { errors, minimum, because: facts setting it, offer: paths, proposed, reason: what chose the offer, uncertain }.
// `kept` skips the revision check: a run keeps the policy it was classified under.
function evaluate(c, { kept = false } = {}) {
  const { revision, types, facts: known, offers } = policy();
  const errors = [];
  const k = c?.classification;
  if (typeof k !== 'object' || k === null) return { errors: ['classification: missing'], revision };
  if (!kept && k.policy !== revision) errors.push(`classification.policy: must be ${revision} (the current policy), got ${JSON.stringify(k.policy)}`);
  if (!types.includes(c.type)) errors.push(`type: must be one of ${types.join(' | ')}, got ${JSON.stringify(c.type)}`);
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
  const row = offers.find((o) => [null, c.risk].includes(o.risk) && [null, c.complexity].includes(o.complexity)
    && (o.ticket === null || o.ticket === k.ticket)) ?? { offer: ['full'], proposed: null };
  const { offer, proposed } = row;
  const why = `risk ${c.risk}, complexity ${c.complexity}, ${k.ticket ? 'a ticket' : 'not a ticket'}`;
  if (c.requested != null && !REQUESTS.includes(c.requested)) errors.push(`requested: must be ${REQUESTS.join(' | ')} or null, got ${JSON.stringify(c.requested)}`);
  else if (c.requested != null && !offer.includes(c.requested)) errors.push(`requested ${c.requested} is not offered (${why}): offer ${offer.join(', ')}`);
  if (c.path != null && !(offer.includes(c.path) && c.path !== 'direct')) errors.push(`path ${c.path} is not offered (${why}): offer ${offer.join(', ')}`);
  const uncertain = Array.isArray(k.uncertain) ? k.uncertain.filter(isStr) : [];
  const recorded = [...new Set(facts.map((f) => f.fact))];
  const reason = `${why}, ${recorded.length ? `facts ${recorded.join(', ')}` : 'no recorded facts'}`;
  return { errors, revision, minimum, because, offer, proposed, reason, uncertain };
}

module.exports = { policy, evaluate };
