# engineering-skills-router

Routes an engineering task to the smallest workflow of skills drawn from several public collections, without installing or modifying any user-level skill. Spec: [docs/engineering-skills-router-spec.md](docs/engineering-skills-router-spec.md).

```text
task → classify → phases → one skill per phase → dedupe → show workflow → run
```

Default backbone: **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by task type and risk.

## Layout

| Path | What |
|---|---|
| `router/engineering-router/SKILL.md` | the router skill |
| `catalog/sources.yaml` | vendor repos and where their skills live |
| `catalog/skills.yaml` | project-owned metadata per skill (phases, use_when, invokes) |
| `catalog/rankings.yaml` | default + fallback skill per phase |
| `catalog/categories.yaml` | the phases |
| `config/preferences.example.yaml` | template for personal overrides (`config/preferences.yaml`, git-ignored) |
| `adapters/pi/` | Pi extension: workflow widget and panel from `.router/state.json` |
| `vendors/` | git submodules, never edited |

## Setup

```sh
git clone --recurse-submodules <url> && cd engineering-skills-router
scripts/setup
```

### Pi

Add the router folder (only the router, so vendor skills are not auto-loaded) to `~/.pi/agent/settings.json`:

```json
"skills": ["/absolute/path/to/engineering-skills-router/router"]
```

Then `/reload` and run `/skill:engineering-router <task>`.

Optional workflow view: add the adapter extension in the same file.

```json
"extensions": ["/absolute/path/to/engineering-skills-router/adapters/pi"]
```

It reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` toggles a details panel on the right half. While the router waits for the skill selection, the panel takes the keyboard: `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit, `x x` stop, `esc` back to the editor. Choices are sent as chat messages; the extension never writes the state file. To try it for one session without installing, start Pi in the target repo with `pi -e /absolute/path/to/engineering-skills-router/adapters/pi`.

Other agents (Claude Code, Codex, Cursor, OpenCode): point the agent at `router/engineering-router/SKILL.md` with whatever skill/rule mechanism it offers.

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [phase ...]` | ranked candidates per phase with availability |
| `scripts/validate-catalog [--verbose]` | checks sources, paths, ids, categories, rankings, preferences; `--verbose` lists uncataloged upstream skills |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |
| `scripts/selftest` | checks the scripts against a scratch catalog, then runs the Pi adapter tests |

Scripts need Node 24+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [docs/adding-a-source.md](docs/adding-a-source.md).
