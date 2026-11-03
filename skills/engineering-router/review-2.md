# Review 2

Read from SKILL.md when the workflow has a review 2 step: before showing it (§5), and again when review 2 runs (§6).

Review 2 takes the first fitting `ok` `review` candidate other than review 1's skill (§3) and runs on the model family opposite to review 1's ([models.md](models.md)). A different model and different axes are not a duplicate. It is optional and starts off, and switches on and off together with the comparison.

## Before showing the workflow

Review 1's family is the one it will actually run on ([models.md](models.md)): in Claude Code that is `claude` even when `primary` is `openai`, so review 2's other family is `openai`. Judge whether this harness can run review 2 on the family opposite to review 1's: it needs subagents that take an explicit model, and a provider configured for that family under the ID in `config/preferences.yaml`. Availability depends on the harness and its configuration, not on the router: Pi with a subagent extension and both providers set up can do it; a harness whose subagents run only its own vendor's models cannot. Decide one of:

- **available**: the harness can start a subagent on that model.
- **unverified**: it seems able to, but you cannot confirm the provider ID before a subagent starts. Say so; a failed start is handled below.
- **Claude Code with the panel mod** (`adapters/claude-code`): when the tool `mcp__engineering-router-panel__review_other_family` is listed, review 2 on a non-Claude family runs through it, not through a subagent. Call it with `model` set to `models.openai` and no `prompt`: an `available:` answer makes review 2 **available** and names the backend, model and effort that will run (the person may override them with `/router-models`); an error makes it **unavailable**, with that error as the reason.
- **unavailable**: say why (no subagents, no model choice, provider not configured), and ask: skip review 2, or run it on the current model. Review 2 starts off, so ask when the user switches it on. Skipped, it goes under `Skipped:` with the comparison, and the rest runs as when they are off. On the current model, it stays a step whose step model, once it runs, is `session_model` ([models.md](models.md)).

Show it as `Review 2: <available | unverified | unavailable>: <one-line reason or limitation>` in the workflow (§5).

**Naming.** A review 2 on the current model is named by that model. When the session's model is in review 1's family, it is a second review on the same family, not an independent one: never call it a review by the other family, in the workflow or in its summary, outcome, step note and the comparison.

## Running it

Start a subagent on the family opposite to review 1's that runs the review 2 skill on `git diff <base commit>...HEAD` against the issue (issue-free: against the spec file).

Where review 2 runs through `review_other_family`, call that tool instead, with `model`, `effort` (when set in the preferences), `cwd` the target repo, and a `prompt` that holds what a subagent would get: the review 2 skill's `SKILL.md` path (absolute) to read and follow, the base commit and the command `git diff <base commit>...HEAD`, the issue or spec, and the instruction to only report findings, never edit. Its answer opens with the backend, model and effort that ran: record those in the step's `model` and use its text as review 2's findings.

If that subagent fails to start (e.g. an `unverified` provider ID was wrong), say why and ask, as before showing the workflow: skip it, or run it on the current model. Update the step's `model`, summary and `Review 2:` status to match.
