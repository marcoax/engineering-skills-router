---
status: accepted
---

# An explicit choice or a remembered selection decides a phase without selection

The selector consulted every guide and read every shortlisted `SKILL.md` in full for every phase of every run. We now decide a phase before selection whenever one of these holds, in this order: a skill the user named in the request, a `prefer` in `preferences.yaml`, a skill the project declares in `docs/agents/skills.yaml` (the three are an **explicit choice**), or a **remembered selection**. A phase settled this way is a **decided phase**: no guide is consulted and no `SKILL.md` is read for it. Only the remaining phases go through selection, which stays as it was: guides read, shortlisted candidates read in full.

- **Memory per phase, not per workflow.** The phases of a run are still chosen from its classification every time; only the skill that fills a phase is remembered.
- **Derived, not stored.** A remembered selection is read from the project's archived runs (`.router/runs/*/state.json`): the skill of the last run whose step for that phase reached `done`, including a skill swapped in with `reply`. Discarded runs, `skipped` or `pending` steps and `legacy-*` runs do not count. There is no separate memory file.
- **Expiry.** A remembered selection is dropped, and the phase selected again, when the skill is no longer `ok` for the phase, when its vendor's reviewed revision differs from the one the remembered run recorded, or when the phase has a candidate the remembered run had neither selected nor listed as an alternative. It does not expire by age, nor because the task's type or risk differs. A run records the reviewed vendor revisions at composition.
- **In the script.** `scripts/list-skills` resolves the precedence and prints, for a decided phase, the skill, its origin and its alternatives; `check-selection` refuses a selection that replaces a decided phase's skill without the user asking. The user can ask for a full selection of every phase.
- **Shown.** A decided step's `reason` is its origin (`preference`, `project`, `remembered · <run>`); a selected step keeps the selector's reason. Alternatives, optional steps that are off and omitted phases are shown as before, so `reply` works unchanged.

## Evidence

Six Claude Code sessions on one repo only (eraCms, PRs #971 to #1017, 2026-11-07 to 2026-11-10) and its ten archived runs. No other repo was checked.

- The main session read 41 to 119 KB of guide and candidate markdown per run before the first step, and did not execute those skills itself.
- The skill per phase was the same in every archived run that had the phase: `project/eracms-implement-spec`, `personal/advanced-code-review`, `project/laravel-best-practices`, `addyosmani/security-and-hardening`, `mattpocock/pr`. The set of phases varied: `framework-review` ran in 6 of 10 runs, `independent-review` and `code-understanding` in one each.
- Four of those phases already had an explicit choice (`project` or `preference` in `list-skills`); only `security` and `pull-request` were open.

## Considered options

- **Remember the whole workflow per type and risk**: rejected. The phases vary between runs of the same type and risk, so the memory would often be wrong about them.
- **A dedicated memory file in `.router/`**: rejected. It is a second place to keep in step with the runs, and deliberate choices already have a home in `prefer` and `docs/agents/skills.yaml`.
- **Select from catalog metadata only, opening a `SKILL.md` on a tie**: rejected. It drops the vendors' own guidance and makes quality depend on how well the catalog is kept; with decided phases, full reading is paid rarely and where it matters.
- **State the precedence in the selector's prose**: rejected. The rule would be applied at the model's discretion and could not be covered by the selftest.

## Consequences

A generic project skill is proposed even for a task it fits poorly; the user sees the workflow before `go` and can swap it. A vendor update expires every remembered selection of that vendor at once, including skills that did not change.
