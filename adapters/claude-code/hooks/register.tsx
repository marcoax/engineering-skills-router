// Claude Code adapter for the engineering router: shows `.router/state.json` of the
// session's working directory as a band above the prompt and a pane with the skill
// selection. It never writes the state file; choices go to the agent as prompts in the
// router's own selection syntax (`go`, `2b`, `5on`, `pause`, ...).
import { atom, read, update } from 'claude-code'
import { completedStep, configLine, contextLine } from './context-boundary.ts'
import type { EngineInterface, Register, RouterReview } from 'claude-code'

import {
  currentStep,
  detailLines,
  foreignLine,
  hiddenAtStart,
  invokesRouter,
  isClosed,
  isForeignAtStart,
  KEYS,
  parseState,
  replyFor,
  runsStateScript,
  STATE_FILE,
  symbol,
  widgetLines,
} from './state-core.ts'
import type { Choice } from './state-core.ts'
import { asChoice, BACKENDS, backendNamed, parseModelList, planRun } from './backends.ts'
import type { Choice as ReviewChoice, Plan } from './backends.ts'

const PANE = 'router'
const REVIEW_PANE = 'review'
const MODELS_PANE = 'models'
const REVIEW_TOOL = 'mcp__engineering-router-panel__review_other_family'
// What the review pane keeps of a run's output: its tail.
const KEEP = 200_000

// The harness takes a tool's result as a string (or content blocks), not an object.
const ok = (text: string) => ({ result: text })
const fail = (text: string) => ({ result: text, isError: true as const })

// The size a pane asks for: docked, a share of the terminal wide enough for skill ids and
// summaries; inline, enough rows for a few steps. Requests: a size the person set wins.
const paneColumns = (terminal: number) => Math.min(100, Math.max(60, Math.round(terminal * 0.45)))
const PANE_ROWS = 24

const review = atom({ plugin: 'engineering-router-panel', key: 'review' } as const, null)
const choice = atom(
  { plugin: 'engineering-router-panel', key: 'choice' } as const,
  { backend: 'auto', model: '', effort: '' },
)

// What each backend's list command printed, by backend name (see listModels).
const models = atom({ plugin: 'engineering-router-panel', key: 'models' } as const, {})

// The models pane's selects show the CLI's own default, saved as '', as `default`.
const DEFAULT = 'default'
const DEFAULT_OPTION = { value: DEFAULT, label: DEFAULT }
const shownAs = (saved: string) => saved || DEFAULT
const savedAs = (value: string) => (value === DEFAULT ? '' : value)

const describePlan = (plan: Plan) =>
  `${plan.backend.name} · ${plan.model ?? 'default model'} · ${
    plan.backend.hasEffort ? (plan.effort ?? 'default effort') : 'effort from its config'
  } (${plan.source})`

const state = atom({ plugin: 'engineering-router-panel', key: 'state' } as const, null)
const selected = atom({ plugin: 'engineering-router-panel', key: 'selected' } as const, 0)
const confirmStop = atom({ plugin: 'engineering-router-panel', key: 'confirmStop' } as const, false)
const isHidden = atom({ plugin: 'engineering-router-panel', key: 'isHidden' } as const, false)
const foreign = atom({ plugin: 'engineering-router-panel', key: 'foreign' } as const, null)
const INVOCATION = '/engineering-router'
// This session takes up the workflow: from here the band and pane follow the file.
const takeUp = ($: EngineInterface) => update($, foreign, () => null)

// Lists the models of a backend that has a list command, once it has listed some: a
// failure, a timeout or an empty list is kept as none, and asked again the next time.
// While it runs the backend has no entry, so the pane says it is listing.
async function listModels($: EngineInterface, name: string) {
  const backend = backendNamed(name)
  if (!backend?.modelsArgv || (await read($, models))[name]?.length) return
  await update($, models, ({ [name]: _, ...rest }) => rest)
  let ids: string[] = []
  try {
    const run = await $.process.run(backend.modelsArgv, { timeoutMs: 15_000 })
    if (run.exitCode === 0) ids = parseModelList(run.stdout)
  } catch {
    // Not installed, or still running at the timeout: the text field stands.
  }
  await update($, models, m => ({ ...m, [name]: ids }))
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (invokesRouter(e.text) || /(^|:)engineering-router$/.test(e.command?.name ?? '')) await takeUp($)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (runsStateScript(e.command)) await takeUp($)
    const outcome = await next(e)
    if ('deny' in outcome || outcome.isError || !outcome.result || typeof outcome.result !== 'object') return outcome
    const result = outcome.result
    if (result.interrupted || result.backgroundTaskId || typeof result.stdout !== 'string') return outcome
    const bridge = completedStep(e.command, result.stdout)
    if (!bridge) return outcome
    try {
      const pref = await $.process.run(['node', bridge], { timeoutMs: 5000 })
      let line: string | undefined
      if (pref.exitCode !== 0) line = configLine(pref.stderr)
      else {
        const threshold = Number(pref.stdout.trim())
        if (threshold === 0) return outcome
        const usage = await $.session.usage()
        line = contextLine(usage.context.tokens, usage.context.window, threshold)
      }
      if (line) return {
        result: { ...result, stdout: result.stdout + (result.stdout.endsWith('\n') ? '' : '\n') + line + '\n' },
        context: outcome.context,
        isReadOnly: outcome.isReadOnly,
      }
    } catch {
      // The completed state change stands even when usage/preferences are unavailable.
    }
    return outcome
  })
  // The last text read, so a poll that finds the same file redraws nothing.
  let last: string | undefined
  let isFirstRead = true
  let timer: { cancel: () => void } | undefined
  // The terminal's width as the last drawing measured it, for panes a tool opens.
  let terminalColumns = 80

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router-panel',
      description: 'Toggle the engineering router pane',
    })

    const refresh = async () => {
      let text = ''
      try {
        const got = await $.fs.read(STATE_FILE)
        text = typeof got === 'string' ? got : ''
      } catch {
        text = ''
      }
      if (text === last) return
      last = text

      const parsed = text ? parseState(text) : undefined
      const fresh = parsed?.kind === 'ok' ? parsed.state : null
      if (isFirstRead && fresh) {
        await update($, isHidden, () => hiddenAtStart(fresh))
        if (isForeignAtStart(fresh)) await update($, foreign, () => foreignLine(fresh, INVOCATION))
      } else if (fresh && !isClosed(fresh)) await update($, isHidden, () => false)
      // A workflow removed (discarded) frees the next one from the start-of-session line.
      if (!text) await takeUp($)
      isFirstRead = false

      const before = await read($, state)
      await update($, state, () => fresh)
      if (fresh && before && fresh.status !== before.status) {
        await update($, confirmStop, () => false)
      }
      if (fresh) {
        await update($, selected, i => Math.min(i, Math.max(0, fresh.steps.length - 1)))
      }
    }

    timer?.cancel()
    await refresh()
    // Polling stat-by-read works before `.router/` exists and across whole-file rewrites.
    timer = $.clock.every(1000, () => void refresh())

    await $.tool.register({
      name: 'review_other_family',
      isDeferred: false,
      description:
        'Runs a prompt on a model outside the Claude family through a local CLI, read-only, ' +
        'and returns its answer; the output streams into a "Cross-family review" pane. For the engineering ' +
        "router's cross-family reviews. `model` is as the user's preferences.yaml (scripts/config) names it: `openai-codex/<model>` " +
        'runs Codex, `opencode/<provider>/<model>` runs opencode; `effort` is low, medium or high. ' +
        'What the person picked with /router-models overrides both. Without `prompt` it only ' +
        'checks that the backend is installed and says which backend, model and effort would run.',
      inputSchema: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'e.g. openai-codex/gpt-6-sol' },
          effort: { type: 'string', enum: ['low', 'medium', 'high'] },
          prompt: { type: 'string', description: 'The whole review instruction; omit to check availability' },
          cwd: { type: 'string', description: 'Target repo; the session directory by default' },
        },
      },
    })
    await $.command.register({
      name: 'router-models',
      description: 'Pick the backend, model and effort of the router cross-family reviews',
    })
    await update($, choice, () => asChoice(undefined))
    try {
      const saved = asChoice(await $.store.get('review-choice'))
      await update($, choice, () => saved)
    } catch {
      // No store: the defaults stand.
    }

    return next(e)
  })

  // A cross-family review: one CLI run, streamed into the review pane.
  on('tool.call', { tool: REVIEW_TOOL }, async ($, e, next) => {
    const input = e as unknown as { model?: unknown; effort?: unknown; prompt?: unknown; cwd?: unknown }
    const asked = {
      model: typeof input.model === 'string' ? input.model : undefined,
      effort: typeof input.effort === 'string' ? input.effort : undefined,
    }
    const prompt = typeof input.prompt === 'string' ? input.prompt : ''
    const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : undefined
    const known = BACKENDS.map(b => `${b.prefixes[0]}/<model>`).join(', ')

    const plan = planRun(await read($, choice), asked)
    if (!plan) {
      return fail(`No backend for model "${asked.model ?? ''}" and none picked in /router-models. Known: ${known}.`)
    }
    const { backend } = plan
    const label = describePlan(plan)

    if (!prompt) {
      try {
        const run = await $.process.run([backend.cli, '--version'], { cwd, timeoutMs: 15_000 })
        if (run.exitCode !== 0) return fail(`${backend.cli} --version exited ${run.exitCode}: ${run.stderr.trim()}`)
        return ok(`available: ${label} (${backend.cli} ${run.stdout.trim()})`)
      } catch (err) {
        return fail(`${backend.cli} not found or not runnable: ${String(err)}`)
      }
    }

    await update($, review, () => ({ model: label, backend: backend.name, status: 'running', text: '' }))
    void $.ui.open({
      id: REVIEW_PANE,
      title: `Cross-family review · ${backend.name}`,
      columns: paneColumns(terminalColumns),
      rows: PANE_ROWS,
    })

    const setStatus = (status: RouterReview['status']) =>
      update($, review, r => (r ? { ...r, status } : r))

    let out = ''
    let all = ''
    let code: number | null = null
    try {
      const child = $.process.spawn({ argv: backend.argv(prompt, plan.model, plan.effort), cwd })
      // The pieces, then how the child ended as the stream's return value.
      for (let step = await child.next(); ; step = await child.next()) {
        if (step.done) {
          code = step.value.code
          break
        }
        if (next.signal.aborted) {
          await child.return?.(undefined as never)
          break
        }
        if (step.value.stream === 'stdout') out += step.value.text
        all = (all + step.value.text).slice(-KEEP)
        const text = all
        await update($, review, r => (r ? { ...r, text } : r))
      }
    } catch (err) {
      await setStatus('failed')
      return fail(`${backend.cli} could not start: ${String(err)}`)
    }

    const isOk = code === 0 && !next.signal.aborted
    await setStatus(isOk ? 'done' : 'failed')
    if (!isOk) return fail(`${backend.cli} ended with ${next.signal.aborted ? 'an interrupt' : `exit ${code}`}:\n${all.slice(-4000)}`)
    // Codex and opencode write the answer to stdout and their progress to stderr.
    return ok(`Reviewed by ${label}.\n\n${(out.trim() || all).slice(-KEEP)}`)
  }).catch(($, e, next) =>
    next.called ? next(e) : fail('review_other_family failed inside the mod; see claude --debug'),
  )

  on('ui.render', { component: 'Pane', requestId: REVIEW_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, review)
    if (r === null) return <Text dimColor>No review has run yet.</Text>

    const room = Math.max(4, (e.viewport?.rows ?? 30) - 3)
    const tail = r.text.split('\n').slice(-room)

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {r.status === 'running' ? '▶' : r.status === 'done' ? '✓' : '✗'} {r.model} · {r.status}
        </Text>
        {tail.map(line => (
          <Text>{line}</Text>
        ))}
      </Box>
    )
  })

  on('command.run', { command: 'router-models' }, async $ => {
    await $.ui.open({ id: MODELS_PANE, title: 'Cross-family review model', focus: true, closeOnEscape: true })
    // In the background: a hung list command must not hold the command up.
    void listModels($, (await read($, choice)).backend)
    return { text: 'Cross-family review model pane opened.' }
  })

  // Backend, model and effort of the cross-family reviews; empty means the CLI's own default.
  on('ui.render', { component: 'Pane', requestId: MODELS_PANE }, async ($, e) => {
    const c = await read($, choice)
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text>Cross-family review: {c.backend} · {shownAs(c.model)} · {shownAs(c.effort)} (change it from a computer)</Text>
    }
    const { Box, Button, Input, Select, Text } = $.ui.resolve(e)
    const save = async (fn: (c: ReviewChoice) => ReviewChoice) => {
      const nextChoice = asChoice(fn(await read($, choice)))
      await update($, choice, () => nextChoice)
      try {
        await $.store.set('review-choice', nextChoice)
      } catch {
        // Kept for this session only.
      }
    }
    const backend = c.backend === 'auto' ? undefined : backendNamed(c.backend)
    // The models its list command printed: undefined while not listed yet.
    const listed = backend?.modelsArgv ? (await read($, models))[backend.name] : undefined
    const preview =
      c.backend === 'auto'
        ? `as the router asks (the user's preferences.yaml)${c.effort ? `, effort ${c.effort}` : ''}`
        : `${c.backend} · ${c.model || 'its default model'} · ${
            backend?.hasEffort ? c.effort || 'its default effort' : 'effort from its config'
          }`
    // A saved model the list no longer prints stays shown and selectable.
    const modelOptions = listed?.length
      ? [DEFAULT_OPTION, ...(c.model && !listed.includes(c.model) ? [c.model, ...listed] : listed).map(id => ({ value: id, label: id }))]
      : []

    return (
      <Box flexDirection="column">
        <Select
          key="backend"
          label="Backend "
          value={c.backend}
          autoFocus
          options={[
            { value: 'auto', label: 'auto: follow the router' },
            ...BACKENDS.map(b => ({ value: b.name, label: b.name })),
          ]}
          onSelect={async (value: string) => {
            await save(old => ({ ...old, backend: value }))
            await listModels($, value)
          }}
        />
        {modelOptions.length ? (
          <Select
            key="model"
            label="Model   "
            value={shownAs(c.model)}
            options={modelOptions}
            onSelect={(value: string) => void save(old => ({ ...old, model: savedAs(value) }))}
          />
        ) : (
          <Input
            key="model"
            label="Model   "
            value={c.model}
            placeholder={c.backend === 'opencode' ? 'provider/model · empty = default' : 'empty = default'}
            submitLabel="save"
            onSubmit={(value: string) => void save(old => ({ ...old, model: value }))}
          />
        )}
        {backend?.modelsArgv && !listed?.length && (
          <Text dimColor>
            {listed ? `No model list from ${backend.modelsArgv.join(' ')}; type one.` : 'Listing models…'}
          </Text>
        )}
        <Select
          key="effort"
          label="Effort  "
          value={shownAs(c.effort)}
          options={[
            DEFAULT_OPTION,
            { value: 'low', label: 'low' },
            { value: 'medium', label: 'medium' },
            { value: 'high', label: 'high' },
          ]}
          onSelect={(value: string) => void save(old => ({ ...old, effort: savedAs(value) as ReviewChoice['effort'] }))}
        />
        <Text dimColor>Runs: {preview}</Text>
        <Button key="reset" onPress={() => void save(() => asChoice(undefined))}>
          reset to defaults
        </Button>
      </Box>
    )
  })

  on('command.run', { command: 'router-panel' }, async ($, e) => {
    const open = (await $.ui.panes()).some(p => p.id === PANE)
    await takeUp($)
    if (open) {
      await $.ui.close({ id: PANE })
      return { text: 'Router pane closed.' }
    }
    if ((await read($, state)) === null) {
      return { text: `No workflow found in ${STATE_FILE} of this directory.` }
    }
    if (e.presentation?.columns) terminalColumns = e.presentation.columns
    await $.ui.open({
      id: PANE,
      title: 'Router',
      focus: true,
      closeOnEscape: true,
      columns: paneColumns(terminalColumns),
      rows: PANE_ROWS,
    })
    return { text: 'Router pane opened.' }
  })

  // The band: the workflow in a few lines, plus where to choose when it waits for you.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, state)
    if (e.viewport?.columns) terminalColumns = e.viewport.columns
    if (s === null || (await read($, isHidden)) || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const frozen = await read($, foreign)
    if (frozen !== null) return <Text dimColor>{frozen}</Text>
    const hint =
      s.status === 'selecting'
        ? '/router-panel: choose skills'
        : s.status === 'paused'
          ? '/router-panel: r resume · x stop'
          : undefined

    return (
      <Box flexDirection="column">
        {widgetLines(s).map(line => (
          <Text>{line}</Text>
        ))}
        {hint && <Text dimColor>{hint}</Text>}
      </Box>
    )
  })

  // The pane: handoff and every step with its details, and the keys of the current status.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const s = await read($, state)
    if (s === null) return <Text dimColor>No workflow.</Text>

    const picked = await read($, selected)
    const isStopArmed = await read($, confirmStop)
    const isChoosing = s.status === 'selecting'
    const { lines } = detailLines(s, isChoosing ? picked : -1, undefined, e.props.bodyColumns || Infinity)
    const room = Math.max(4, (e.viewport?.rows ?? 30) - 6)
    const anchor = Math.max(0, lines.findIndex(l => l.startsWith('▸')))
    const top = isChoosing
      ? Math.max(0, anchor - 2)
      : Math.max(0, lines.length - room)
    const shown = lines.slice(top, top + room)

    const send = (choice: Choice) => {
      const text = replyFor(s, choice)
      if (text) void $.prompt.submit({ text })
    }
    const press = (fn: () => void) => () => {
      void update($, confirmStop, () => false)
      fn()
    }
    const step = isChoosing ? picked : currentStep(s)
    const hasAlt = (i: number) => Boolean(s.steps[step]?.alternatives[i])

    return (
      <Box flexDirection="column">
        {shown.map(line => (
          <Text>{line}</Text>
        ))}
        <Text dimColor>{KEYS[s.status] ? `${symbol(s.status)} ${s.status}` : s.status}</Text>
        <Box>
          {isChoosing && (
            <Button key="go" hotkey="g" variant="primary" onPress={press(() => send({ kind: 'go' }))}>
              go
            </Button>
          )}
          {isChoosing && (
            <Button
              key="prev"
              hotkey="k"
              onPress={press(() => void update($, selected, i => Math.max(0, i - 1)))}
            >
              ↑ step
            </Button>
          )}
          {isChoosing && (
            <Button
              key="next"
              hotkey="j"
              onPress={press(
                () => void update($, selected, i => Math.min(s.steps.length - 1, i + 1)),
              )}
            >
              ↓ step
            </Button>
          )}
          {isChoosing && hasAlt(0) && (
            <Button
              key="swap-a"
              hotkey="a"
              onPress={press(() => send({ kind: 'swap', step: picked, alt: 0 }))}
            >
              swap a
            </Button>
          )}
          {isChoosing && hasAlt(1) && (
            <Button
              key="swap-b"
              hotkey="b"
              onPress={press(() => send({ kind: 'swap', step: picked, alt: 1 }))}
            >
              swap b
            </Button>
          )}
          {isChoosing && s.steps[picked]?.optional && (
            <Button
              key="switch"
              hotkey="o"
              onPress={press(() => send({ kind: 'switch', step: picked }))}
            >
              on/off
            </Button>
          )}
          {isChoosing && s.path === 'light' && (
            <Button key="full" hotkey="f" onPress={press(() => send({ kind: 'full' }))}>
              full path
            </Button>
          )}
          {isChoosing && (
            <Button key="edit" hotkey="e" onPress={press(() => send({ kind: 'edit' }))}>
              edit
            </Button>
          )}
          {s.status !== 'paused' && KEYS[s.status] && (
            <Button key="pause" hotkey="p" onPress={press(() => send({ kind: 'pause' }))}>
              pause
            </Button>
          )}
          {s.status === 'paused' && (
            <Button key="resume" hotkey="r" onPress={press(() => send({ kind: 'resume' }))}>
              resume
            </Button>
          )}
          {(isChoosing || s.status === 'paused') && (
            <Button
              key="stop"
              hotkey="x"
              onPress={() => {
                if (isStopArmed) {
                  void update($, confirmStop, () => false)
                  send({ kind: 'stop' })
                } else {
                  void update($, confirmStop, () => true)
                }
              }}
            >
              {isStopArmed ? 'press again to stop' : 'stop'}
            </Button>
          )}
        </Box>
      </Box>
    )
  })
}
