import { expect, test } from 'claude-code/testing'

import { planRun, resolveBackend } from './backends.ts'

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
    const values: Record<string, unknown> = {
      state: value,
      selected: 0,
      confirmStop: false,
      isHidden: false,
      review: null,
      choice: { backend: 'auto', model: '', effort: '' },
    }
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

test('the backend comes from the model prefix, and the pane choice wins', async () => {
  expect(resolveBackend('openai-codex/gpt-6-sol')?.backend.name).toBe('codex')
  expect(resolveBackend('opencode/openai/gpt-6')?.model).toBe('openai/gpt-6')
  expect(resolveBackend('codex')?.model).toBe(undefined)
  expect(resolveBackend('anthropic/x')).toBe(undefined)

  const auto = { backend: 'auto', model: '', effort: '' } as const
  const fromRouter = planRun(auto, { model: 'openai-codex/gpt-6-sol', effort: 'medium' })
  expect([fromRouter?.backend.name, fromRouter?.model, fromRouter?.effort]).toEqual(['codex', 'gpt-6-sol', 'medium'])

  const picked = planRun({ backend: 'opencode', model: '', effort: 'high' }, { model: 'openai-codex/gpt-6-sol' })
  // opencode on its own default model; it takes no effort flag.
  expect([picked?.backend.name, picked?.model, picked?.effort]).toEqual(['opencode', undefined, undefined])

  const defaults = planRun({ backend: 'codex', model: '', effort: '' }, {})
  expect(defaults?.backend.argv('p', defaults.model, defaults.effort)).toEqual(['codex', 'exec', '--sandbox', 'read-only', 'p'])
})

const TOOL = 'mcp__engineering-router-panel__review_other_family'

test('review 2 runs codex read-only and returns its stdout', async ($, on) => {
  seed(null, on)
  const argvs: string[][] = []
  on('ui.open', () => ({ value: { isPlaced: true } }))
  // The stand-in for the engine: yields the chunks, then answers the result as { value }.
  on('process.spawn', async function* (_: unknown, e: any, _next: unknown) {
    argvs.push([...e.argv])
    yield { stream: 'stderr', text: 'thinking…\n' }
    yield { stream: 'stdout', text: 'No blocking findings.' }
    return { value: { code: 0, signal: null } }
  } as any)

  const ran: any = await $.tool.call({
    tool: TOOL,
    model: 'openai-codex/gpt-6-sol',
    effort: 'high',
    prompt: 'Review the diff',
  } as any)

  expect(argvs).toEqual([
    ['codex', 'exec', '--sandbox', 'read-only', '-m', 'gpt-6-sol', '-c', 'model_reasoning_effort="high"', 'Review the diff'],
  ])
  expect(String(ran.result?.text)).toContain('No blocking findings.')
  expect(ran.isError).toBe(undefined)
})

test('the models pane saves the picked backend', async ($, on) => {
  seed(null, on)
  const saved: unknown[] = []
  on('store.set', (_: unknown, e: any) => {
    saved.push(e.value)
    return { value: undefined }
  })

  const ui = await $.ui.mount({ ...PANE, requestId: 'models', surface: 'terminal' })
  await ui.select({ key: 'backend', value: 'codex' })
  expect(saved).toEqual([{ backend: 'codex', model: '', effort: '' }])
  await ui.unmount()
})
