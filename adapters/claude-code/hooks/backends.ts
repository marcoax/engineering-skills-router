// Which command line runs a review on a model outside Claude Code's own family.
// The router passes the model as the user's `preferences.yaml` (where `scripts/config` says) names it; its first segment
// picks the backend, the rest is the backend's own model id. Each backend runs read-only.
// To add one, add an entry: its prefixes, its executable, and its argument vector.
// A backend that can list its models names the command; /router-models offers its output.

export type Effort = 'low' | 'medium' | 'high'

export type Backend = {
  name: string
  prefixes: string[]
  cli: string
  // Whether `argv` passes an effort on; one that cannot ignores it.
  hasEffort: boolean
  // The review run. No model or effort: the CLI's own default, from its config.
  argv: (prompt: string, model?: string, effort?: Effort) => string[]
  // The command that prints the models it can run, one id per line, each as `-m` takes
  // it. Absent: /router-models asks for the model as text.
  modelsArgv?: string[]
}

export const BACKENDS: Backend[] = [
  {
    // OpenAI's Codex CLI, signed in with ChatGPT or an API key (`codex login`).
    name: 'codex',
    prefixes: ['openai-codex', 'codex'],
    cli: 'codex',
    hasEffort: true,
    argv: (prompt, model, effort) => [
      'codex',
      'exec',
      '--sandbox',
      'read-only',
      ...(model ? ['-m', model] : []),
      ...(effort ? ['-c', `model_reasoning_effort="${effort}"`] : []),
      prompt,
    ],
  },
  {
    // opencode, any provider it is configured for: `opencode/<provider>/<model>`.
    // The built-in `plan` agent cannot edit files. No effort flag: its config decides.
    name: 'opencode',
    prefixes: ['opencode'],
    cli: 'opencode',
    hasEffort: false,
    argv: (prompt, model) => ['opencode', 'run', '--agent', 'plan', ...(model ? ['-m', model] : []), prompt],
    // `provider/model` per line, e.g. `opencode/claude-opus-5-5`.
    modelsArgv: ['opencode', 'models'],
  },
]

// The ids a list command printed: one per line, blank lines and anything with spaces
// (a banner, a warning) left out.
export const parseModelList = (stdout: string) =>
  stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !/\s/.test(line))

export const backendNamed = (name: string) => BACKENDS.find(b => b.name === name)

export type Resolved = { backend: Backend; model: string | undefined }

// `openai-codex/gpt-6-sol` → codex with `gpt-6-sol`; `opencode/openai/gpt-6` → opencode
// with `openai/gpt-6`; `codex` alone → codex on its default model. Undefined when no
// backend claims the prefix.
export function resolveBackend(model: string): Resolved | undefined {
  const cut = model.indexOf('/')
  const prefix = cut < 0 ? model : model.slice(0, cut)
  const rest = cut < 0 ? '' : model.slice(cut + 1)
  const backend = BACKENDS.find(b => b.prefixes.includes(prefix))
  return backend ? { backend, model: rest || undefined } : undefined
}

// What the person chose in the models pane; `auto` follows what the router asks.
export type Choice = { backend: string; model: string; effort: '' | Effort }
export const NO_CHOICE: Choice = { backend: 'auto', model: '', effort: '' }

export type Plan = { backend: Backend; model: string | undefined; effort: Effort | undefined; source: string }

// The pane's choice wins; on `auto` the router's model and effort; an empty model or
// effort leaves the CLI's own default.
export function planRun(choice: Choice, asked: { model?: string; effort?: string }): Plan | undefined {
  const askedEffort = isEffort(asked.effort) ? asked.effort : undefined
  if (choice.backend !== 'auto') {
    const backend = backendNamed(choice.backend)
    if (!backend) return undefined
    const effort = choice.effort || askedEffort
    return { backend, model: choice.model || undefined, effort: backend.hasEffort ? effort : undefined, source: 'pane' }
  }
  const resolved = asked.model ? resolveBackend(asked.model) : undefined
  if (!resolved) return undefined
  const effort = choice.effort || askedEffort
  return {
    backend: resolved.backend,
    model: resolved.model,
    effort: resolved.backend.hasEffort ? effort : undefined,
    source: 'router',
  }
}

export const isEffort = (v: unknown): v is Effort => v === 'low' || v === 'medium' || v === 'high'

export function asChoice(v: unknown): Choice {
  if (typeof v !== 'object' || v === null) return NO_CHOICE
  const o = v as Record<string, unknown>
  return {
    backend: typeof o.backend === 'string' && (o.backend === 'auto' || backendNamed(o.backend)) ? o.backend : 'auto',
    model: typeof o.model === 'string' ? o.model.trim() : '',
    effort: isEffort(o.effort) ? o.effort : '',
  }
}
