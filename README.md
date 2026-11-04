# engineering-skills-router

A skill for coding agents (Claude Code, Pi, and others through their skill mechanism) that turns one engineering task, typically a ticket or spec you already have, into a short workflow of skills drawn from three public collections ([pstack](https://github.com/backnotprop/pstack), [Matt Pocock](https://github.com/mattpocock/skills), [Addy Osmani](https://github.com/addyosmani/agent-skills)), shows it to you, and runs it to an open pull request after one approval. The vendor skills are read from pinned copies inside this repo; none is installed into your agent. Why it is built this way: [design rationale](docs/engineering-skills-router-spec.md).

```text
task → classify → select one skill per phase → show workflow → go → … → open PR
```

## Who it is for

Developers who already use an agent for real changes and want a repeatable route from ticket to reviewed PR, with the choice of skills made visible instead of implicit. It is not a code generator of its own: each step runs a vendor skill (or your own, or your project's) in your agent, with your agent's model and permissions.

## Example: starting from a ticket

In a Claude Code session opened on the repo the ticket is about:

```text
/engineering-router #123
```

1. **Proposal.** The router reads the issue (`gh`) and the code it touches, records the task's type, risk, size and properties with a reason each, and has the [skill selector](skills/skill-selector/SKILL.md) pick one skill per phase (default plus up to two alternatives, with reasons). It shows the workflow and waits. A low-risk task gets no workflow: the router offers to do it directly. A medium-risk ticket of low complexity is proposed the short **light** path (implementation, a fresh review, PR), with `full` one reply away.
2. **One approval.** You swap skills, switch optional steps (a second review on another model family, a comparison of both) on or off, and answer `go` once. A spec file works the same way: `/engineering-router docs/specs/export.md`.
3. **Progress.** The router runs the steps in order (branch, implementation, tests, reviews, in-scope fixes, commits, push) and reports progress as it goes, without asking to continue after each step.
4. **Exceptions only.** It stops for an unresolved decision, a scope or risk change, a missing prerequisite or credential, a reproducible blocker, or a checkpoint you asked for. `pause` and `stop` work at any time; `/engineering-router` with no task resumes an unfinished workflow.
5. **Stopping point.** It ends with the PR open, carrying a short manual checklist and a hidden run record. Merge and deployment need your separate authorization.

Details: [how it works](docs/how-it-works.md), [execution policy](skills/engineering-router/autonomy.md).

## What it adds, and what it does not

Your agent already runs skills, subagents and git. The router adds:

- **Selection you can see.** Every cataloged vendor skill starts on equal terms; the selector reads each vendor's guide and the candidate skills and gives reasons. `scripts/state … compose` refuses a skill that is not a usable candidate for its step. Browse the [skill index](docs/skill-index.md).
- **Checked classification.** Risk is the model's judgment, but evidenced facts (authorization, payments, destructive changes, sensitive data, public contracts) set a minimum that `scripts/check-classification` enforces.
- **One workflow state.** `.router/state.json` in the target repo lets you pause, resume, swap a skill or see the workflow in the Pi widget or the Claude Code panel.
- **Optional review on another model family** (Claude Code: through your own Codex or opencode CLI), switched off unless you turn it on.
- **Run records** in each PR, which `scripts/stats` adds up across PRs.

Limitations: it does not make code better or work faster by itself, and no measurement of either has been recorded. Whether its picks are balanced across vendors is designed for (equal standing, no rankings) but not yet measured: the [selector evaluation cases](evals/skill-selector/cases.yaml) have not been run. It covers the three collections above plus your personal and project skills. Review 2 on another family needs that provider's CLI and account on your machine.

## Install (Claude Code)

One checkout on your disk serves both the skills and the panel plugin, so they always match. Exercised with Claude Code 2.1.317 on macOS ([walkthrough record](#what-has-been-verified)).

**Components**

| Component | What it is | Needed |
|---|---|---|
| checkout | this repo: catalog, scripts, pinned vendor skills | yes |
| `engineering-router` skill | the router, invoked as `/engineering-router` | yes |
| `skill-selector` skill | the read-only selector, `/skill-selector <task>` | optional (the router reads it from the checkout either way) |
| `engineering-router-panel` plugin | a mod: workflow band and pane, `/router-panel`, `/router-models`, the `review_other_family` tool | optional |

**Prerequisites:** git, Node 22.18 or later with npm, Claude Code (CLI; the panel also runs in the Desktop app's Code tab and the VS Code extension, not verified here). Optional: `gh`, logged in, to publish issues and open PRs; Codex or opencode, logged in with a model you can use, only if you want review 2 on another family. The router works without either.

### Steps

Commands in `sh` blocks run in a terminal; `/…` commands are typed in a Claude Code session. Pick any absolute checkout path, spaces allowed; `ROUTER` is a variable for this terminal only (no shell-profile change).

1. **Checkout.**

   ```sh
   ROUTER="$HOME/tools/engineering skills router"     # your choice; absolute
   git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router "$ROUTER"
   "$ROUTER/scripts/setup"
   ```

   `scripts/setup` fetches the vendor submodules at their pinned commits, runs `npm ci` (one dependency, `yaml`, into the checkout's `node_modules`), sets `core.hooksPath=.githooks` in **the checkout's** git config (a pre-commit hook for working on the router itself) and validates the catalog. Apart from npm's download cache, it writes nothing outside the checkout, and nothing into any project you later use the router on.

2. **Preferences** (optional; created only if you have none):

   ```sh
   mkdir -p ~/.config/engineering-skills-router
   [ -f ~/.config/engineering-skills-router/preferences.yaml ] || cp "$ROUTER/config/preferences.example.yaml" ~/.config/engineering-skills-router/preferences.yaml
   ```

   They live outside the checkout, so updates never touch them ([configuration.md](docs/configuration.md); `$XDG_CONFIG_HOME` and `ENGINEERING_ROUTER_CONFIG` are honored). Without the file, documented defaults apply.

3. **Skills.** Link both into Claude Code's personal skills folder; an existing entry of the same name is reported and left alone:

   ```sh
   mkdir -p ~/.claude/skills
   for s in engineering-router skill-selector; do
     link="$HOME/.claude/skills/$s"
     if [ "$(readlink "$link")" = "$ROUTER/skills/$s" ]; then echo "already linked: $link"
     elif [ -e "$link" ] || [ -L "$link" ]; then echo "left alone, something else is there: $link"
     else ln -s "$ROUTER/skills/$s" "$link" && echo "linked: $link"; fi
   done
   ```

   A linked skill finds its checkout through the link, so no `ENGINEERING_ROUTER_HOME` is needed ([checkout resolution](docs/reference.md#checkout-resolution)). For one project only, link into that project's `.claude/skills/` instead.

4. **Panel plugin** (optional):

   ```sh
   claude plugin marketplace add "$ROUTER"
   claude plugin install engineering-router-panel@engineering-skills-router
   ```

   This registers the checkout as the local marketplace `engineering-skills-router` and enables the plugin at user scope (`~/.claude/settings.json`). Claude Code reads the plugin in place from `$ROUTER/adapters/claude-code`. A mod runs with your permissions: review it with `claude plugin validate "$ROUTER/adapters/claude-code"` and [claude-code.md](docs/claude-code.md). Already-open sessions pick it up after `/reload-plugins`.

**Where things end up:** the checkout at `$ROUTER`; two symlinks in `~/.claude/skills/`; the marketplace and plugin entries in `~/.claude/settings.json` and `~/.claude/plugins/`; preferences in `~/.config/engineering-skills-router/`; during a run, `.router/state.json` in the target repo (with `.router/` added to its `.git/info/exclude`). The `/router-models` choice is kept in Claude Code's mod storage.

### Check before real work

In a terminal:

```sh
node ~/.claude/skills/engineering-router/resolve-root.js   # root: <your $ROUTER>, found: skill-dir
(cd "$ROUTER" && scripts/config && scripts/validate-catalog)   # configuration in effect; catalog OK
claude plugin list                                          # engineering-router-panel@engineering-skills-router, enabled, read from $ROUTER
gh auth status                                              # only if the router will publish issues or PRs
```

In a Claude Code session:

- type `/engineering-` and `/skill-`: `/engineering-router` and `/skill-selector` appear in the menu (`/skills` lists them too);
- with the plugin: `/plugin` shows `engineering-router-panel` on the Installed tab, and `/router-panel` toggles the pane;
- review 2 backend, separately and only if you want it: ask Claude to call `review_other_family` **without a prompt**. It only checks that the CLI is installed and prints `available: …` or why not; it starts no review. `codex --version` / `opencode --version` in a terminal says the same without Claude Code.

A harmless first run: in a scratch git repo, write a short spec file (e.g. "add a CSV export endpoint with tests"), run `/engineering-router <spec path>`, read the workflow it proposes, and answer `stop`. Up to that point the router only reads, writes `.router/state.json` there, and asks whether to check vendor updates now (decline; `update_check_days: 0` in your preferences turns that question off). Use a repo with no unfinished workflow: in one that has one, the router offers to resume it instead and leaves it as it is.

### Update

```sh
git -C "$ROUTER" pull --ff-only
"$ROUTER/scripts/setup"
```

This updates the router, the catalog and the plugin together (`--ff-only` stops, changing nothing, when the checkout has commits of its own: merge or rebase them as in any clone), and `scripts/setup` puts the vendor submodules back at the commits the checkout pins. Then run `/reload-plugins` in open sessions (new sessions load the new version anyway); the linked skills follow the checkout immediately. Your preferences are outside the checkout and stay as they are. Pulling newer vendor revisions than the checkout pins is a separate, reviewed step: `scripts/update` reports what changed upstream and changes the catalog only after you approve its proposal ([vendor updates](docs/reference.md#vendor-updates)); the router offers it every `update_check_days`.

### An existing installation

- **Skill links:** step 3 leaves anything already at `~/.claude/skills/engineering-router` or `skill-selector` alone. If it is a link to an older clone, or a copy from `npx skills add`, decide which to keep; remove a link with `rm ~/.claude/skills/engineering-router` (no `-r`: this removes the link only) and rerun step 3.
- **Marketplace from another clone or from GitHub:** adding `$ROUTER` repoints the existing `engineering-skills-router` marketplace to it (Claude Code says so), and the installed plugin then loads from `$ROUTER`; there is still one copy. Adding the previous source again undoes it. Rerunning step 4 against the same checkout changes nothing.
- **`ENGINEERING_ROUTER_HOME` in your shell profile:** not used by linked skills (the link wins); remove it unless you use a copied skill elsewhere.
- **Preferences in the checkout's `config/`:** `scripts/config` reports them; `scripts/config migrate` shows how to move them out ([configuration.md](docs/configuration.md#moving-clone-local-configuration-out)).

### Uninstall

```sh
claude plugin uninstall engineering-router-panel@engineering-skills-router
claude plugin marketplace remove engineering-skills-router
ls -l ~/.claude/skills/engineering-router ~/.claude/skills/skill-selector    # confirm both point into $ROUTER
rm ~/.claude/skills/engineering-router ~/.claude/skills/skill-selector       # removes the links only
```

Then delete `$ROUTER` if you no longer want it. `~/.config/engineering-skills-router/` is yours to keep or delete; a target repo's `.router/` belongs to its runs.

### Alternatives

Plugin from GitHub without a clone, one-session `--plugin-dir`, `CLAUDE_CONFIG_DIR`, `npx skills add`: [Claude Code reference](docs/claude-code.md#other-installation-routes). Other agents: [install for other agents](docs/install-other-agents.md).

### What has been verified

Recorded in the #65 walkthrough: the commands above in a disposable configuration directory with a checkout path containing spaces (Claude Code 2.1.317, Node 25.2.1, git 2.30.1, macOS), including reruns, a conflicting entry, marketplace repointing and removal. Discovery of the skills in a live session, the panel, and a proposal-only run are still to be confirmed in an interactive session. CI covers the scripts and the adapters' automated tests ([CI](docs/reference.md#ci)).

## Install (Pi)

The repo is a Pi package: both skills plus the workflow widget. Needs Node 22.18+ and git; `gh`, logged in, publishes issues and lets the widget see merged PRs.

```sh
pi install git:github.com/marcoax/engineering-skills-router
```

Pi clones it into `~/.pi/agent/git/`, and `npm install` fetches the vendor submodules (`postinstall`). Only this package's skills are loaded, not the vendor skills. Then, in Pi, `/reload` and `/skill:engineering-router <task>` (or `/skill:skill-selector <task>`); run it with no task to resume. To try it for one session without installing: `pi -e git:github.com/marcoax/engineering-skills-router`.

**Update** with `pi update git:github.com/marcoax/engineering-skills-router` (plain `pi update` updates Pi itself). An update resets the installed clone (`git clean -fdx`), so keep preferences in `~/.config/engineering-skills-router/`: step 2 above with `ROUTER="$HOME/.pi/agent/git/github.com/marcoax/engineering-skills-router"`. To edit the catalog, install from your own checkout instead (Pi loads a local path without copying or cleaning it): `pi install "$ROUTER"` after step 1 above; update it as in [Update](#update).

### The workflow widget

The extension reads `.router/state.json` in the session's repo and shows the steps above the editor. `ctrl+alt+w` (or `/router-panel`, for keyboard layouts where the shortcut arrives as another key) toggles a details panel on the right half. While a workflow is open, the panel takes the keyboard: during the skill selection `↑`/`↓` step, `enter` go, `a`/`b` swap the step's skill, `e` edit; `p` pauses (a running step finishes first); on a paused workflow `r` resumes; `x x` stops; `esc` goes back to the editor. At session start, a stopped workflow, or a done one with no PR or a merged/closed PR (checked with `gh`), is not shown. Choices are sent as chat messages; the extension never writes the state file itself.

On a new run, before the workflow is shown, the router asks which model family is primary for that run: the extension's `router_primary` tool shows it as a select menu, both families with their model IDs and the current one preselected (`enter` keeps it). The answer goes through `scripts/state <target> primary`, the same command the router uses for the numbered text question where there is no selector; it is not asked again on resume.

## Scripts

| Script | Does |
|---|---|
| `scripts/stats [--repo <owner/name>] [--limit <n>] [--json]` | adds up the run records in a repo's PRs (via `gh`): per review and model, per skill, per severity, checklists, tokens |
| `scripts/validate-catalog [--target <repo>]` | checks the catalog, your preferences and personal skills; `--target` also checks a repo's project skills (`docs/agents/skills.yaml`) |
| `scripts/config [migrate [--yes]]` | prints the configuration in effect; `migrate` moves clone-local preferences out of the checkout |
| `scripts/update [--check \| --approve [patch]]` | pulls vendor submodules and reports skills added, modified, removed or moved since the last reviewed revision, plus uncataloged ones; after you confirm the proposed catalog change, `--approve` applies it, validates and records the reviewed revisions ([vendor updates](docs/reference.md#vendor-updates)) |

Repo layout, every script, adding a collection: [reference](docs/reference.md).
