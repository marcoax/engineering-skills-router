# engineering-skills-router

Routes an engineering task to the smallest workflow of skills drawn from several public collections, without installing or modifying any user-level skill. Spec: [docs/engineering-skills-router-spec.md](docs/engineering-skills-router-spec.md).

```text
task → classify → phases → one skill per phase → dedupe → show workflow → run
```

Default backbone: **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by task type and risk. Requirements (a grilling session) runs after any code-understanding step, so its questions build on the code; it is skipped only when the task is an issue or spec that already settles the decisions.

While running, the router keeps `.router/state.json` and one note per step in `.router/steps/` in the target repo (git-excluded). Where the agent supports subagents, each skill step runs in a fresh subagent on the session's model; steps that talk with the user (requirements, specification, setup) stay in the main session. An unfinished workflow can be resumed later, also from a new session.

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

## Install (Pi)

The repo is a Pi package: the router skill plus the workflow widget. Needs Node 24+ and git; `gh` lets the widget see merged PRs.

```sh
pi install git:github.com/marcoax/engineering-skills-router
```

Pi clones it into `~/.pi/agent/git/`, and `npm install` fetches the vendor submodules (`postinstall`). Only the router is loaded, not the vendor skills. `pi update` moves it to the latest commit.

Then, in Pi, `/reload` and `/skill:engineering-router <task>`. Run it with no task, or with the same issue, to resume an unfinished workflow. To try it for one session without installing: `pi -e git:github.com/marcoax/engineering-skills-router`.

**Personal preferences.** `pi update` resets the installed clone (`git clean -fdx`), so a `config/preferences.yaml` there is lost. To keep preferences, or to edit the catalog, install from your own clone instead (Pi loads a local path without copying or cleaning it):

```sh
git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router && cd engineering-skills-router
scripts/setup
cp config/preferences.example.yaml config/preferences.yaml   # optional
pi install "$PWD"
```

Update that clone with `git pull && scripts/setup`.

### The workflow widget

The extension reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` (or `/router-panel`, for keyboard layouts where the shortcut arrives as another key) toggles a details panel on the right half. While a workflow is open, the panel takes the keyboard: during the skill selection `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit; `p` pauses (a running step finishes first); on a paused workflow `r` resumes; `x x` stops; `esc` goes back to the editor. At session start, a stopped workflow, or a done one with no PR or a merged/closed PR (checked with `gh`), is not shown. Choices are sent as chat messages; the extension never writes the state file.

### Other agents

Claude Code, Codex, Cursor, OpenCode: clone with `--recurse-submodules`, run `scripts/setup`, and point the agent at `router/engineering-router/SKILL.md` with whatever skill/rule mechanism it offers. There is no widget outside Pi.

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [phase ...]` | ranked candidates per phase with availability |
| `scripts/validate-catalog [--verbose]` | checks sources, paths, ids, categories, rankings, preferences; `--verbose` lists uncataloged upstream skills |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |
| `scripts/selftest` | checks the scripts against a scratch catalog, then runs the Pi adapter tests |

Scripts need Node 24+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [docs/adding-a-source.md](docs/adding-a-source.md).
