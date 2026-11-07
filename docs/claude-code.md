# Claude Code reference

The recommended installation, its checks and update are in the README's [Install (Claude Code)](../README.md#install-claude-code). This page covers a pre-existing installation, removal, the panel plugin and the other ways to install, for when that route does not fit.

## An existing installation

- **Skill links:** `scripts/install-claude` leaves anything already at `~/.claude/skills/engineering-router` or `skill-selector` alone. If it is a link to an older clone, or a copy from `npx skills add`, decide which to keep; remove a link with `rm ~/.claude/skills/engineering-router` (no `-r`: this removes the link only) and rerun `scripts/install-claude`.
- **Marketplace from another clone or from GitHub:** adding `$ROUTER` repoints the existing `engineering-skills-router` marketplace to it (Claude Code says so), and the installed plugin then loads from `$ROUTER`; there is still one copy. Adding the previous source again undoes it. Rerunning `scripts/install-claude` against the same checkout keeps the same links and plugin source.
- **`ENGINEERING_ROUTER_HOME` in your shell profile:** not used by linked skills (the link wins); remove it unless you use a copied skill elsewhere.
- **Preferences in the checkout's `config/`:** `scripts/config` reports them; `scripts/config migrate` shows how to move them out ([configuration.md](configuration.md#moving-clone-local-configuration-out)).

## Uninstall

```sh
claude plugin uninstall engineering-router-panel@engineering-skills-router
claude plugin marketplace remove engineering-skills-router
ls -l ~/.claude/skills/engineering-router ~/.claude/skills/skill-selector    # confirm both point into $ROUTER
rm ~/.claude/skills/engineering-router ~/.claude/skills/skill-selector       # removes the links only
```

Claude Code may leave a copy of the plugin in `~/.claude/plugins/cache/engineering-skills-router/`, marked orphaned for its own cleanup; that folder belongs to this installation too. Then delete `$ROUTER` if you no longer want it. `~/.config/engineering-skills-router/` is yours to keep or delete; a target repo's `.router/` belongs to its runs.

## The panel plugin

`adapters/claude-code/` is a Claude Code plugin, `engineering-router-panel`, whose mod draws the workflow: a band above the prompt (the same lines as the Pi widget) and a pane with the skill selection. It reads `.router/state.json` of the session's working directory and never writes it; choices go to the agent as prompts in the router's selection syntax. At session start an unfinished workflow (selecting, running, waiting, paused) whose recorded owner is not this session may be another session's, even in Pi: the band shows only a frozen `router · <status> elsewhere · <task> — /engineering-router to resume` until this session takes it up with `/engineering-router`, `/router-panel` or a `scripts/state` command the agent runs, or the state file is removed. It does not contain the router skill: the skills come from the checkout (`scripts/install-claude`). Needs a Claude Code with mods (CLI, Code tab of the Desktop app or VS Code extension; only the CLI has been exercised, see the [installation walkthrough](../evals/live/2026-11-04-claude-code-install.md)). A mod runs with your permissions: list what it does first with `claude plugin validate adapters/claude-code`.

The repo is its own marketplace (`.claude-plugin/marketplace.json`), named `engineering-skills-router`, holding this one plugin; the plugin is installed as `engineering-router-panel@engineering-skills-router`. Added from a local checkout, the marketplace has a `directory` source and Claude Code reads the plugin in place from the checkout, so `git pull` plus `/reload-plugins` updates it; `claude plugin marketplace update` is not needed.

`/router-panel` toggles the pane. In the pane the buttons carry hotkeys: `g` go · `j`/`k` next/previous step · `a`/`b` swap skill · `o` on/off an optional step · `f` full path (light workflow) · `e` edit · `p` pause · `r` resume · `x` stop (press twice).

When implementation produces a manual checklist, the pane shows action and expected result. Press `c` (checklist), `j`/`k` to select a point, `h`/`l` to scroll up/down within a long point, then `t` (tick/untick); `c` returns to steps. Ticks are optional personal reminders, not verification evidence. They persist with the run across reopening and resume. The owning router applies each intent; until it succeeds, the pane keeps the saved tick, so a refusal never appears as saved.

## Cross-family review

Claude Code's subagents run only Claude models, so the code is always written by Claude and every review step runs on the other family. The mod adds a tool, `review_other_family`, that runs each review through a local CLI, read-only, and streams it into a **Cross-family review** pane: `openai-codex/<model>` runs `codex exec --sandbox read-only`, `opencode/<provider>/<model>` runs `opencode run --agent plan`. The router calls it when it is listed (SKILL.md §5). Called without a prompt, it only checks that the backend's CLI is installed and reports `available: …` or why not; that is the availability check, and it starts no review. Whether your account can use the chosen model shows only when a review runs. When the tool fails, the router asks once whether to run the remaining reviews as same-family reviews, on Claude and marked so, or stop.

`/router-models` opens a pane to pick backend, model and effort; left empty (`default`), each is the CLI's own default (`~/.codex/config.toml`, opencode's config). For opencode the model is picked from what `opencode models` lists; when that fails or lists nothing, and for Codex, it is typed. The choice is kept across sessions in Claude Code's mod storage. Without a choice, the router passes `models.openai` from your `preferences.yaml` ([configuration.md](configuration.md)). New backends, and a backend's model-list command, are one entry in `adapters/claude-code/hooks/backends.ts`.

## Other installation routes

Each replaces one part of the README route; mixing them with it is covered in [an existing installation](#an-existing-installation).

- **Plugin from GitHub, without a clone.** `claude plugin marketplace add marcoax/engineering-skills-router`, then `claude plugin install engineering-router-panel@engineering-skills-router` (or, in a session, `/plugin install engineering-router-panel --marketplace marcoax/engineering-skills-router`). Claude Code keeps its own copy and updates it with `claude plugin marketplace update engineering-skills-router` (auto-update is off for third-party marketplaces). The skills still need a checkout; the plugin and the checkout can then be at different revisions. Adding this marketplace while a local one of the same name exists repoints it.
- **One session, no install.** `claude --plugin-dir "/path/to/checkout/adapters/claude-code"` loads a local copy of the plugin for that session, for trying a change; not together with the installed one. `claude --debug` logs why a mod hook was skipped.
- **One project only.** Link the skills into that project's `.claude/skills/` instead of `~/.claude/skills/`; install the plugin with `--scope local` (this repository, only you) or `--scope project` (written to the project's shared `.claude/settings.json`, which changes it for collaborators; avoid it unless that is the intent).
- **`CLAUDE_CONFIG_DIR`.** When you run Claude Code with another configuration directory, the plugin commands write there. Personal skills are expected under that directory's `skills/`; that has not been confirmed in a live session.
- **A copied skill** (`npx skills add`, or a manual copy) instead of links: it is a bootstrap that finds a checkout through `ENGINEERING_ROUTER_HOME` or the default locations and then follows the checkout's own skill ([checkout resolution](reference.md#checkout-resolution), [other agents](install-other-agents.md)).

## Differences from the Pi adapter

No `ctrl+alt+w` shortcut (use `/router-panel`), no `gh` check that hides a done workflow with a merged PR, and the state file is looked up in the working directory only, not in the nearest `.git` root.

Both adapters share one copy of the state logic, `adapters/claude-code/hooks/state-core.ts` (a mod imports only from its own folder; `adapters/pi/state.ts` re-exports it and adds the file reading). Tests: `claude plugin test adapters/claude-code`; CI runs them on every PR with a pinned Claude Code version ([CI](reference.md#ci)).
