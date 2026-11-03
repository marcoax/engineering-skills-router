# Resume, discard, pause

Read from SKILL.md when the target repo holds an unfinished workflow (§1), or on `pause` / `resume` (§6).

## Unfinished workflow

`.router/state.json` in the target repo has status `running`, `waiting`, `paused` or `stopped`:

- task omitted, or the same issue as its `handoff.issue` (issue-free: the task names its `handoff.branch` or `handoff.spec`): offer to resume it;
- any other task: name the unfinished workflow (task, issue or spec file) and ask whether to resume it or discard it and start the new one.

**Resume**: if paused, run `scripts/state <target repo> reply resume` first. Read the state and the notes in `.router/steps/`, check out `handoff.branch` if set, and continue at SKILL.md §6 from the first step not `done` or `skipped`, with the same skills and the run's `primary` ([models.md](models.md)). Read [autonomy.md](autonomy.md) and the files SKILL.md's table names for what the workflow holds (light path, issue-free, review 2) before continuing. Preserve the approved scope and explicit checkpoints. Resolve an old `waiting` step from its note and the user's answer; routine continuation gates are already covered by authorization, while an unresolved substantive question remains waiting. A `confirm` flag alone does not establish a user-requested checkpoint.

**Discard**: delete `.router/state.json` and `.router/steps/`, then classify the new task (§1).

## Pause

On `pause` (in chat, from an adapter, or at a context boundary), let a running step finish and save its note first. Read the state and print a short handoff summary: steps done, the first step not `done` or `skipped`, issue URL or spec path, branch and PR (say “none” for absent handoff values). Include the target repo directory and the exact invocation to run there in a fresh session: `/skill:engineering-router` in Pi, `/engineering-router` in Claude Code, or this harness's installed router invocation. Use the invocation this run used when the harness uses another name.

Then run `scripts/state <target repo> reply pause` and stop. The state and step notes are the record; the summary stays in chat. On `resume`, run `scripts/state <target repo> reply resume`, show the workflow with `scripts/state <target repo> show`, then continue as in **Resume** above.
