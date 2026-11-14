// The JSON an agent hands over in a text: its last ```json block (a selector's proposal, a
// reviewer's answer, saved as they came), or null when the text has none.
function lastJsonBlock(text) {
  return [...text.matchAll(/```json\s*\n([\s\S]*?)```/g)].at(-1)?.[1] ?? null;
}

module.exports = { lastJsonBlock };
