import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'engineering-router-panel',
  component: 'Pane',
  requestId: 'router',
  props: {
    title: 'Router',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const step = (id: string, status: string, alternatives: { skill: string; reason: string }[] = []) => ({
  id,
  phases: [id],
  skill: `acme/${id}`,
  reason: 'why',
  summary: `do ${id}`,
  alternatives,
  confirm: false,
  optional: false,
  covered_by: null,
  model: null,
  status,
  outcome: null,
})

const selecting = {
  task: 'Add CSV export',
  type: 'feature',
  risk: 'medium',
  properties: [],
  status: 'selecting',
  steps: [step('specification', 'pending', [{ skill: 'acme/alt', reason: 'other' }]), step('implementation', 'pending')],
  handoff: { issue: null, spec: null, tickets: [], branch: null, base_commit: null, pr: null },
}

// Answers `state.get` for each of the router's own keys.
const seed = (value: unknown, on: any) =>
  on('state.get', (_: unknown, e: any) => {
    const values: Record<string, unknown> = { state: value, selected: 0, confirmStop: false, isHidden: false }
    return { value: { value: values[e.key] } }
  })

test('the pane lists the steps and go sends "go"', async ($, on) => {
  seed(selecting, on)
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /1\. specification/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /2\. implementation/ })).toBeTruthy()
  await ui.press({ key: 'go' })
  expect(sent).toEqual(['go'])
  await ui.unmount()
})

test('swap a on the first step sends "1a"', async ($, on) => {
  seed(selecting, on)
  const sent: string[] = []
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  await ui.press({ key: 'swap-a' })
  expect(sent).toEqual(['1a'])
  await ui.unmount()
})
