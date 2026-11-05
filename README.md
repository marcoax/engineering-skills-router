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
2. **One approval.** You swap skills, switch optional steps (an independent review at high risk, agent verification of the checklist) on or off, and answer `go` once. A spec file works the same way: `/engineering-router docs/specs/export.md`.
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

Limitations: it does not make code better or work faster by itself. One [live comparison](evals/live/2026-11-04-ticket-to-pr.md) on a small, low-risk ticket found the same result as a direct prompt naming the same skills, at several times the time and cost; work where review 2 and conditional checks apply has not been measured. Vendor neutrality is designed for (equal standing, no rankings) and checked on a small sample: the 15 [selector evaluation cases](evals/skill-selector/cases.yaml) passed once each on Claude Opus 5.5 (2026-11-04), which shows each collection can be picked when it fits, not that picks are balanced in general. It covers the three collections above plus your personal and project skills. Review 2 on another family needs that provider's CLI and account on your machine.

## Install (Pi)

The repo is a Pi package: both skills plus the workflow widget. Needs Node 22.18+ and git; `gh`, logged in, publishes issues and lets the widget see merged PRs.

```sh
pi install git:github.com/marcoax/engineering-skills-router
```

Pi clones it into `~/.pi/agent/git/`, and `npm install` fetches the vendor submodules (`postinstall`). Only this package's skills are loaded, not the vendor skills. Then, in Pi, `/reload` and `/skill:engineering-router <task>` (or `/skill:skill-selector <task>`); run it with no task to resume. To try it for one session without installing: `pi -e git:github.com/marcoax/engineering-skills-router`.

**Update** with `pi update git:github.com/marcoax/engineering-skills-router` (plain `pi update` updates Pi itself). An update resets the installed clone (`git clean -fdx`), so keep preferences in `~/.config/engineering-skills-router/`: the preferences command in [Steps](#steps), with `ROUTER="$HOME/.pi/agent/git/github.com/marcoax/engineering-skills-router"`. To edit the catalog, install from your own checkout instead (Pi loads a local path without copying or cleaning it): `pi install "$ROUTER"` after cloning and running `scripts/setup`; update it as in [Update](#update).

The workflow widget, its keys and the primary-family menu: [Pi adapter](docs/pi.md).

## Install (Claude Code)

One checkout on your disk serves both the skills and the panel plugin, so they always match. The manual steps the installer automates were walked through with the Claude Code 2.1.318 CLI on macOS ([what ran live](evals/live/2026-11-04-claude-code-install.md)); the installer itself is covered by tests against a stubbed `claude`, not yet by a live run.

**Components**

| Component                         | What it is                                                                                       | Needed                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| checkout                          | this repo: catalog, scripts, pinned vendor skills                                                | yes                                                         |
| `engineering-router` skill        | the router, invoked as `/engineering-router`                                                     | yes                                                         |
| `skill-selector` skill            | the read-only selector, `/skill-selector <task>`                                                 | optional (the router reads it from the checkout either way) |
| `engineering-router-panel` plugin | a mod: workflow band and pane, `/router-panel`, `/router-models`, the `review_other_family` tool | optional                                                    |

**Prerequisites:** git, Node 22.18 or later with npm, Claude Code (CLI; the panel also runs in the Desktop app's Code tab and the VS Code extension, not verified here). Optional: `gh`, logged in, to publish issues and open PRs; Codex or opencode, logged in with a model you can use, for the cross-family reviews. Without either the router still works, but it asks once per run to run the reviews as same-family reviews, marked as not independent.

### Steps

Run in a terminal (choose any absolute checkout path, spaces allowed):

```sh
ROUTER="$HOME/tools/engineering skills router"
git clone https://github.com/marcoax/engineering-skills-router "$ROUTER"
"$ROUTER/scripts/install-claude"
```

The installer runs `scripts/setup`, links both skills and installs the panel from the same checkout. The panel is on by default; it is a mod that runs with your permissions, so to review it first run `claude plugin validate "$ROUTER/adapters/claude-code"` (see [claude-code.md](docs/claude-code.md#the-panel-plugin)) before the installer, or install with `--no-panel`. Then open Claude Code in your project and run `/engineering-router <task>`; in an already-open session, run `/reload-plugins` first.

Use `scripts/install-claude --no-panel` for just the skills; for one project only, see [other routes](docs/claude-code.md#other-installation-routes). Rerunning the installer keeps existing links to this checkout; if another skill occupies either path, it stops before making changes and leaves it alone. `CLAUDE_CONFIG_DIR` is honored when set. Plugin registration can repoint an existing marketplace with the same name; see [existing installations](docs/claude-code.md#an-existing-installation).

`scripts/setup` fetches the pinned vendor submodules, installs the checkout's npm dependencies, enables its pre-commit hook and validates the catalog; apart from npm's download cache it writes nothing outside the checkout. The installer then creates the skill links and asks Claude Code to register the plugin at user scope. If a command fails, it stops; completed steps remain and you can rerun it after fixing the error.

**Preferences are optional.** Defaults work without a file, and the installer never changes your preferences. To customize them (created only if you have none):

```sh
mkdir -p ~/.config/engineering-skills-router
[ -f ~/.config/engineering-skills-router/preferences.yaml ] || cp "$ROUTER/config/preferences.example.yaml" ~/.config/engineering-skills-router/preferences.yaml
```

They live outside the checkout, so updates never touch them ([configuration](docs/configuration.md); `$XDG_CONFIG_HOME` and `ENGINEERING_ROUTER_CONFIG` are honored).

**Where things end up:** the checkout at `$ROUTER`; two symlinks in `~/.claude/skills/`; the marketplace and plugin entries in `~/.claude/settings.json` and `~/.claude/plugins/` (with `CLAUDE_CONFIG_DIR` set, that directory replaces `~/.claude`); preferences in `~/.config/engineering-skills-router/`; during a run, `.router/state.json` in the target repo (with `.router/` added to its `.git/info/exclude`). The `/router-models` choice is kept in Claude Code's mod storage.

### Check before real work

In a terminal:

```sh
node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/engineering-router/resolve-root.js"   # root: <your $ROUTER>, found: skill-dir
(cd "$ROUTER" && scripts/config && scripts/validate-catalog)   # configuration in effect; catalog OK
claude plugin list                                          # engineering-router-panel@engineering-skills-router, enabled, read from $ROUTER
gh auth status                                              # only if the router will publish issues or PRs
```

In a Claude Code session:

- type `/engineering-` and `/skill-`: `/engineering-router` and `/skill-selector` appear in the menu (`/skills` lists them too);
- with the plugin: `/plugin` shows `engineering-router-panel` on the Installed tab, and `/router-panel` toggles the pane;
- cross-family review backend, separately and only if you want it: ask Claude to call `review_other_family` **without a prompt**, with the model from your preferences (`models.openai`, e.g. `openai-codex/<model>`) or after picking one in `/router-models`. It only checks that the backend's CLI is installed and prints `available: …` or why not; it starts no review, and it does not check that your account can use that model. `codex --version` / `opencode --version` in a terminal says the same without Claude Code.

A harmless first run: in a scratch git repo, write a short spec file (e.g. "add a CSV export endpoint with tests"), run `/engineering-router <spec path>`, read the workflow it proposes, and answer `stop`. Up to that point the router only reads, and writes `.router/state.json` there; when the vendor update check is due, the workflow carries an `Updates:` note instead of a question (`update_check_days: 0` in your preferences turns it off). Use a repo with no unfinished workflow: in one that has one (running, waiting, paused or stopped), the router asks whether to resume or discard it and leaves it as it is until you answer. A workflow only shown and never approved does not count: a new task replaces it.

### Update

```sh
git -C "$ROUTER" pull --ff-only
"$ROUTER/scripts/setup"
```

This updates the router, the catalog and the plugin together (`--ff-only` stops, changing nothing, when the checkout has commits of its own: merge or rebase them as in any clone), and `scripts/setup` puts the vendor submodules back at the commits the checkout pins. Then run `/reload-plugins` in open sessions (new sessions load the new version anyway); the linked skills follow the checkout immediately. Your preferences are outside the checkout and stay as they are. Pulling newer vendor revisions than the checkout pins is a separate, reviewed step: `scripts/update` reports what changed upstream and changes the catalog only after you approve its proposal ([vendor updates](docs/reference.md#vendor-updates)); the router notes in its workflow proposal when `update_check_days` have passed.

### More

Pre-existing installations, uninstalling, and other routes (plugin from GitHub, one-session `--plugin-dir`, one project only, `npx skills add`): [Claude Code reference](docs/claude-code.md). Other agents: [install for other agents](docs/install-other-agents.md). What has been exercised, and what has not: [installation walkthrough](evals/live/2026-11-04-claude-code-install.md) (Claude Code 2.1.318 CLI, macOS).

## More

Repo layout, every script (`scripts/stats` adds up run records across PRs), adding a collection: [reference](docs/reference.md). Configuration: [configuration.md](docs/configuration.md).
