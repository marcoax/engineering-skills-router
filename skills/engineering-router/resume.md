# Resume, discard, pause

Read from SKILL.md when the target repo holds an unfinished workflow (§1), or on `pause` / `resume` (§6).

## Unfinished workflow

`.router/state.json` in the target repo has status `running`, `waiting`, `paused` or `stopped`:

- task omitted, or the same issue as its `handoff.issue` (issue-free: the task names its `handoff.branch` or `handoff.spec`): offer to resume it;
- any other task: name the unfinished workflow (task, issue or spec file) and ask whether to resume it or discard it and start the new one.

**Resume**: read the state and the notes in `.router/steps/`, check out `handoff.branch` if set, and continue at SKILL.md §6 from the first step not `done` or `skipped`, with the same skills. Read the files SKILL.md's table names for what the workflow holds (light path, issue-free, review 2) before continuing.

**Discard**: delete `.router/state.json` and `.router/steps/`, then classify the new task (§1).

## Pause

On `pause` (in chat or from an adapter), let a running step finish first, then run `scripts/state <target repo> reply pause`, say that `resume` continues, and stop. On `resume`, run `scripts/state <target repo> reply resume`, show the workflow with `scripts/state <target repo> show`, then continue as in **Resume** above.
