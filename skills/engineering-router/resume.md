# Resume, discard, pause

Read from SKILL.md when the target repo holds an unfinished workflow (§1), or on `pause` / `resume` (§6).

## Unfinished workflow

`.router/state.json` in the target repo has status `running`, `waiting`, `paused` or `stopped`:

- task omitted, or the same issue as its `handoff.issue` (issue-free: the task names its `handoff.branch` or `handoff.spec`): offer to resume it;
- any other task: name the unfinished workflow (task, issue or spec file) and ask whether to resume it or discard it and start the new one.

Run `scripts/state <target repo> owner` before the offer ([ADR 0002](../../docs/adr/0002-workflow-ownership.md)): only the session it names may change the workflow, and `scripts/state` refuses every change from another one.

- **this session**: offer to resume.
- **another session**: the workflow may still be live there, in this harness or another. Say so, with the owner and since when, and offer the handover: only once the user confirms that session is closed (or abandoned), run `scripts/state <target repo> takeover`. From then on that session's writes are refused; never take over silently, and never retry a refused write under another session id.
- **none recorded** (a state written before ownership): the same question as another session, then `scripts/state <target repo> claim`.

**Resume**: once this session owns the workflow, run `scripts/state <target repo> reconcile` and tell the user what it prints that disagrees with the state: the branch not checked out, commits since the base while the implementation is still open, a PR already merged or closed, notes of another run or without a run line. A merged PR is evidence to reconcile, not proof that the open steps ran or that their checks passed: confirm each open step from this run's note, the commits and the PR, then close it with an outcome naming that evidence, or run it. A note of another run (`run <id>: not evidence for this run`) is never read as this run's result; a note without a run line is unverified until its content matches the branch. Never rerun a step this run already closed, and never discard work in the working tree or on the branch. If paused, run `scripts/state <target repo> reply resume` first. Read the state and this run's notes in `.router/steps/`, check out `handoff.branch` if set, and continue at SKILL.md §6 from the first step not `done` or `skipped`, with the same skills, the run's `primary` ([models.md](models.md)) and its classification, under the policy revision it records: do not run the selector again or reclassify. Only when the user asks to change the remaining work, or a step reveals a material change, recompose as SKILL.md §6 says; completed steps stay as they ran. Read [autonomy.md](autonomy.md) and the files SKILL.md's table names for what the workflow holds (light path, issue-free) before continuing. A state written before [ADR 0001](../../docs/adr/0001-single-cross-family-review.md) may hold `review-2` or `comparison` steps still open: close each with `scripts/state <target repo> step <id> skipped --outcome "removed from the process"`, and run the remaining reviews as cross-family reviews ([cross-family-review.md](cross-family-review.md)). Preserve the approved scope and explicit checkpoints. Resolve an old `waiting` step from its note and the user's answer; routine continuation gates are already covered by authorization, while an unresolved substantive question remains waiting. A `confirm` flag alone does not establish a user-requested checkpoint.

**Discard**: run `scripts/state <target repo> discard` (as owner: claim or take over first): it moves `.router/state.json` and `.router/steps/` together to `.router/runs/<run>/`, deleting nothing, and leaves the branch and working tree as they are. Then classify the new task (§1). `compose --new` archives a finished run the same way.

## Interrupted step

A step whose agent stopped before handing back (timeout, quota or usage limit, unavailable model, a cancelled session) is interrupted: neither done nor waiting for a decision. Record it with `scripts/state <target repo> interrupt <n> --reason "<why>"`; the step and the workflow stay `running` ([ADR 0003](../../docs/adr/0003-progress-records.md)). Time spent waiting on the provider is not router overhead.

On resuming such a step, or any `running` step, run `scripts/state <target repo> recover [--env "<environment>"]` and follow it; it changes nothing:

- Steps `done`, `skipped` or `failed` are kept: never rerun a finished implementation or review.
- Leave commits, the `uncommitted:` paths and the step notes as they are: they are the step's work. Check what `no longer uncommitted` lists before continuing.
- `checkout:` must show the recorded commit or a descendant. A recorded commit not in this checkout's history, or a branch other than `handoff.branch`, is a stop: ask the user, and trust nothing recorded.
- `reuse:` lines are checks whose files and environment are unchanged: do not run them again. Run every `rerun:` line, and every check the step requires that has no line. An interrupted check proves nothing and is never reported as passed. No required check is dropped.
- No progress record, or one without `next`: rebuild the step's state from git and its note, say so, and report nothing as done or checked that git does not show.
- Continue the step from its `next` with a fresh agent on the step model `recover` prints. A quota or unavailable model never switches model or family silently: retry the same one at most twice (`retry 2 of 2`); when retries are used up, or the model stays unavailable, ask the user to retry, change model or stop, as [cross-family-review.md](cross-family-review.md) does for a review.

## Pause

On `pause` (in chat, from an adapter, or at a context boundary), let a running step finish and save its note first. Read the state and print a short handoff summary: steps done, the first step not `done` or `skipped`, issue URL or spec path, branch and PR (say “none” for absent handoff values). Include the target repo directory and the exact invocation to run there in a fresh session: `/skill:engineering-router` in Pi, `/engineering-router` in Claude Code, or this harness's installed router invocation. Use the invocation this run used when the harness uses another name.

Then run `scripts/state <target repo> reply pause` and stop. The state and step notes are the record; the summary stays in chat. On `resume`, run `scripts/state <target repo> reply resume`, show the workflow with `scripts/state <target repo> show`, then continue as in **Resume** above.
