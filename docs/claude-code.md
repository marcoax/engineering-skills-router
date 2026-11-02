# Claude Code mod

Install it with the README's [quick start](../README.md#install-claude-code). This page is the reference.

`adapters/claude-code/` is a Claude Code plugin whose mod draws the workflow: a band above the prompt (the same lines as the Pi widget) and a pane with the skill selection. It reads `.router/state.json` of the session's working directory and never writes it; choices go to the agent as prompts in the router's selection syntax. Needs a Claude Code with mods (CLI, Code tab of the Desktop app or VS Code extension). A mod runs with your permissions: list what it does first with `claude plugin validate adapters/claude-code`.

`/router-panel` toggles the pane. In the pane the buttons carry hotkeys: `g` go · `j`/`k` next/previous step · `a`/`b` swap skill · `o` on/off an optional step · `f` full path (light workflow) · `e` edit · `p` pause · `r` resume · `x` stop (press twice).

## Review 2 on another family

Claude Code's subagents run only Claude models, so the mod adds a tool, `review_other_family`, that runs the review through a local CLI, read-only, and streams it into a **Review 2** pane: `openai-codex/<model>` runs `codex exec --sandbox read-only`, `opencode/<provider>/<model>` runs `opencode run --agent plan`. The router calls it when it is listed (SKILL.md §5).

`/router-models` opens a pane to pick backend, model and effort; left empty (`default`), each is the CLI's own default (`~/.codex/config.toml`, opencode's config). For opencode the model is picked from what `opencode models` lists; when that fails or lists nothing, and for Codex, it is typed. The choice is kept across sessions. New backends, and a backend's model-list command, are one entry in `adapters/claude-code/hooks/backends.ts`.

## Installing the mod alone

The repo is its own marketplace (`.claude-plugin/marketplace.json`) holding this one plugin. Without a clone, the mod can be installed from GitHub:

```
/plugin install engineering-router-panel --marketplace marcoax/engineering-skills-router
```

This installs the mod only, not the router skill: install that as in [Install for other agents](install-other-agents.md). The quick start installs both from one clone, so they stay in step.

To try a local change to the mod for one session, without installing: `claude --plugin-dir /path/to/engineering-skills-router/adapters/claude-code` (not together with the installed one). If something does not show, `claude --debug` logs why a mod hook was skipped.

## Differences from the Pi adapter

No `ctrl+alt+w` shortcut (use `/router-panel`), no `gh` check that hides a done workflow with a merged PR, and the state file is looked up in the working directory only, not in the nearest `.git` root.

Both adapters share one copy of the state logic, `adapters/claude-code/hooks/state-core.ts` (a mod imports only from its own folder; `adapters/pi/state.ts` re-exports it and adds the file reading). Tests: `claude plugin test adapters/claude-code`.
