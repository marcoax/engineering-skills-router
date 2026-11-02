# From implementation to pull request

Read from SKILL.md §6 when the implementation step is about to start. It holds everything from there to the open PR: the covered review, the manual checklist, the user's check, the comparison, security and fixes, verification, and the pull request with its run record. Review 2's own run is in [review-2.md](review-2.md).

## Covered review

When review 1 runs inside the implementation step (e.g. `mattpocock/implement` calls `code-review`), tell that step to commit its work before the review starts and to pass the base commit as the review's fixed point, then to commit the review's fixes. The covered step ends with it: `scripts/state <target repo> step <implementation> done --outcome "..."` closes both. The review reads `git diff <base commit>...HEAD`, so a skill that says to review and then commit would otherwise review uncommitted work. (On a light path review 1 is never covered: [light.md](light.md).)

## Manual checklist

What the change really does, as points to check: built from `git diff <base commit>...HEAD` and the step notes, read against the issue (or spec), so it shows what was changed, not only what was asked; a requirement with no change behind it is a point too.

- One line each: where (page, URL, command) → action → expected result, naming the login or seed data it needs.
- At most 15 points, the riskiest first (user-facing behaviour, data, permissions, then the rest); what does not fit goes in one closing line, `Also changed: …`.
- Tag each point `[agent]` when a command, a test, an HTTP request or a scripted browser can show the result, `[you]` when it needs a person's eye or judgment (layout, responsive, themes, copy, real data).
- The checklist is a help, never a gate: the user may skip it.

## Your check

When the implementation step ends, show the files changed since the base commit and the manual checklist, then ask once whether the user wants to check the result before the reviews continue: `check | continue`. On `check`, run `scripts/state <target repo> step <n> waiting` for the first step after implementation that is not `done` or `skipped` (the workflow waits with it), then wait. Fix what the user reports, commit it, and start that step on `continue`. This is a pause, not a step: it is not in `steps`.

## Comparison, security and fixes

**Comparison** (when on): merge both reviews, plus framework-review's findings when it ran, into three lists: found by both, found by one only (say which), disagreements. Name each review by the model it ran on.

**Findings.** Give each finding a severity and keep which reviews reported it (their step ids). Severity: `critical` wrong results, data loss or a security hole; `high` a bug or risk a user will meet; `medium` a real but contained problem; `low` style, naming, small clean-ups. Then ask once which findings to fix; one the user fixes is `fixed`, one the user rejects `declined`, one kept for later `deferred`.

**Security question.** If security is not already in the workflow, inspect the diff for auth, user input, queries, secrets, new dependencies, config and permissions (the `use_when` of the `security` candidate). When any appear, or the task is security- or data-sensitive, suggest that skill in the same question as the findings, with the reason. The user decides.

**When the comparison is off**, ask that security question right after review 1, or after framework-review when it runs, together with which of its findings to fix.

**Fixes.** The chosen fixes run like a skill step, in a new subagent on the implementation step's model (without subagents, in the main session): it gets the findings, the handoff and the step notes, fixes them (test-first where a test can show the problem), commits, and writes its note to `.router/steps/<n>-fixes.md`, with `n` the asking step's position. The asking step stays `running` until the fixes are committed, so a pause or resume does not drop them.

## Verification (when on)

Start a fresh subagent (without subagents, the main session) that has not seen the implementation: it gets the target repo path, the handoff and the manual checklist, nothing else. It works through the `[agent]` points only, never edits tracked files, and for each reports `pass`, `fail` or `could not check`, with the evidence (the command and its output, the response, a screenshot path). Its note goes to `.router/steps/<n>-verification.md`. A `fail` is shown to the user with its evidence and handled like a finding the user chose to fix (or not), then the checklist is updated: an `[agent]` point that passed is ticked and marked `verified by agent`, the rest stay for the user.

## Pull request

The `pull-request` skill writes the body, and the body links the issue with `Closes #<issue>` (issue-free: [issue-free.md](issue-free.md)) and ends with the manual checklist, updated for the fixes since.

Then write the run record (what ran and what the reviews found, read back by `scripts/stats`) into the PR with `scripts/record <target repo> --pr <number> --findings <file> --checklist <points>,<agent>[,<passed>,<failed>] --session-model <id>`, adding `--tokens` / `--cost` only when the harness or tool reported them. It takes the steps, skills, models and efforts from the state; you give it what only you know: the findings file, a JSON array with every review finding as `{"title": one line, "severity", "found_by": [step ids], "decision"}` (with the comparison off, review 1's findings and the fixes chosen after it), and the checklist counts. It refuses invalid input with the reason; without `--pr` it prints the block instead.

Open the PR, show the checklist again, and stop. The user merges. `scripts/stats` adds the records of a repo's PRs up.
