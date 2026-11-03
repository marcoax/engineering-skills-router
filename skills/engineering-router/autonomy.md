# From workflow approval to the open PR

Read before presenting a workflow, when executing it, and on resume. This is the router's execution policy for its own steps, selected skills and their nested calls.

## Approval and completion

Show the proposed scope, steps and conditional checks before asking for `go`. Explain that `go` authorizes the selected workflow through the open PR: writing the spec, publishing its issue and planned tickets when included, creating the branch, implementation, tests, reviews, in-scope fixes, commits, push and PR creation. Keep optional steps off unless selected. Merge and deployment need their own explicit authorization.

After `go`, complete each step and start the next in the same run. Announce progress and decisions as updates, then continue working. Completing a step, producing a document, finding a fixable test failure or finishing a review is a transition, not a reason to end the turn or ask to continue. Completion means the PR is open with the final checklist and run record; report its URL, checks actually run and remaining manual acceptance.

Honor narrower user instructions, including an explicit checkpoint, a request to stop after a spec, and `pause` or `stop`. Set a step's `confirm` flag only for a checkpoint the user explicitly requested, and record that request in its reason or step note. The flag alone is not evidence of new permission being needed.

## Selected and nested skills

Pass this policy, the approved scope, settled decisions and explicit checkpoints to every step subagent and nested call. Follow the selected skill's procedure and produce its required artifacts; resolve its routine approval gates using the authorization and decisions already available.

- Present a spec, ticket breakdown, test seams or PR body when the skill requires it, and continue when it implements the approved objective and project conventions. Choose routine implementation and testing details from the code and existing public interfaces; record the choice. A repeated approval of these artifacts, or a skill's instruction to end the turn after producing one, is satisfied by the workflow authorization when no substantive decision remains.
- Answer questions from the task, spec, repository and earlier step notes first. A skill asking for information already in the handoff receives that information directly.
- A subagent that encounters a genuine exception returns the specific unresolved decision or blocker, evidence and its note so far. The main session checks whether existing context resolves it before asking the user; after an answer it resumes that step and the rest of the workflow.

This policy applies within the user's authorized scope. Tool permission checks and explicit project constraints still apply. Keep vendor files unchanged; adaptation belongs in the router's dispatch instructions.

## Exceptional stops

Pause for the user only when one of these applies:

- A material requirement or trade-off remains unresolved and cannot be answered from the available context. Routine technical choices stay with the agent.
- Completing the task requires a material scope change, a changed risk profile, an unselected costly activity, or a destructive action outside the existing authorization. Present the concrete change and its reason before acting.
- A prerequisite, credential, tool permission or required capability is unavailable, or diagnosis and attempted remedies leave a reproducible blocker. Report what failed and what is needed; a recoverable command or test failure is ordinary work.
- The user requested a checkpoint, pause or stop, or context exhaustion requires the handoff in [context.md](context.md).

For a question, mark the affected step `waiting`, name the specific exception and ask only for the missing decision or action. Resume automatically once it is resolved. For a context handoff or an explicit pause, follow [resume.md](resume.md). Preserve completed work and notes; never claim an unfinished check passed or the workflow completed at a blocker.
