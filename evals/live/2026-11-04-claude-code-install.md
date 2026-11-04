# Claude Code installation walkthrough (2026-11-04)

Issue #65, verification steps 1–4: follow the README's [Install (Claude Code)](../../README.md#install-claude-code) route from a clean disposable environment, then exercise reruns, conflicts, update and removal, a proposal-only run and the optional backend check. Router at `90a9183`; the README corrections this walkthrough led to were written afterwards, in the same change as this record.

## Setup

- macOS 26.7.1, Claude Code **2.1.318** (CLI only; Desktop and VS Code not exercised), Node 25.2.1, npm 11.6.2, git 2.30.1, gh 2.92.0, codex-cli 0.166.0, opencode 2.1.4.
- Installation steps: `HOME` set to an empty temporary directory, so `~/.claude`, `~/.config` and `~/.npm` were all disposable; the checkout at `$TMP/tools/engineering skills router` (path with spaces), cloned from GitHub. `XDG_CONFIG_HOME`, `ENGINEERING_ROUTER_HOME`, `ENGINEERING_ROUTER_CONFIG` and `CLAUDE_CONFIG_DIR` unset.
- Live sessions: a fresh `HOME` or `CLAUDE_CONFIG_DIR` is not logged in (`Not logged in · Please run /login`), so `claude -p` ran on the maintainer's login with two documented alternatives instead of steps 3–4: both skills linked into a scratch repo's `.claude/skills/` (one project) and the plugin loaded with `--plugin-dir` (one session), `--setting-sources project,local` so the maintainer's own user-level router skill and plugin were not loaded. Preferences from a scratch directory via `ENGINEERING_ROUTER_CONFIG` with `update_check_days: 0`.

## Static walkthrough (no session)

| Step | Result |
| --- | --- |
| 1 `git clone --recurse-submodules` + `scripts/setup` | clone 7 s; three submodules at the pinned commits; `npm ci` added 1 package; `core.hooksPath=.githooks` in the checkout; `catalog OK (107 skills, 3 guides, 0 warning(s))`. Outside the checkout only `~/.npm` (download cache) was written. |
| 2 preferences | created once; a second run left a hand edit in place. |
| 3 skill links | `linked:` twice, then `already linked:` on rerun. With an unrelated directory at `engineering-router` and a dangling link at `skill-selector`: both `left alone, …`, contents unchanged; after removing them, rerun linked. |
| 4 marketplace + plugin | `Successfully added marketplace` / `installed … (scope: user)`; rerun: `already on disk` / `already installed … loads in place from <checkout>/adapters/claude-code`. `claude plugin list`: one entry, `Read from:` the checkout, enabled. `claude plugin validate`: passed. |
| checks | `resolve-root.js` for both skills: `root: <checkout>`, `found: skill-dir`, also with `ENGINEERING_ROUTER_HOME=/nonexistent` (the link wins). `scripts/config`: `source: external`, preferences in `~/.config/engineering-skills-router/`. `scripts/validate-catalog`: OK. |
| marketplace from another clone | `marketplace add <other clone>`: Claude Code reports the repointing; `Read from:` switches to it; adding the checkout again switches back. Still one plugin entry. |
| update | `git pull --ff-only` + `scripts/setup`: exit 0, preferences untouched. A vendor submodule moved by hand to another commit was put back at the pinned commit by `scripts/setup`. With a local commit and nothing upstream, `pull --ff-only` reports up to date (the diverged case was not exercised). |
| uninstall | `plugin uninstall` and `marketplace remove` succeed; `claude plugin list`: none; settings and `installed_plugins.json` hold no entry; links removed with `rm`, checkout and preferences untouched. Claude Code leaves a copy of the plugin in `~/.claude/plugins/cache/engineering-skills-router/` marked `.orphaned_at` (its own cleanup). |

## Live session checks

- **Discovery.** In the session's `init` event: skills `engineering-router`, `skill-selector`; slash commands `engineering-router`, `skill-selector`, `router-panel`, `router-models`; tool `mcp__engineering-router-panel__review_other_family`; MCP server `engineering-router-panel` connected (source: plugin). The skills declare `disable-model-invocation: true`, so the model does not list them when asked; the `/` menu and `/skills` are the check, as the README says.
- **Proposal-only run** on a spec fixture (`/engineering-router docs/specs/csv-export.md` in a scratch Express repo, no remote, `gh` and `git push` denied by rule): reached the workflow and stopped at `Reply: go | … | stop`. Checkout `found: skill-dir`, configuration `source: explicit`, catalog OK, update check off; classification feature / medium / low, light path; issue-free with the spec as handoff. 18 turns, 66 s, 0.32 USD (`claude-sonnet-5-5`), no permission denials. Side effects: `.router/state.json` (status `selecting`), `.router/` in `.git/info/exclude`; no branch, no commit, no issue, no PR.
- **Existing workflow.** A second invocation with another task while the workflow was still `selecting` (shown, not approved) replaced it: by design, only `running`, `waiting`, `paused` and `stopped` count as unfinished (`skills/engineering-router/resume.md`). With the workflow set to `paused` (`scripts/state … reply go`, then `reply pause`), a third invocation with another task named the paused workflow and asked resume or discard; `state.json` byte-identical before and after (4 turns, 0.09 USD).
- **Review-backend check** (in the maintainer's session, plugin installed from the checkout): `review_other_family` with no prompt and no model, nothing picked in `/router-models`: `No backend for model "" …`. With `model: openai-codex/gpt-6-sol`: `available: codex · gpt-6-sol …`. With a made-up `opencode/nonexistent-provider/x`: also `available`: the check covers the CLI only, not the model or the account. No review was started.

## Repository checks

`scripts/validate-catalog` (OK) and `scripts/selftest` (OK) on the change that adds this record; it changes documentation only, so no tests were added. Links in the changed README and docs hunks were checked by hand.

## Limits

The README's in-session checks themselves (`/` menu, `/plugin` Installed tab, `/router-panel`), the backend check driven by `models.openai` from preferences rather than an explicit model, the panel's band and pane drawn in an interactive session (a `-p` session draws no UI; the hooks module loaded and registered its commands and tool), `/reload-plugins`, the Desktop app and VS Code, the install route under a freshly logged-in configuration, the user-scope skill links in a live session (the links were checked by `resolve-root.js`; live discovery used the project-scope links), and a `pull --ff-only` against diverged history.
