# From implementation to pull request

Read from SKILL.md §6 when the implementation step is about to start. It holds everything from there to the open PR: the covered review, the manual checklist, the comparison, security and fixes, verification, and the pull request with its run record. Execution and exceptional stops follow [autonomy.md](autonomy.md). Review 2's own run is in [review-2.md](review-2.md).

## Covered review

When review 1 runs inside the implementation step (e.g. `mattpocock/implement` calls `code-review`), tell that step to commit its work before the review starts and to pass the base commit as the review's fixed point, then to commit the review's fixes. The covered step ends with it: `scripts/state <target repo> step <implementation> done --outcome "..."` closes both. The review reads `git diff <base commit>...HEAD`, so a skill that says to review and then commit would otherwise review uncommitted work. (On a light path review 1 is never covered: [light.md](light.md).)

## Manual checklist

What the change really does, as points to check: built from `git diff <base commit>...HEAD` and the step notes, read against the issue (or spec), so it shows what was changed, not only what was asked; a requirement with no change behind it is a point too.

- One line each: where (page, URL, command) → action → expected result, naming the login or seed data it needs.
- At most 15 points, the riskiest first (user-facing behaviour, data, permissions, then the rest); what does not fit goes in one closing line, `Also changed: …`.
- Tag each point `[agent]` when a command, a test, an HTTP request or a scripted browser can show the result, `[you]` when it needs a person's eye or judgment (layout, responsive, themes, copy, real data).
- The checklist is a help, never a gate: the user may skip it.

## Implementation outcome

When the implementation step ends, show a concise outcome with the files changed since the base commit and the manual checklist, then start the next review. Leave `[you]` points for the PR; they do not block its creation or count as passed. If the user explicitly requested a check here, wait on the next unfinished step, fix and commit what they report, then resume under [autonomy.md](autonomy.md). The check is a pause, not an extra step.

## Comparison, security and fixes

**Comparison** (when on): merge both reviews, plus framework-review's findings when it ran, into three lists: found by both, found by one only (say which), disagreements. Name each review by the model it ran on.

**Findings.** Give each finding a severity and keep which reviews reported it (their step ids). Severity: `critical` wrong results, data loss or a security hole; `high` a bug or risk a user will meet; `medium` a real but contained problem; `low` style, naming, small clean-ups. Validate findings against the code and approved spec. Fix confirmed problems within scope automatically; record false positives as `declined` with evidence, and unrelated improvements as `deferred` with the reason. A finding that requires a material decision or scope change follows [autonomy.md](autonomy.md); severity alone is no reason to ask which findings to fix. Keep every finding and its disposition for the run record.

**Conditional security check.** Inspect the diff for auth, user input, queries, secrets, new dependencies, config and permissions (the `use_when` of the `security` candidate). When any appear, or the task is security- or data-sensitive or the user explicitly requested security, announce why and run its preselected skill. Otherwise close that conditional step as `skipped` with the reason. A triggered check with no usable candidate is a missing-capability exception. Security is review-only; changes it proposes follow the findings policy.

**When the comparison is off**, evaluate security right after review 1, or after framework-review when it runs. Consolidate findings from the reviews that ran and the security check, then apply the fixes policy.

**Fixes.** In-scope fixes run like a skill step, in a new subagent on the implementation step's model (without subagents, in the main session): it gets the findings, approved scope, execution policy, handoff and step notes, fixes them (test-first where a test can show the problem), runs the affected checks, commits, and writes its note to `.router/steps/<n>-fixes.md`, with `n` the coordinating step's position. That step stays `running` until the fixes and checks finish, so a pause or resume does not drop them. Have a fresh reviewer check materially changed behavior when the fix invalidates earlier review evidence. Continue to the next step once the findings are resolved or explicitly accounted for; an unresolved correctness requirement is a blocker, not a deferred improvement.

## Verification (when on)

Start a fresh subagent (without subagents, the main session) that has not seen the implementation: it gets the target repo path, the handoff, the manual checklist and the execution policy. It works through the `[agent]` points only, never edits tracked files, and for each reports `pass`, `fail` or `could not check`, with the evidence (the command and its output, the response, a screenshot path). Its note goes to `.router/steps/<n>-verification.md`. Handle a `fail` like a finding: fix in scope, rerun the affected verification, and escalate only an exception. A required check that cannot run is a blocker; optional manual acceptance remains documented. Tick only `[agent]` points that passed and mark them `verified by agent`.

## Pull request

Run the project's required checks on the final changes, resolving recoverable failures before delivery. Commit the remaining authorized changes and push the work branch, preserving unrelated work. The `pull-request` skill writes the body, and the body links the issue with `Closes #<issue>` (issue-free: [issue-free.md](issue-free.md)) and ends with the manual checklist, updated for the fixes since. Open the PR under the existing workflow authorization; if the implementation already opened a draft PR, update that PR and mark it ready when the required work is complete. Record its number and URL with `scripts/state <target repo> handoff pr <number> <url>`.

Then write the run record (what ran and what the reviews found, read back by `scripts/stats`) into the PR with `scripts/record <target repo> --pr <number> --findings <file> --checklist <points>,<agent>[,<passed>,<failed>] --session-model <id>`, adding `--tokens` / `--cost` only when the harness or tool reported them. It takes the steps, skills, models and efforts from the state; you give it what only you know: the findings file, a JSON array with every review finding as `{"title": one line, "severity", "found_by": [step ids], "decision"}`, and the checklist counts. It refuses invalid input with the reason; without `--pr` it prints the block instead.

After the record is written, close the PR step with its outcome, report the URL, local check results, observed CI status and outstanding manual acceptance, and stop. Distinguish CI still running or unavailable from passed checks. The user merges. `scripts/stats` adds the records of a repo's PRs up.
