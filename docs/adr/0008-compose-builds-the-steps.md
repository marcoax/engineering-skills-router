---
status: accepted
---

# `compose` builds the workflow's steps from the classification and selection

The agent used to write the whole state file: every step, in the default flow's order, with the selector's picks copied into it. `scripts/state … compose` only checked the result. We now give `compose` the two files already checked, the classification (`check-classification`) and the selection (`check-selection`), and it builds the steps itself: the default flow's order with the changes by type and the light path, the router steps, one step per skill, no step for `issue-tracking`, `setup` when tracker-config is missing, optional steps off, and the selection's picks, reasons and notes unchanged. The handoff is set from `--issue` and `--spec`, and user checkpoints from `--checkpoint`. `compose` and `show` print the workflow presentation.

- **One builder.** SKILL.md §2 and §4 stay as the rules, and `compose` applies them; the router no longer asks the agent to write steps, and state.md stays the format reference.
- **Same checks.** The spawned checkers' errors are shown unchanged, and nothing is written when one fails.
- **Recomposition** passes a new selection without `--new`, and keeps completed steps, `primary`, handoff, manual checklist, reviewed revisions and an unrevised classification. A file holding a complete state is refused with a pointer to the new input.

## Evidence

On one repo only (eraCms, PRs #971 to #1017), agents wrote three to nine throwaway scripts per run to turn the selection into steps (issue #96). No other repo was checked.

## Considered options

- **Keep the agent-written state and tighten the checks**: rejected. Every check catches a drift only after the agent has spent the work, and the copying itself is mechanical.
- **A separate `build-state` script that prints a state for `compose`**: rejected. It is a second command for one write, and the agent could still edit the file between the two.

## Consequences

The step order, issue-free decision and setup rule now live in `scripts/lib/compose.js` and are covered by `scripts/compose.test.js` and the selftest. A change to the default flow touches that file and SKILL.md §2 together.
