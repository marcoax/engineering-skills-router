// Claude Code adapter for the engineering router: shows `.router/state.json` of the
// session's working directory as a band above the prompt and a pane with the skill
// selection. It never writes the state file; choices go to the agent as prompts in the
// router's own selection syntax (`go`, `2b`, `5on`, `pause`, ...).
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  currentStep,
  detailLines,
  hiddenAtStart,
  isClosed,
  KEYS,
  parseState,
  replyFor,
  STATE_FILE,
  symbol,
  widgetLines,
} from './state-core.ts'
import type { Choice } from './state-core.ts'

const PANE = 'router'

const state = atom({ plugin: 'engineering-router-panel', key: 'state' } as const, null)
const selected = atom({ plugin: 'engineering-router-panel', key: 'selected' } as const, 0)
const confirmStop = atom({ plugin: 'engineering-router-panel', key: 'confirmStop' } as const, false)
const isHidden = atom({ plugin: 'engineering-router-panel', key: 'isHidden' } as const, false)

export const register: Register = on => {
  // The last text read, so a poll that finds the same file redraws nothing.
  let last: string | undefined
  let isFirstRead = true
  let timer: { cancel: () => void } | undefined

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
      if (isFirstRead && fresh) await update($, isHidden, () => hiddenAtStart(fresh))
      else if (fresh && !isClosed(fresh)) await update($, isHidden, () => false)
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

    return next(e)
  })

  on('command.run', { command: 'router-panel' }, async $ => {
    const open = (await $.ui.panes()).some(p => p.id === PANE)
    if (open) {
      await $.ui.close({ id: PANE })
      return { text: 'Router pane closed.' }
    }
    if ((await read($, state)) === null) {
      return { text: `No workflow found in ${STATE_FILE} of this directory.` }
    }
    await $.ui.open({ id: PANE, title: 'Router', focus: true, closeOnEscape: true })
    return { text: 'Router pane opened.' }
  })

  // The band: the workflow in a few lines, plus where to choose when it waits for you.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, state)
    if (s === null || (await read($, isHidden)) || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
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
    const { lines } = detailLines(s, isChoosing ? picked : -1)
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
