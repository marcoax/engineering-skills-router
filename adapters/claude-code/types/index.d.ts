// The mod's `$.state` contract. Self-contained by rule: the shapes below mirror
// `State` in hooks/state-core.ts, which is what the module stores.
declare module 'claude-code' {
  interface RouterRef {
    number: number
    url: string
  }

  interface RouterStep {
    id: string
    phases: string[]
    skill: string | null
    reason: string
    summary: string
    alternatives: { skill: string; reason: string }[]
    confirm: boolean
    optional: boolean
    covered_by: string | null
    model: string | null
    status: string
    outcome: string | null
  }

  interface RouterSnapshot {
    task: string
    type: string
    risk: string
    properties: string[]
    status: string
    steps: RouterStep[]
    handoff: {
      issue: RouterRef | null
      spec: string | null
      tickets: RouterRef[]
      branch: string | null
      base_commit: string | null
      pr: RouterRef | null
    }
  }

  interface PluginState {
    'engineering-router-panel': {
      // The parsed `.router/state.json`; null when absent or unreadable.
      state: RouterSnapshot | null
      // 0-based step the pane marks while the workflow is `selecting`.
      selected: number
      // True after the first `stop` press; the second press sends it.
      confirmStop: boolean
      // A finished workflow found at session start stays hidden until a new one begins.
      isHidden: boolean
    }
  }
}
