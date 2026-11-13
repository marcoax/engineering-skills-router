# Step result

Read from SKILL.md §6 before a skill step starts in a subagent. A delegated step ends with a **step result**: a JSON object that names the step and its attempt, gives a verdict and lists the artifacts the step declared. The workflow moves past the step only when `scripts/state` has accepted that result. A phrase in the subagent's answer ("done", `ROUTER_STEP_READY`) is never a result. Why: [ADR 0006](../../docs/adr/0006-delegated-step-lifecycle.md), superseding the lifecycle in [ADR 0004](../../docs/adr/0004-step-result-contract.md).

Router steps, conversational phases and steps run inside another declare no delivery and close as before. Other skill steps of a run require an accepted `done` delivery. A skill run in the main session without subagents uses `step <n> running --main-session` and closes with `step <n> done --outcome "..." --main-session`; PR preparation, including the simple main-session route, always uses `start` and delivers `pr-body` and `findings`. A state written before runs (no `run`) closes as before.

## Start, brief, deliver

1. `scripts/state <target repo> start <n> [--env "<this environment>"]`. It sets a pending delegated step `running`, resolves and records its model and effort, opens an **attempt**, starts its note with `run: <run>` and prints the brief: model, effort, result path, attempt token, required artifacts and paths, purpose, note run line and reusable checks. Dispatch on the printed model and effort ([models.md](models.md)). Put those lines in the step's brief. `--requires <kinds>` declares other artifacts for this step (e.g. `--requires findings` for a review whose executor writes no note).
2. The subagent writes the artifacts and the result at the printed paths, in `.router/steps/`, which every step subagent may write; it never edits tracked files for this. Its final report follows the harness contract and names the result path. State the workflow outcome once, as the result's `summary`, and put produced handoff values in its optional `handoff` object. A read-only executor (`review_other_family`, a subagent without write access) ends its answer with the result as a ```` ```json ```` block, with the findings array inline as `artifacts.findings`: declare it with `--requires findings`, save the answer unchanged to a file and run `deliver <n> <file>`. `deliver` takes the answer's last json block and writes the inline findings to the findings path; nothing is paraphrased or extracted by hand.
3. `scripts/state <target repo> deliver <n>` checks the result and every artifact. On refusal it names each problem and each artifact that is already valid (`kept:`), writes nothing, and leaves the attempt open: complete what is missing (the same subagent, or a new one with the same attempt) and deliver again. On acceptance it prints the verdict line; a `done` verdict closes the step, carries covered steps and updates the workflow's status. Claude Code and Pi append the same `context:` or `config:` lines as other step closes; read [context.md](context.md) before the next step when either appears.
4. Then, by verdict:
   - `done`: the step is already `done`, its outcome taken from `summary`, and its `handoff` values recorded. Continue to the next step; there is no second close command.
   - `fixes`: run the fixes ([after-implementation.md](after-implementation.md)), then `start <n> --purpose "record the decisions after the fixes"`: a new attempt, so a stale result from the first one is refused. The step stays `running` until a `done` delivery.
   - `blocked`: the step and workflow are `waiting`; handle `remaining` as an exception under [autonomy.md](autonomy.md). Valid artifacts already delivered stay where they are.

A new `start` on a running step (a retry after a failed subagent) opens a new attempt, with the same purpose and recorded model/effort; the earlier attempts stay listed in the result (`earlier`). A review pass counts once per purpose: the first pass's purpose is the step's summary, and another pass on a review step after an accepted verdict needs `--purpose "<what it checks that the earlier passes did not>"`, distinct from every earlier one. Past the retries of an interrupted step, `start` needs `--user-approved` ([resume.md](resume.md)).

## Result

```json
{
  "step": "review",
  "attempt": "3f9a1c2e",
  "verdict": "fixes",
  "summary": "1 high finding: the export ignores the date filter",
  "artifacts": { "note": ".router/steps/5-review.md", "findings": ".router/steps/5-review.findings.json" },
  "remaining": null
}
```

- **step**, **attempt**: exactly as `start` printed them; another step's or attempt's result is refused.
- **verdict**: `done` (the step's work is complete), `fixes` (findings to fix first), `blocked` (cannot continue: `remaining` says why and what is left). Anything else, or none, is no verdict.
- **summary**: one line, the step's outcome.
- **artifacts**: kind → path relative to the target repo, inside it. Every declared kind is required for `done` and `fixes`; a `blocked` result lists what it has.
- **remaining**: required for `blocked`; otherwise `null` or what is left open.
- **handoff** (optional): values recorded only on an accepted `done` delivery. Keys match `handoff` command fields: `issue`, `ticket`, `pr` are `{ "number": 95, "url": "https://..." }`; `spec`, `branch`, `base` are nonempty strings. `spec` is relative to the target repo; `base: "HEAD"` resolves its current commit. `ticket` adds or replaces that ticket by number. An unknown field or invalid value refuses the whole delivery, writing neither state nor inline artifacts. `fixes` and `blocked` keep the workflow's handoff unchanged.

## Artifacts

| Kind | Default for | Format |
|---|---|---|
| `note` | every delegated step | The step note (SKILL.md §6, point 5), Markdown, first line `run: <run>`, not empty below it; a note of another run is refused. |
| `findings` | review steps (`review`, `framework-review`, `security`, `independent-review`), `pull-request` | JSON array of `{title, severity, found_by, decision}` as `scripts/record` reads it; `decision` stays absent while a finding is still to fix. A review never decides its own findings: before its `fixes` verdict was accepted, a review's findings carrying a `decision` are refused. No findings is `[]`, never a missing file. |
| `pr-body` | `pull-request` | The PR body in Markdown, with `Closes #<issue>` when the workflow has an issue. |

A finding without a `decision` is **actionable**: a `done` verdict with one is refused, and a `fixes` verdict needs at least one. A review with findings to fix therefore never leads straight to the pull request.

## Pull request preparation

The pull-request step's preparation, in the main session or a subagent, delivers `pr-body` and consolidated `findings` (each with its decision) as two files. Its result uses the complete Result shape above (`step`, `attempt`, `verdict`, `summary`, `artifacts`, `remaining`). Publication reads the accepted body as it is: `gh pr create --body-file "$(scripts/state <target repo> artifact pull-request pr-body)"` (or `gh pr edit` for a draft), and `scripts/record` takes the accepted findings when `--findings` is not given.
