# Resume, discard, pause

Read from SKILL.md when the target repo holds an unfinished workflow (§1), or on `pause` / `resume` (§6).

## Unfinished workflow

`.router/state.json` in the target repo has status `running`, `waiting`, `paused` or `stopped`:

- task omitted, or the same issue as its `handoff.issue` (issue-free: the task names its `handoff.branch` or `handoff.spec`): offer to resume it;
- any other task: name the unfinished workflow (task, issue or spec file) and ask whether to resume it or discard it and start the new one.

With status `running` or `waiting`, the workflow may still be live in another session, in this harness or another: the state file records no owner. Say so in the offer: resume it only once that session is closed, or two agents will write the same branch and state.

**Resume**: if paused, run `scripts/state <target repo> reply resume` first. Read the state and the notes in `.router/steps/`, check out `handoff.branch` if set, and continue at SKILL.md §6 from the first step not `done` or `skipped`, with the same skills, the run's `primary` ([models.md](models.md)) and its classification, under the policy revision it records: do not run the selector again or reclassify. Only when the user asks to change the remaining work, or a step reveals a material change, recompose as SKILL.md §6 says; completed steps stay as they ran. Read [autonomy.md](autonomy.md) and the files SKILL.md's table names for what the workflow holds (light path, issue-free) before continuing. A state written before [ADR 0001](../../docs/adr/0001-single-cross-family-review.md) may hold `review-2` or `comparison` steps still open: close each with `scripts/state <target repo> step <id> skipped --outcome "removed from the process"`, and run the remaining reviews as cross-family reviews ([cross-family-review.md](cross-family-review.md)). Preserve the approved scope and explicit checkpoints. Resolve an old `waiting` step from its note and the user's answer; routine continuation gates are already covered by authorization, while an unresolved substantive question remains waiting. A `confirm` flag alone does not establish a user-requested checkpoint.

**Discard**: delete `.router/state.json` and `.router/steps/`, then classify the new task (§1).

## Pause

On `pause` (in chat, from an adapter, or at a context boundary), let a running step finish and save its note first. Read the state and print a short handoff summary: steps done, the first step not `done` or `skipped`, issue URL or spec path, branch and PR (say “none” for absent handoff values). Include the target repo directory and the exact invocation to run there in a fresh session: `/skill:engineering-router` in Pi, `/engineering-router` in Claude Code, or this harness's installed router invocation. Use the invocation this run used when the harness uses another name.

Then run `scripts/state <target repo> reply pause` and stop. The state and step notes are the record; the summary stays in chat. On `resume`, run `scripts/state <target repo> reply resume`, show the workflow with `scripts/state <target repo> show`, then continue as in **Resume** above.
