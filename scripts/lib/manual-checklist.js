// The manual checklist (state.md, Checklist point).
const { token } = require('./run-files');

const MAX_POINTS = 15;

// The rules state.md states in prose; field types are checked by the caller.
function manualChecklistErrors(points) {
  const errors = [];
  if (points.length > MAX_POINTS) errors.push(`manual_checklist: at most ${MAX_POINTS} points`);
  const ids = new Set();
  const contents = new Set();
  points.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    for (const k of ['id', 'action', 'expected']) if (typeof p[k] === 'string' && !p[k].trim()) errors.push(`manual_checklist[${i}].${k}: must be nonempty`);
    if (ids.has(p.id)) errors.push(`manual_checklist[${i}].id: duplicate id`);
    ids.add(p.id);
    const content = JSON.stringify([p.action, p.expected]);
    if (contents.has(content)) errors.push(`manual_checklist[${i}]: duplicate content`);
    contents.add(content);
  });
  return errors;
}

// What `checklist set` reads: the JSON array of points, or the checklist's own lines, one point
// per line as "action → expected"; list markers, numbering, task boxes and the [agent]/[you]
// tags are dropped, and the last arrow splits action from expected.
const TAGS = ['agent', 'you'];
const LINE_PREFIX = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?/;
// A tag as a token of its own, bare, in bold or in code.
const TAG = new RegExp(`(?:^|\\s+)(\\*\\*|\`)?\\[(?:${TAGS.join('|')})\\]\\1(?=\\s|$)`, 'g');

function checklistInput(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (/^\s*\[\s*\{/.test(text)) throw new Error(`checklist JSON: ${error.message}`);
  }
  return text.split('\n').flatMap((line, i) => {
    if (!line.trim()) return [];
    const point = line.replace(LINE_PREFIX, '').replace(TAG, '');
    const arrow = point.lastIndexOf('→');
    const action = point.slice(0, Math.max(arrow, 0)).trim();
    const expected = point.slice(arrow + 1).trim();
    if (arrow < 0 || !action || !expected) throw new Error(`checklist line ${i + 1} is not "action → expected": ${line.trim()}`);
    return [{ action, expected }];
  });
}

function setManualChecklist(state, items) {
  if (!state.run) throw new Error('manual checklist needs a run id (compose --new)');
  if (!Array.isArray(items) || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item)
    || Object.keys(item).some((k) => !['action', 'expected'].includes(k))
    || !['action', 'expected'].every((k) => typeof item[k] === 'string')))
    throw new Error('manual checklist must be an array of checklist points with only action and expected strings');
  const manual_checklist = items.map((item) =>
    state.manual_checklist?.find((p) => p.action === item.action && p.expected === item.expected)
      ?? { id: token(8), ...item, checked: false });
  const [error] = manualChecklistErrors(manual_checklist);
  if (error) throw new Error(error);
  return { ...state, manual_checklist };
}

function checkChecklistPoint(state, run, id, value) {
  if (!run || state.run !== run) throw new Error('checklist point intent is for another run');
  if (!['on', 'off'].includes(value)) throw new Error('checklist point choice must be on or off');
  if (!state.manual_checklist?.some((p) => p.id === id)) throw new Error('checklist point no longer exists; refresh the panel');
  return { ...state, manual_checklist: state.manual_checklist.map((p) => p.id === id ? { ...p, checked: value === 'on' } : p) };
}

module.exports = { manualChecklistErrors, checklistInput, setManualChecklist, checkChecklistPoint };
