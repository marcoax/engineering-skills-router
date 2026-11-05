# Pi adapter

Installation and update are in the README's [Install (Pi)](../README.md#install-pi). This page describes the workflow widget.

## The workflow widget


The extension reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` (or `/router-panel`, for keyboard layouts where the shortcut arrives as another key) toggles a details panel on the right half. While a workflow is open, the panel takes the keyboard: during the skill selection `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit; `p` pauses (a running step finishes first); on a paused workflow `r` resumes; `x x` stops; `esc` goes back to the editor. At session start, a stopped workflow, or a done one with no PR or a merged/closed PR (checked with `gh`), is not shown. An unfinished one (selecting, running, waiting, paused) whose recorded owner is not this session may be another session's, even in Claude Code: in its place a single line, frozen at start, says `router · <status> elsewhere · <task> — /skill:engineering-router to resume`. Writes by the other session do not change it. The workflow shows once this session takes it up: `/skill:engineering-router`, `/router-panel` or `ctrl+alt+w`, a `scripts/state` command the agent runs here, or the state file being removed. Choices are sent as chat messages; the extension never writes the state file itself.

On a new run, before the workflow is shown, the router asks which model family is primary for that run: the extension's `router_primary` tool shows it as a select menu, both families with their model IDs and the current one preselected (`enter` keeps it). The answer goes through `scripts/state <target> primary`, the same command the router uses for the numbered text question where there is no selector; it is not asked again on resume. When your `preferences.yaml` sets `primary`, the tool asks nothing: the workflow names that family, and the reply `primary <family>` changes it before `go`.

How it differs from the Claude Code panel: [Claude Code reference](claude-code.md#differences-from-the-pi-adapter).
