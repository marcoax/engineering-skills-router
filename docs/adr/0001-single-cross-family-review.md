---
status: accepted
---

# One cross-family review replaces review 1 and review 2

Review 1 ran on the implementation's own model, and independence came only from the optional review 2 on the opposite family, which was mostly off. We replace both with a single required `review` step that is a **cross-family review**: it runs on the family opposite to the one the implementation step actually ran on, whatever `primary` or a phase's `model` says. The same rule holds for every step that reviews code: security, framework-review, independent-review, and the fresh re-check after fixes. Review 2 and the comparison step are removed; findings are always consolidated, and `found_by` still records which review found what.

When the other family is unreachable (tool error, quota, no provider), the run asks once whether to continue on the same family in a fresh subagent. A step run that way is a same-family review, and the workflow, summary and run record say so; it is never silently relabelled.

When the implementation skill calls its own review (e.g. `mattpocock/implement` calling `code-review`), the step is told to skip it: there is no covered review any more.

Old run records keep `review-2` and `comparison` as they are, and `scripts/stats` reads them unchanged. A paused run that resumes with those steps closes them as `skipped` with "removed from the process".

## Evidence

A retro of the last 10 router runs on one repo only (eraCms, PRs #940–#963, 2026-10-24 to 2026-11-04). No other repo was checked.

- Review 1 ran on the same model as the implementation in 4 of 9 runs, including all 3 Claude Code runs.
- Review 2 ran on the opposite family in only 2 runs. In #951 it found 3 medium findings that review 1 missed, and all were fixed. In #945, where it fell back to the same family, everything it found alone was low and declined.
- Same-family fallbacks happened silently twice. In #945 `review_other_family` failed with `invalid_union`. In #961 the Claude quota ran out and review 1 ran on gpt. Neither run record states it.

## Considered options

- **Different Claude model for review** (e.g. Opus writes, Sonnet reviews): rejected. The family is the same, so the blind spots stay shared.
- **Keep the implementation skill's internal review plus the cross-family one**: rejected. It is two reviews again, at double cost.
- **Cross-family only for the general review, the rest on the implementation's family**: rejected in favour of one rule for every review step. It accepts more use of the other family's quota, which is already the main constraint: a Codex quota limit stopped #963.
