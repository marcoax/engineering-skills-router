// Personal reminders only: never step results, findings or verification evidence.
const { token } = require('./run-files');

function set(state, items) {
  if (!state.run) throw new Error('manual checklist needs a run id (compose --new)');
  if (!Array.isArray(items) || items.length > 15) throw new Error('manual checklist must be an array of at most 15 points');
  const seen = new Set();
  const manual_checklist = items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some((k) => !['action', 'expected'].includes(k))
      || !['action', 'expected'].every((k) => typeof item[k] === 'string' && item[k].trim()))
      throw new Error('manual checklist points need only nonempty action and expected strings');
    const key = JSON.stringify([item.action, item.expected]);
    if (seen.has(key)) throw new Error('duplicate manual checklist point');
    seen.add(key);
    const old = state.manual_checklist?.find((p) => p.action === item.action && p.expected === item.expected);
    return old ?? { id: token(8), ...item, checked: false };
  });
  return { ...state, manual_checklist };
}

function check(state, run, id, value) {
  if (!run || state.run !== run) throw new Error('manual checklist intent is for another run');
  if (!['on', 'off'].includes(value)) throw new Error('manual checklist choice must be on or off');
  if (!state.manual_checklist?.some((p) => p.id === id)) throw new Error('manual checklist point no longer exists; refresh the panel');
  return { ...state, manual_checklist: state.manual_checklist.map((p) => p.id === id ? { ...p, checked: value === 'on' } : p) };
}

module.exports = { set, check };
