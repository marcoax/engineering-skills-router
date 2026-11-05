# Cross-family review

Read from SKILL.md before showing the workflow (§5), and again when a review step runs (§6).

Every step that reviews code (`review`, `framework-review`, `security`, `independent-review`, and the fresh re-check after fixes) is a **cross-family review**. It runs on the family opposite to the one the last code-writing step (implementation, or its fixes) actually ran on. That holds whatever `primary` or a review phase's `model` in `preferences.yaml` says: `scripts/state <target repo> model <n|id>` prints that model. Why: [ADR 0001](../../docs/adr/0001-single-cross-family-review.md).

The implementation's family is the one it actually runs on ([models.md](models.md)). In Claude Code that is `claude` even when `primary` is `openai`, so the reviews go to `openai`. On Pi with `primary openai`, the implementation runs on gpt, so the reviews go to `claude`. When a preference would put a review on the writer's family, say so once in the workflow: `review: preferences.yaml sets review on <family>, the writer's family: runs on <other>`.

## Before showing the workflow

Judge whether this harness can run a step on the reviewers' family. It needs one of two things: subagents that take an explicit model, with a provider configured for that family under the ID in the user's `preferences.yaml`; or the panel tool below. Availability depends on the harness and its configuration, not on the router. Pi with a subagent extension and both providers set up can do it. A harness whose subagents run only its own vendor's models cannot. Decide one of:

- **available**: the harness can start a subagent on that model.
- **unverified**: it seems able to, but you cannot confirm the provider ID before a subagent starts. Say so; a failed start is handled below.
- **Claude Code with the panel mod** (`adapters/claude-code`): when the tool `mcp__engineering-router-panel__review_other_family` is listed, a review on a non-Claude family runs through it, not through a subagent. Call it with `model` set to `models.openai` and no `prompt`. An `available:` answer makes the reviews **available** and names the backend, model and effort that will run (the person may override them with `/router-models`). An error makes them **unavailable**, with that error as the reason.
- **unavailable**: say why (no subagents, no model choice, provider not configured, quota reached). Then ask once: run the reviews as same-family reviews, or stop the run. The reviews are required, so skipping them is not an option.

Show it as `Reviews: <available | unverified | unavailable>: <one-line reason or limitation>` in the workflow (§5).

## Running a review

Start a subagent on the reviewers' family that runs the step's skill on `git diff <base commit>...HEAD` against the issue (issue-free: against the spec file). Tell it to only report findings, never edit.

Where the review runs through `review_other_family`, call that tool instead. Pass `model`, `effort` (when set in the preferences), `cwd` the target repo, and a `prompt` that holds what a subagent would get:

- the step skill's `SKILL.md` path (absolute), to read and follow;
- the base commit and the command `git diff <base commit>...HEAD`;
- the issue or spec;
- the instruction to only report findings, never edit;
- the lines `scripts/state <target repo> expect <n> --requires findings` printed, and the instruction to end the answer with its step result as a json block, findings inline ([step-result.md](step-result.md)).

Its answer opens with the backend, model and effort that ran: record those in the step's `model`. Save the answer unchanged to a file and pass it to `scripts/state <target repo> deliver <n> <file>`; the delivered findings, not the prose, are the step's findings.

When the tool or subagent fails (an error, a wrong `unverified` provider ID, a quota), say why and ask once for the rest of the run: retry, run the remaining reviews as same-family reviews, or stop. Never fall back without asking.

## Same-family review

A review that runs on the writer's family, because the user chose it when the other family was unreachable, is a **same-family review**. It runs in a fresh subagent, never in the session that wrote the code. Name it so wherever it appears: the workflow (`Reviews: unavailable: <reason>; same-family reviews`), the step's outcome and note, the summary, and the PR. Never call it cross-family or independent. `scripts/record` marks it `cross_family: false` from the step models ([run-record.md](run-record.md)), so record the model it actually ran on.
