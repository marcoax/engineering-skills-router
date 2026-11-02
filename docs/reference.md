# Repo layout and scripts

For working on the router itself or its catalog. Install and use: the [README](../README.md).

## Layout

| Path | What |
|---|---|
| `skills/engineering-router/SKILL.md` | the router skill: what every run needs; the files beside it (`light.md`, `review-2.md`, `after-implementation.md`, …) are read only when a run reaches them |
| `skills/engineering-router/resolve-root.js` | finds the router checkout the skill works from |
| `catalog/sources.yaml` | vendor repos and where their skills live |
| `catalog/skills.yaml` | project-owned metadata per skill (phases, use_when, invokes) |
| `catalog/rankings.yaml` | default + fallback skill per phase |
| `catalog/categories.yaml` | the phases |
| `config/preferences.example.yaml` | template for personal overrides (`config/preferences.yaml`, git-ignored) |
| `config/personal-skills.example.yaml` | template for your own skills (`config/personal-skills.yaml`, git-ignored) |
| `adapters/pi/` | Pi extension: workflow widget and panel from `.router/state.json` |
| `vendors/` | git submodules, never edited |
| `adapters/claude-code/` | Claude Code plugin: workflow band and panes, review 2 on another family ([claude-code.md](claude-code.md)) |
| `.claude-plugin/marketplace.json` | makes the repo a Claude Code marketplace for that plugin |
| `skills/engineering-router/run-record.md` | the run record each PR carries, read by `scripts/stats` |

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [--target <repo>] [phase ...]` | ranked candidates per phase with availability; `--target` adds the repo's project skills |
| `scripts/validate-catalog [--target <repo>] [--verbose]` | checks sources, paths, ids, categories, rankings, preferences, personal skills; `--target` also checks the repo's `docs/agents/skills.yaml`; `--verbose` lists uncataloged upstream skills |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |
| `scripts/check-state <target-repo>` | checks the target repo's `.router/state.json` against `skills/engineering-router/state.md` |
| `scripts/selftest` | checks the scripts against a scratch catalog and scratch state files, then runs the Pi adapter tests |
| `scripts/state <target-repo> step\|workflow\|handoff\|reply\|show ...` | the router's only way to change `.router/state.json` after writing it: applies the change, validates it with `check-state`, keeps the old file when invalid |
| `scripts/record <target-repo> [--findings f] [--checklist p,a[,ok,ko]] [--pr n] ...` | composes the run record from the state and the findings, and writes it into the PR body |
| `scripts/stats [--repo <owner/name>] [--limit <n>] [--json]` | adds up the run records in a repo's PRs (via `gh`): per review and model, per skill, per severity, checklists, tokens |

Scripts need Node 22.18+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [adding-a-source.md](adding-a-source.md).
