# Repo layout and scripts

For working on the router itself or its catalog. Install and use: the [README](../README.md).

## Layout

| Path | What |
|---|---|
| `skills/engineering-router/SKILL.md` | the router skill: what every run needs; the files beside it (`light.md`, `cross-family-review.md`, `after-implementation.md`, …) are read only when a run reaches them |
| `skills/skill-selector/SKILL.md` | the selector skill: a read-only proposal of which skill fits each phase of a task, consulting the vendor guides, with vendors on equal standing |
| `skills/*/resolve-root.js` | finds the router checkout a skill works from; identical in both skills |
| `evals/skill-selector/cases.yaml` | behavioral evaluation cases for the selector, with the model and effort to record per run |
| `catalog/sources.yaml` | vendor repos and where their skills live |
| `catalog/skills.yaml` | project-owned metadata per skill (phases, use_when, invokes); descriptions are read from each `SKILL.md` |
| `catalog/guides.yaml` | vendor guides consulted for selection: source and path only, never phase candidates |
| `catalog/categories.yaml` | the phases |
| `catalog/reviewed.yaml` | per source, the vendor revision the catalog was last reviewed against; written only by `scripts/update --approve` ([vendor updates](#vendor-updates)) |
| `config/preferences.example.yaml` | template for personal overrides (`preferences.yaml` in the configuration directory, [configuration.md](configuration.md)) |
| `config/personal-skills.example.yaml` | template for your own skills (`personal-skills.yaml` beside it) |
| `adapters/pi/` | Pi extension: workflow widget and panel from `.router/state.json`, and the `router_primary` select menu for the primary question |
| `vendors/` | git submodules, never edited |
| `adapters/claude-code/` | Claude Code plugin: workflow band and panes, cross-family reviews through Codex or opencode ([claude-code.md](claude-code.md)) |
| `.claude-plugin/marketplace.json` | makes the repo a Claude Code marketplace for that plugin |
| `skills/engineering-router/run-record.md` | the run record each PR carries, read by `scripts/stats` |
| `.github/workflows/checks.yml` | CI: the repo's checks on every PR and push to `master` ([CI](#ci)) |

## Scripts

| Script | Does |
|---|---|
| `scripts/list-skills [--target <repo>] [phase ...]` | candidates per phase on equal standing, with availability and origin `preference`, `project`, `personal` or `vendor` (vendor and personal skills by name, not ranked); with phases, each candidate's source description (from its `SKILL.md` frontmatter) and catalog metadata; `--target` adds the repo's project skills |
| `scripts/list-skills --guides` | the registered vendor guides with their source descriptions |
| `scripts/check-classification <file>` | checks a classification against [classification.md](../skills/engineering-router/classification.md): every fact has evidence, risk is at least the minimum its facts set, a requested or chosen path is one the policy offers; prints the policy revision, the minimum risk with its facts, the offer with any proposal, the `reason:` that chose it (risk, complexity, ticket, recorded facts) and any uncertainty; reads only |
| `scripts/check-selection [--target <repo>] <file>` | checks a selector proposal (JSON, or Markdown ending in a ```` ```json ```` block): every default and alternative is an `ok` candidate for its phase, at most two alternatives, every pick and phase has a reason; a `cost: high` pick's reason starts "High cost" and it is a default only with `"explicit": true`; a pick's harness `requires` (`subagents`, `isolated-outputs`) are among the selection's `capabilities`; reads only |
| `scripts/skill-index [--check]` | regenerates `docs/skill-index.md` from the guides, the catalog and the checked-out vendor revisions; `--check` only reports a stale index |
| `scripts/validate-catalog [--target <repo>] [--verbose]` | checks sources, paths, ids, categories, preferences, personal skills, guides (source ownership, never also a skill); warns on unreadable descriptions and a leftover `catalog/rankings.yaml` (no longer read); `--target` also checks the repo's `docs/agents/skills.yaml`; `--verbose` lists uncataloged upstream skills |
| `scripts/config [migrate [--yes]]` | prints the user configuration in effect (source, directory, files, ignored clone-local files); `migrate` shows, and with `--yes` performs, a validated move of `config/` files out of the checkout ([configuration.md](configuration.md)) |
| `scripts/update [--check \| --approve [patch]]` | pulls vendor submodules (`--check`: no pull) and reports what needs catalog review; never edits the catalog. `--approve [patch]` applies a confirmed catalog patch, validates and records the reviewed revisions ([vendor updates](#vendor-updates)) |
| `scripts/check-state <target-repo>` | checks the target repo's `.router/state.json` against `skills/engineering-router/state.md` |
| `scripts/selftest` | checks the scripts against a scratch catalog and scratch state files, the installable skills and the selector eval references, then runs the Pi adapter tests |
| `scripts/context-threshold` | read-only adapter bridge: prints the context threshold of the configuration in effect (150000 by default) |
| `scripts/state <target-repo> compose\|step\|workflow\|handoff\|reply\|primary\|show\|model\|progress\|check\|interrupt\|recover\|expect\|deliver\|artifact\|claim\|takeover\|owner\|discard\|reconcile ...` | the router's only way to write `.router/state.json`: `compose [--new] <file>` writes a composed workflow after checking every skill and alternative is a usable candidate for its step's phases and that a `cost: high` one's reason starts "High cost", checking the classification as `check-classification` does, and recalculating coverage (`--new` never replaces an unfinished run; without it, completed steps, `primary`, handoff and an unrevised classification stay); a swap reply recalculates coverage from the new skill; every change is validated with `check-state`, keeping the old file when invalid; `primary` prints the primary question (the current family first), or, when `preferences.yaml` names `primary`, a `primary:` line instead of a question (`--json` gives the preset family and the options to a selector); `primary <n\|family>` and the reply `primary <family>` set the run's `primary`; all only while the workflow is `selecting`; `show` prints each step with its reason, alternatives and the selector's notes; `model <step>` prints the model a step runs on, from the run's `primary` in the state; `progress`, `check` and `interrupt` write a running step's progress record, and `recover` reads it against the checkout (ADR 0003); `expect <step>` declares a delegated step's delivery, `deliver <step> [file]` accepts its step result only when it is for that step and attempt, has a verdict and carries valid declared artifacts, and `artifact <step> <kind>` prints an accepted artifact's path (ADR 0004); only the session in the state's `owner` may change it (ADR 0002): `claim` (no owner yet), `takeover` (explicit handover), `owner`, `discard` (archives state and notes in `.router/runs/<run>/`) and `reconcile` (state beside branch, commits, PR and notes, for a resume) |
| `scripts/record <target-repo> [--findings f] [--checklist p,a[,ok,ko]] [--pr n] ...` | composes the run record from the state and the findings (by default the pull-request step's accepted findings), and writes it into the PR body |
| `scripts/stats [--repo <owner/name>] [--limit <n>] [--json]` | adds up the run records in a repo's PRs (via `gh`): per review and model, per skill, per severity, checklists, tokens |

Scripts need Node 22.18+; `scripts/setup` installs their only dependency (`yaml`).

Adding a collection: [adding-a-source.md](adding-a-source.md).

## Checkout resolution

Both skills start with `node <skill folder>/resolve-root.js`, which prints the checkout (`root:`) and how it was found (`found:`), taking the first location that holds `catalog/skills.yaml`:

1. `skill-dir`: the checkout the skill folder belongs to, after following symlinks. A skill linked from a checkout (README route, Pi from a local path) always lands here, whatever the environment says.
2. `env`: `$ENGINEERING_ROUTER_HOME`, for a copied skill that should use a checkout of your own.
3. `pi`: the Pi package checkout, `${PI_CODING_AGENT_DIR:-~/.pi/agent}/git/github.com/marcoax/engineering-skills-router`, used read-only. Any location that is this checkout reports `found: pi`.
4. `data-dir`: `$XDG_DATA_HOME/engineering-skills-router`, else `~/.local/share/engineering-skills-router`.

Nothing found prints `missing` and the `data-dir`, where the router offers to clone ([checkout.md](../skills/engineering-router/checkout.md)). A skill running from a copy outside the checkout also prints `skill:` and follows that checkout's own `SKILL.md`. The resolver only reads; `scripts/selftest` covers each case.

## Vendor updates

The submodule gitlinks pin the vendor revisions that are checked out. `catalog/reviewed.yaml` records, per source, the revision the catalog was last reviewed against; only `scripts/update --approve` writes it. `scripts/config` reports whether the update check is due (`update-check:`); the router then notes it in the workflow proposal and runs this flow when the user asks ([checkout.md](../skills/engineering-router/checkout.md)):

1. `scripts/update` pulls the submodules from upstream (`--check` skips the pull) and reports, per source, the reviewed and checked-out revisions with a `git diff` command between them, then every `SKILL.md` added (`+`), modified at the same path (`~`), removed (`-`) or moved (`>`), upstream skills not cataloged (`?`) and cataloged paths gone (`!`). It compares with the reviewed revision, not the previous pull, so repeated updates keep unapproved changes listed. A source without a reviewed revision gets an initialization report listing all its skills (`=` cataloged); nothing is recorded as reviewed until approved. A failed pull exits non-zero.
2. The agent reads the reported skills and proposes a diff of `catalog/skills.yaml` and `catalog/guides.yaml`: new skills registered, changed entries updated, removed or moved ones resolved, including `invokes`. No vendor ranking or default order is added. Nothing changes before the user confirms.
3. **Confirmation point.** `scripts/update --approve [patch]` applies the patch (it may touch only those two files), runs `scripts/validate-catalog`, requires every upstream skill cataloged, regenerates `docs/skill-index.md`, then records the checked-out revisions. Any failure restores the catalog and the index and records nothing. Without a patch it acknowledges a report that needs no catalog change. Afterwards `scripts/update --check` on the same revisions reports nothing to review.

Commit the catalog, `catalog/reviewed.yaml`, the index and the vendor pins together.

## CI

The `checks` workflow (job **catalog, selftest, adapters** on the PR) runs on every pull request and every push to `master`, on a clean Ubuntu runner:

1. checkout with vendor submodules at the revisions recorded by the commit; the job fails if a submodule is missing or at another revision. It never runs `scripts/update` or advances a vendor branch;
2. Node 22 (latest 22.x, which satisfies the scripts' 22.18+) and `npm ci` from `package-lock.json`;
3. `scripts/validate-catalog`: a missing skill path or any other catalog error fails the job;
4. `scripts/selftest`: scratch catalogs, scratch target repos and state files, then the Pi adapter tests (they run there only, not a second time);
5. `claude plugin test adapters/claude-code`: the Claude Code adapter tests, run by the Claude Code CLI version pinned in the workflow (`CLAUDE_CODE_VERSION`, installed from npm; bump it deliberately). The command exits non-zero when a test fails or when it finds no tests, so the step cannot pass without running them.

The job reads no user configuration (`config/` or the external directory, [configuration.md](configuration.md)), user-level agent folder or provider credential, and calls no model: the adapter tests replace the session, tools and processes with the harness's fakes. A green run covers the scripts and both adapters' automated tests. It is not live acceptance: discovering the router in a real Pi or Claude Code session, drawing the band and pane, and running a cross-family review through Codex or opencode still need a check in an interactive session.

The local pre-commit hook is unchanged; CI repeats the checks for contributors who have not installed it or bypassed it.

## Context preference

In your `preferences.yaml` under `preferences`, `context_threshold` is an integer >= 0, default **150000** tokens; **0** disables context questions. Validation rejects negative, fractional, non-finite and non-numeric values. A missing or invalid value falls back to the default; an unreadable configuration file makes `scripts/context-threshold` exit with its error, which the adapters show as a `config:` line after the step.

Claude Code and Pi add `context: <tokens> of <window> window, threshold <threshold>` only after a successful, foreground `scripts/state <target repo> step <n|id> done` command, at or above the threshold with known tokens/window. Run that command separately: shell batches/chains are deliberately left unannotated. Quoted paths, a `node` prefix and state flags are supported. No adapter means no measurement. Warnings are informational, including above 80% of the window; a fresh-session handoff is reserved for capacity that prevents further execution after available recovery. See [context at a step boundary](how-it-works.md#context-at-a-step-boundary).
