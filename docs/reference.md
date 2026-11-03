# Repo layout and scripts

For working on the router itself or its catalog. Install and use: the [README](../README.md).

## Layout

| Path | What |
|---|---|
| `skills/engineering-router/SKILL.md` | the router skill: what every run needs; the files beside it (`light.md`, `review-2.md`, `after-implementation.md`, …) are read only when a run reaches them |
| `skills/engineering-router/resolve-root.js` | finds the router checkout the skill works from |
| `catalog/sources.yaml` | vendor repos and where their skills live |
| `catalog/skills.yaml` | project-owned metadata per skill (phases, use_when, invokes); descriptions are read from each `SKILL.md` |
| `catalog/guides.yaml` | vendor guides consulted for selection: source and path only, never phase candidates |
| `catalog/rankings.yaml` | default + fallback skill per phase |
| `catalog/categories.yaml` | the phases |
| `config/preferences.example.yaml` | template for personal overrides (`preferences.yaml` in the configuration directory, [configuration.md](configuration.md)) |
| `config/personal-skills.example.yaml` | template for your own skills (`personal-skills.yaml` beside it) |
| `adapters/pi/` | Pi extension: workflow widget and panel from `.router/state.json`, and the `router_primary` select menu for the primary question |
| `vendors/` | git submodules, never edited |
| `adapters/claude-code/` | Claude Code plugin: workflow band and panes, review 2 on another family ([claude-code.md](claude-code.md)) |
| `.claude-plugin/marketplace.json` | makes the repo a Claude Code marketplace for that plugin |
| `skills/engineering-router/run-record.md` | the run record each PR carries, read by `scripts/stats` |

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [--target <repo>] [phase ...]` | ranked candidates per phase with availability; with phases, each candidate's source description (from its `SKILL.md` frontmatter) and catalog metadata; `--target` adds the repo's project skills |
| `scripts/list-skills --guides` | the registered vendor guides with their source descriptions |
| `scripts/skill-index [--check]` | regenerates `docs/skill-index.md` from the guides, the catalog and the checked-out vendor revisions; `--check` only reports a stale index |
| `scripts/validate-catalog [--target <repo>] [--verbose]` | checks sources, paths, ids, categories, rankings, preferences, personal skills, guides (source ownership, never also a skill); warns on unreadable descriptions; `--target` also checks the repo's `docs/agents/skills.yaml`; `--verbose` lists uncataloged upstream skills |
| `scripts/config [migrate [--yes]]` | prints the user configuration in effect (source, directory, files, ignored clone-local files); `migrate` shows, and with `--yes` performs, a validated move of `config/` files out of the checkout ([configuration.md](configuration.md)) |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |
| `scripts/check-state <target-repo>` | checks the target repo's `.router/state.json` against `skills/engineering-router/state.md` |
| `scripts/selftest` | checks the scripts against a scratch catalog and scratch state files, then runs the Pi adapter tests |
| `scripts/context-threshold` | read-only adapter bridge: prints the context threshold of the configuration in effect (150000 by default) |
| `scripts/state <target-repo> step\|workflow\|handoff\|reply\|primary\|show\|model ...` | the router's only way to change `.router/state.json` after writing it: applies the change, validates it with `check-state`, keeps the old file when invalid; `primary` prints the primary question (the current family first; `--json` gives the options to a selector) and `primary <n\|family>` sets the run's `primary`, both only while the workflow is `selecting`; `model <step>` prints the model a step runs on, from the run's `primary` in the state |
| `scripts/record <target-repo> [--findings f] [--checklist p,a[,ok,ko]] [--pr n] ...` | composes the run record from the state and the findings, and writes it into the PR body |
| `scripts/stats [--repo <owner/name>] [--limit <n>] [--json]` | adds up the run records in a repo's PRs (via `gh`): per review and model, per skill, per severity, checklists, tokens |

Scripts need Node 22.18+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [adding-a-source.md](adding-a-source.md).

## Context preference

In your `preferences.yaml` under `preferences`, `context_threshold` is an integer >= 0, default **150000** tokens; **0** disables context questions. Validation rejects negative, fractional, non-finite and non-numeric values. Missing, invalid or unreadable runtime settings fall back to the default.

Claude Code and Pi add `context: <tokens> of <window> window, threshold <threshold>` only after a successful, foreground `scripts/state <target repo> step <n|id> done` command, at or above the threshold with known tokens/window. Run that command separately: shell batches/chains are deliberately left unannotated. Quoted paths, a `node` prefix and state flags are supported. No adapter means no measurement. Warnings are informational, including above 80% of the window; a fresh-session handoff is reserved for capacity that prevents further execution after available recovery. See [context at a step boundary](how-it-works.md#context-at-a-step-boundary).
