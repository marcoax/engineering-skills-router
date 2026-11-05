import { expect, mock, test } from 'claude-code/testing'

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

test('/router-panel asks for a dock wide enough to read', async ($, on) => {
  seed(selecting, on)
  const opened: any[] = []
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })

  await $.command.run({ command: 'router-panel' } as any)

  const pane = opened.find(p => p.id === 'router')
  expect(pane?.columns).toBeGreaterThanOrEqual(60)
  expect(pane?.columns).toBeLessThanOrEqual(100)
  expect(pane?.rows).toBeGreaterThan(0)
})

test('a narrow pane wraps the steps instead of cutting words', async ($, on) => {
  const long = {
    ...selecting,
    steps: [
      { ...step('implementation', 'pending'), skill: 'addyosmani/incremental-implementation', summary: 'Single sort parser returning a list, multi-form query for list and export' },
    ],
  }
  seed(long, on)
  const ui = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns: 45 }, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^ {5}Single sort parser/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^ {5}multi-form query/ })).toBeTruthy()
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

test('a cross-family review runs codex read-only and returns its stdout', async ($, on) => {
  seed(null, on)
  const argvs: string[][] = []
  const opened: any[] = []
  on('ui.open', (_: unknown, e: any) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
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
  // The harness takes a tool result as a string or a content-block array, not an object.
  expect(typeof ran.result).toBe('string')
  expect(ran.result).toBe('Reviewed by codex · gpt-6-sol · high (router).\n\nNo blocking findings.')
  expect(ran.isError).toBe(undefined)
  expect(opened.find(p => p.id === 'review')?.columns).toBeGreaterThanOrEqual(60)
})

test('a cross-family review without a prompt checks the CLI and answers "available" as text', async ($, on) => {
  seed(null, on)
  const runs: string[][] = []
  on('process.run', (_: unknown, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: 'codex-cli 0.166.0\n', stderr: '' } }
  })

  const ran: any = await $.tool.call({ tool: TOOL, model: 'openai-codex/gpt-6-sol' } as any)

  expect(runs).toEqual([['codex', '--version']])
  expect(ran.result).toBe('available: codex · gpt-6-sol · default effort (router) (codex codex-cli 0.166.0)')
  expect(ran.isError).toBe(undefined)
})

test('a cross-family review reports a failing CLI as an error with readable text', async ($, on) => {
  seed(null, on)
  on('process.run', () => ({ value: { exitCode: 2, stdout: '', stderr: 'not logged in\n' } }))

  const ran: any = await $.tool.call({ tool: TOOL, model: 'openai-codex/gpt-6-sol' } as any)

  expect(ran.result).toBe('codex --version exited 2: not logged in')
  expect(ran.isError).toBe(true)
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

const MODELS = { ...PANE, requestId: 'models', surface: 'terminal' } as const
// What `opencode models` (v2.1.4) prints: one `provider/model` per line.
const OPENCODE_MODELS = 'opencode/claude-opus-5-5\nopencode/gemini-3.1-pro\n'

test('picking opencode lists its models in a select, default first, and saves the pick', async ($, on) => {
  const runs: string[][] = []
  on('process.run', (_: unknown, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: OPENCODE_MODELS, stderr: '' } }
  })
  const saved: any[] = []
  on('store.set', (_: unknown, e: any) => {
    saved.push(e.value)
    return { value: undefined }
  })

  const ui = await $.ui.mount(MODELS)
  await ui.select({ key: 'backend', value: 'opencode' })

  expect(runs).toEqual([['opencode', 'models']])
  const select = await ui.find({ type: 'Select', key: 'model' })
  expect((select?.props.options as any[]).map(o => o.value)).toEqual([
    'default',
    'opencode/claude-opus-5-5',
    'opencode/gemini-3.1-pro',
  ])
  await ui.select({ key: 'model', value: 'opencode/gemini-3.1-pro' })
  expect(saved.at(-1)).toEqual({ backend: 'opencode', model: 'opencode/gemini-3.1-pro', effort: '' })
  await ui.select({ key: 'model', value: 'default' })
  expect(saved.at(-1)).toEqual({ backend: 'opencode', model: '', effort: '' })
  await ui.unmount()
})

test('when opencode cannot list its models the pane keeps the text field with a note', async ($, on) => {
  // Fails, prints no models, or never ends (the run rejects at its timeout).
  const answers: (() => unknown)[] = [
    () => ({ value: { exitCode: 1, stdout: '', stderr: 'boom' } }),
    () => ({ value: { exitCode: 0, stdout: '\n', stderr: '' } }),
    () => {
      throw new Error('timed out')
    },
  ]
  let answer = answers[0]!
  on('process.run', () => answer() as any)
  for (answer of answers) {
    const ui = await $.ui.mount(MODELS)
    await ui.select({ key: 'backend', value: 'opencode' })

    expect((await ui.find({ key: 'model' }))?.type).toBe('Input')
    expect(await ui.find({ type: 'Text', text: /No model list from opencode models; type one\./ })).toBeTruthy()
    await ui.select({ key: 'backend', value: 'auto' })
    await ui.unmount()
  }
})

test('a saved model the list does not print stays shown and selectable', async ($, on) => {
  let isListing = false
  on('process.run', () =>
    isListing
      ? { value: { exitCode: 0, stdout: OPENCODE_MODELS, stderr: '' } }
      : { value: { exitCode: 1, stdout: '', stderr: 'offline' } },
  )
  on('ui.open', () => ({ value: { isPlaced: true } }))

  const ui = await $.ui.mount(MODELS)
  await ui.select({ key: 'backend', value: 'opencode' })
  await ui.input({ key: 'model', text: 'anthropic/claude-old' })
  isListing = true
  // Opening /router-models again lists them anew, now that it works.
  await $.command.run({ command: 'router-models' } as any)

  const select = await ui.find({ type: 'Select', key: 'model' })
  expect(select?.props.value).toBe('anthropic/claude-old')
  expect((select?.props.options as any[]).map(o => o.value)).toEqual([
    'default',
    'anthropic/claude-old',
    'opencode/claude-opus-5-5',
    'opencode/gemini-3.1-pro',
  ])
  await ui.unmount()
})

test('/router-models returns while opencode is still listing, and the list shows when it ends', async ($, on) => {
  let finish = (_: unknown) => {}
  const listing = new Promise(resolve => (finish = resolve))
  let calls = 0
  // The first listing fails; the one /router-models starts hangs until `finish`.
  on('process.run', () => (++calls === 1 ? { value: { exitCode: 1, stdout: '', stderr: 'offline' } } : (listing as any)))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  const ui = await $.ui.mount(MODELS)
  await ui.select({ key: 'backend', value: 'opencode' })
  const returned = await Promise.race([
    $.command.run({ command: 'router-models' } as any).then(() => 'returned'),
    new Promise(resolve => setTimeout(() => resolve('waiting'), 1_000)),
  ])

  expect(returned).toBe('returned')
  expect(await ui.find({ type: 'Text', text: /Listing models…/ })).toBeTruthy()
  finish({ value: { exitCode: 0, stdout: OPENCODE_MODELS, stderr: '' } })
  let select
  for (let i = 0; i < 50 && !select; i++) {
    await new Promise(resolve => setTimeout(resolve, 20))
    select = await ui.find({ type: 'Select', key: 'model' })
  }
  expect(select).toBeTruthy()
  await ui.unmount()
})

test('codex keeps the text field and runs no list command', async ($, on) => {
  const runs: string[][] = []
  on('process.run', (_: unknown, e: any) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: OPENCODE_MODELS, stderr: '' } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))

  const ui = await $.ui.mount(MODELS)
  await ui.select({ key: 'backend', value: 'codex' })
  await $.command.run({ command: 'router-models' } as any)

  expect((await ui.find({ key: 'model' }))?.type).toBe('Input')
  expect(await ui.find({ type: 'Text', text: /Listing models…|No model list/ })).toBeFalsy()
  expect(runs).toEqual([])
  await ui.unmount()
})

const BAND = { plugin: 'engineering-router-panel', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false } } as const

// A session that starts with `text` as the state file; `write` changes the file afterwards.
async function startWith($: any, on: any, text: string) {
  let file = text
  on('fs.read', () => ({ value: file }))
  const clock = mock.clock(on)
  on('command.register', () => ({ value: undefined }))
  on('tool.register', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: any) => e)
  await $.session.start({ cwd: '/repo' } as any)
  // Another session writes the file; the poll reads it a second later.
  return async (next: string) => {
    file = next
    await clock.advance(1000)
  }
}

const runningElsewhere = JSON.stringify({ version: 1, ...selecting, task: '#956 Admin SEO', status: 'running' })

test('a workflow running at session start shows only a frozen line until /engineering-router', async ($, on) => {
  on('prompt.submit', (_: unknown, e: any) => ({ text: e.text }))
  const write = await startWith($, on, runningElsewhere)
  await write(runningElsewhere.replace('"status":"pending"', '"status":"done"'))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  const line = 'router · running elsewhere · #956 Admin SEO — /engineering-router to resume'
  expect(await ui.find({ type: 'Text', text: line })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /1\. specification/ })).toBeFalsy()
  await ui.unmount()

  await $.prompt.submit({ text: '/engineering-router' } as any)
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await after.find({ type: 'Text', text: /1\. specification/ })).toBeTruthy()
  expect(await after.find({ type: 'Text', text: /elsewhere/ })).toBeFalsy()
  await after.unmount()
})

test('/router-panel takes up a workflow found running at session start', async ($, on) => {
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await startWith($, on, runningElsewhere)
  await $.command.run({ command: 'router-panel' } as any)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await ui.find({ type: 'Text', text: /1\. specification/ })).toBeTruthy()
  await ui.unmount()
})

// The state records its owner (ADR 0002): the session that owns it sees it at once.
const ownedBy = (session: string) =>
  JSON.stringify({ version: 1, ...selecting, task: '#956 Admin SEO', status: 'running', owner: { session, since: '2026-10-17T09:30:00Z' } })

test('a workflow this session owns shows in full at session start', async ($, on) => {
  on('session.id', () => ({ value: 'cc-owner' }))
  await startWith($, on, ownedBy('cc-owner'))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await ui.find({ type: 'Text', text: /1\. specification/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /elsewhere/ })).toBeFalsy()
  await ui.unmount()
})

test('a workflow another session owns shows only the frozen line at session start', async ($, on) => {
  on('session.id', () => ({ value: 'cc-other' }))
  await startWith($, on, ownedBy('cc-owner'))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as any)
  expect(await ui.find({ type: 'Text', text: /elsewhere/ })).toBeTruthy()
  await ui.unmount()
})
