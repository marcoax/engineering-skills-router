# engineering-skills-router

Routes an engineering task to the smallest workflow of skills drawn from several public collections, without installing or modifying any user-level skill. Spec: [docs/engineering-skills-router-spec.md](docs/engineering-skills-router-spec.md).

```text
task → classify → phases → one skill per phase → dedupe → show workflow → run
```

Default backbone: **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by task type and risk. Requirements (a grilling session) runs after any code-understanding step, so its questions build on the code; it is skipped only when the task is an issue or spec that already settles the decisions.

**Without GitHub issues.** To keep the spec as a file in the target repo instead, prefer a specification skill that writes one, in `config/preferences.yaml`:

```yaml
preferences:
  specification:
    prefer: [addyosmani/spec-driven-development]
```

The preference only picks the skill; since no selected skill then publishes an issue, the workflow has none. Every step uses skills that need no issue tracker (planning breaks the spec into tasks without publishing tickets), the branch is `<slug>` and starts by committing the spec file, review 2 checks the diff against the spec file, and the PR links it instead of closing an issue.

**Project skills.** A target repo can list its own skills in `docs/agents/skills.yaml`, in the format of `catalog/skills.yaml` with ids `project/<name>` and paths relative to that repo:

```yaml
skills:
  project/laravel-best-practices:
    path: .claude/skills/laravel-best-practices/SKILL.md
    categories: [framework-review]
    use_when:
      - change touches PHP/Laravel code
```

When one fits the task, the workflow gets a `framework-review` step after the reviews: the change is checked against the project's own conventions, and its findings join the comparison. A repo without the file gets no such step. For now project skills fill only `framework-review`; `scripts/validate-catalog --target <repo>` checks the file.

While running, the router keeps `.router/state.json` and one note per step in `.router/steps/` in the target repo (git-excluded). Where the agent supports subagents, each skill step runs in a fresh subagent on the session's model; steps that talk with the user (requirements, specification, setup) stay in the main session. An unfinished workflow can be resumed later, also from a new session.

## Layout

| Path | What |
|---|---|
| `skills/engineering-router/SKILL.md` | the router skill |
| `skills/engineering-router/resolve-root.js` | finds the router checkout the skill works from |
| `catalog/sources.yaml` | vendor repos and where their skills live |
| `catalog/skills.yaml` | project-owned metadata per skill (phases, use_when, invokes) |
| `catalog/rankings.yaml` | default + fallback skill per phase |
| `catalog/categories.yaml` | the phases |
| `config/preferences.example.yaml` | template for personal overrides (`config/preferences.yaml`, git-ignored) |
| `adapters/pi/` | Pi extension: workflow widget and panel from `.router/state.json` |
| `vendors/` | git submodules, never edited |

## Install (any agent)

For Claude Code, Codex, Cursor, OpenCode and the other agents the [skills CLI](https://github.com/vercel-labs/skills) supports. Needs Node 24+ and git.

```sh
npx skills add marcoax/engineering-skills-router
```

This installs one skill, `engineering-router`, without its catalog, scripts or vendor skills. On each run the router looks for a full checkout and uses the first it finds:

1. the checkout the skill folder sits in (clone and link installs, below);
2. `$ENGINEERING_ROUTER_HOME`, for a personal clone;
3. the Pi package checkout, `~/.pi/agent/git/github.com/marcoax/engineering-skills-router` (used read-only, so one copy of the vendors serves both);
4. `~/.local/share/engineering-skills-router` (`$XDG_DATA_HOME/engineering-skills-router` when that is set).

When none exists, the first run asks before cloning the repo with its submodules into the last of these and running `scripts/setup` there; decline and it stops. Nothing is written into agent skill folders. The router always says which checkout it uses and how it found it.

**Preferences** live in `config/preferences.yaml` of that checkout, so `~/.local/share/engineering-skills-router/config/preferences.yaml` after a first-run fetch. With the Pi checkout, package updates wipe them, so use a personal clone instead. To keep them in a clone you control, or to edit the catalog, clone and set up as in the Pi section's **Personal preferences**, then `export ENGINEERING_ROUTER_HOME=/path/to/clone`.

**Updating.** The installed skill folder is only a bootstrap: once it finds a checkout that contains `skills/engineering-router/SKILL.md`, it follows that file instead of its own, so the router's instructions match the checkout's catalog and scripts. `npx skills update` refreshes only that bootstrap. The checkout is updated by the router's own vendor update check, or by `git pull && scripts/setup` in it (for the Pi checkout, use the package update command in [Install (Pi)](#install-pi)).

The workflow widget is Pi-only.

## Install (Pi)

The repo is a Pi package: the router skill plus the workflow widget. Needs Node 24+ and git; `gh` lets the widget see merged PRs.

```sh
pi install git:github.com/marcoax/engineering-skills-router
```

Pi clones it into `~/.pi/agent/git/`, and `npm install` fetches the vendor submodules (`postinstall`). Only the router is loaded, not the vendor skills. To update only this package:

```sh
pi update git:github.com/marcoax/engineering-skills-router
```

Plain `pi update` updates Pi itself, not the router.

Then, in Pi, `/reload` and `/skill:engineering-router <task>`. Run it with no task, or with the same issue (or spec file, without an issue), to resume an unfinished workflow. To try it for one session without installing: `pi -e git:github.com/marcoax/engineering-skills-router`.

**Personal preferences.** Updating the Pi package resets the installed clone (`git clean -fdx`), so a `config/preferences.yaml` there is lost. To keep preferences, or to edit the catalog, install from your own clone instead (Pi loads a local path without copying or cleaning it):

```sh
git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router && cd engineering-skills-router
scripts/setup
cp config/preferences.example.yaml config/preferences.yaml   # optional
pi install "$PWD"
```

Update that clone with `git pull && scripts/setup`.

### The workflow widget

The extension reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` (or `/router-panel`, for keyboard layouts where the shortcut arrives as another key) toggles a details panel on the right half. While a workflow is open, the panel takes the keyboard: during the skill selection `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit; `p` pauses (a running step finishes first); on a paused workflow `r` resumes; `x x` stops; `esc` goes back to the editor. At session start, a stopped workflow, or a done one with no PR or a merged/closed PR (checked with `gh`), is not shown. Choices are sent as chat messages; the extension never writes the state file.

## Install from a clone (other agents)

Instead of `npx skills add`, clone and set up once, as in **Personal preferences** above (`git clone --recurse-submodules ...`, `scripts/setup`), then link the router skill into the agent's skills folder. The router then uses that clone directly.

Claude Code:

```sh
mkdir -p ~/.claude/skills
ln -s "$PWD/skills/engineering-router" ~/.claude/skills/engineering-router
```

Then `/engineering-router <task>` in any repo (or `/engineering-router` alone to resume). For one project only, link into that project's `.claude/skills/` instead. Update with `git pull && scripts/setup` in the clone.

Codex, Cursor, OpenCode: link or point the agent at `skills/engineering-router/SKILL.md` with whatever skill/rule mechanism it offers.

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [--target <repo>] [phase ...]` | ranked candidates per phase with availability; `--target` adds the repo's project skills |
| `scripts/validate-catalog [--target <repo>] [--verbose]` | checks sources, paths, ids, categories, rankings, preferences; `--target` also checks the repo's `docs/agents/skills.yaml`; `--verbose` lists uncataloged upstream skills |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |
| `scripts/check-state <target-repo>` | checks the target repo's `.router/state.json` against `skills/engineering-router/state.md` |
| `scripts/selftest` | checks the scripts against a scratch catalog and scratch state files, then runs the Pi adapter tests |

Scripts need Node 24+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [docs/adding-a-source.md](docs/adding-a-source.md).
