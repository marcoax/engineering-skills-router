# Writing the state the first time

Read from SKILL.md §5. Write `.router/state.json` like this example, then run `scripts/check-state <target repo>`: its errors name the field to fix. The full format, for anything this does not settle, is [state.md](state.md).

```json
{
  "version": 1,
  "task": "Add CSV export to the reports page",
  "type": "feature", "risk": "medium", "complexity": "medium", "path": "full",
  "properties": ["brownfield", "user-facing"],
  "status": "selecting",
  "updated_at": "2026-10-17T09:42:00Z",
  "steps": [
    { "id": "specification", "phases": ["specification", "issue-tracking"], "skill": "mattpocock/to-spec",
      "reason": "decisions already settled in the conversation", "summary": "Write the export spec and publish it as an issue",
      "alternatives": [{ "skill": "addyosmani/spec-driven-development", "reason": "spec as a repo document instead" }],
      "confirm": true, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "branch", "phases": [], "skill": null, "reason": "work branch named after the issue", "summary": "Create <issue>-csv-export",
      "alternatives": [], "confirm": false, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "implementation", "phases": ["implementation"], "skill": "mattpocock/implement", "reason": "one spec, built here", "summary": "Build the export test-first",
      "alternatives": [], "confirm": true, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "review-1", "phases": ["review"], "skill": "mattpocock/code-review", "reason": "runs inside implement", "summary": "Review since the base commit",
      "alternatives": [], "confirm": false, "optional": false, "covered_by": "implementation", "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "review-2", "phases": ["review"], "skill": "addyosmani/code-review", "reason": "other axes, other family", "summary": "Second review on the other family",
      "alternatives": [], "confirm": false, "optional": true, "covered_by": null, "model": "openai-codex/gpt-6-sol", "effort": null, "status": "skipped", "outcome": "off (optional)" }
  ],
  "handoff": { "issue": null, "spec": null, "tickets": [], "branch": null, "base_commit": null, "pr": null }
}
```

- **Every step** of §5's list, in order, router and covered steps included; `id` unique (the phase name, or `branch`, `review-1`, `review-2`, `comparison`, `verification`, `pull-request`).
- **skill** `source/name` from the catalog, or `null` for a router step (then no alternatives). At most two **alternatives**, none equal to the skill.
- **confirm** `true` where §6 asks before the step (publishing, starting implementation, opening the PR).
- **optional** `true` for review 2, comparison, independent-review, verification; while off: `status` `skipped`, `outcome` `off (optional)`.
- **covered_by**: the id of the step whose skill runs this one (review 1 inside implementation); never on a light path.
- **model** `provider/model-id` when the step will run on a model other than the session's, else `null`; **effort** `low`/`medium`/`high` when one will be passed, else `null`.
- **handoff.issue** is `{number, url}` when the task is an issue; everything else starts empty and is set later with `scripts/state … handoff`.
