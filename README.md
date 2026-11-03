# engineering-skills-router

Routes an engineering task to the smallest workflow of skills drawn from several public collections, without installing or modifying any user-level skill. Why it is built this way: [design rationale](docs/engineering-skills-router-spec.md).

```text
task → classify → phases → one skill per phase → dedupe → show workflow → run
```

The router records the task's type, risk and size, then builds a workflow on the backbone **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by type and risk. A low-risk task gets no workflow: the router offers to do it directly. One review runs by default; a second review on the other model family, a comparison of both and, at high risk, an independent review are offered switched off, and you switch them on when you approve the workflow. Light path, run records, project and personal skills, specs without GitHub issues, starting from a spec you already wrote: [how it works](docs/how-it-works.md).

Browse the [skill index](docs/skill-index.md) for all cataloged vendor skills, grouped into guides, orchestrators, principles and workflow skills by activity.

## Install (Pi)

The repo is a Pi package: the router skill plus the workflow widget. Needs Node 22.18+ and git; `gh`, logged in, publishes the spec issue and the tickets and lets the widget see merged PRs.

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

The extension reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` (or `/router-panel`, for keyboard layouts where the shortcut arrives as another key) toggles a details panel on the right half. While a workflow is open, the panel takes the keyboard: during the skill selection `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit; `p` pauses (a running step finishes first); on a paused workflow `r` resumes; `x x` stops; `esc` goes back to the editor. At session start, a stopped workflow, or a done one with no PR or a merged/closed PR (checked with `gh`), is not shown. Choices are sent as chat messages; the extension never writes the state file itself.

On a new run, before the workflow is shown, the router asks which model family is primary for that run: the extension's `router_primary` tool shows it as a select menu, both families with their model IDs and the current one preselected (`enter` keeps it). The answer goes through `scripts/state <target> primary`, the same command the router uses for the numbered text question where there is no selector; it is not asked again on resume.

## Install (Claude Code)

The whole setup on one machine, from a clone you keep and update with `git pull`. Shell commands run in a terminal; `/…` commands are typed in a Claude Code session.

1. **Clone and set up** (skip the clone if you have one):

   ```sh
   git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router ~/web/ai/engineering-skills-router
   cd ~/web/ai/engineering-skills-router
   scripts/setup
   [ -f config/preferences.yaml ] || cp config/preferences.example.yaml config/preferences.yaml
   ```

   The last line creates your preferences only when you have none. In them, `models.openai` picks review 2's backend: `openai-codex/<model>` (Codex) or `opencode/<provider>/<model>`.

2. **Link the skill and point the router at the clone**:

   ```sh
   mkdir -p ~/.claude/skills
   ln -s ~/web/ai/engineering-skills-router/skills/engineering-router ~/.claude/skills/engineering-router
   echo 'export ENGINEERING_ROUTER_HOME=~/web/ai/engineering-skills-router' >> ~/.zshrc && source ~/.zshrc
   ```

   Check with `ls -la ~/.claude/skills/engineering-router`: it must point into the clone. The skill follows the branch checked out in the clone; stay on `master`.

3. **Install the mod from the clone**, in a Claude Code session:

   ```text
   /plugin marketplace add ~/web/ai/engineering-skills-router
   /plugin install engineering-router-panel@engineering-skills-router
   /reload-plugins
   ```

   `engineering-skills-router` is the marketplace's name (from `.claude-plugin/marketplace.json`), `engineering-router-panel` the plugin's. `/plugin` shows `1 mod active · engineering-router-panel` when it loaded. Done once; every later session loads it.

4. **GitHub and review 2**: `gh auth status` (the spec issue and the tickets are published with `gh`); for review 2 on OpenAI (optional), `codex --version`, then `codex login`.

5. **Use it**, in a session opened on the target repo:

   ```text
   /router-models                       pick review 2's backend, model and effort (optional; kept across sessions)
   /engineering-router <issue or task>  classify, show the workflow, wait for go
   /engineering-router                  resume an unfinished workflow
   /router-panel                        open the workflow pane and choose with keys
   ```

   On first run the router prints `root:`: it must be the clone.

The mod draws the workflow as a band above the prompt and a pane with the skill selection, and runs review 2 on Codex or opencode: [Claude Code mod](docs/claude-code.md).

**Updating**: `git pull && git submodule update --init && scripts/setup` in the clone, then `/plugin marketplace update engineering-skills-router` and `/reload-plugins` in Claude Code.

## Other agents

Codex, Cursor, OpenCode, or any agent through `npx skills add`: [install for other agents](docs/install-other-agents.md).

## Scripts

| Script | Does |
|---|---|
| `scripts/stats [--repo <owner/name>] [--limit <n>] [--json]` | adds up the run records in a repo's PRs (via `gh`): per review and model, per skill, per severity, checklists, tokens |
| `scripts/validate-catalog [--target <repo>]` | checks the catalog, your preferences and personal skills; `--target` also checks a repo's project skills (`docs/agents/skills.yaml`) |
| `scripts/update` | pulls vendor submodules, prints added/removed skills; never edits the catalog |

Repo layout, every script, adding a collection: [reference](docs/reference.md).
