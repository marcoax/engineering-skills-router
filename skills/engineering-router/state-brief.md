# Composing the state

Read from SKILL.md §5. Write the composed workflow like this example to a file outside the target repo, then run `scripts/state <target repo> compose --new <file>` (a recomposition: `compose <file>`): its errors name the step or field to fix, and it writes `.router/state.json`. The full format, for anything this does not settle, is [state.md](state.md).

```json
{
  "version": 1,
  "task": "Add CSV export to the reports page",
  "type": "feature", "risk": "medium", "complexity": "medium", "path": "full",
  "properties": ["brownfield", "user-facing"],
  "classification": { "policy": 1, "ticket": false, "facts": [],
    "rationale": { "type": "new capability on an existing page", "risk": "no fact applies; contained and reversible", "complexity": "three files" },
    "uncertain": [] },
  "primary": "claude",
  "status": "selecting",
  "updated_at": "2026-10-17T09:42:00Z",
  "steps": [
    { "id": "specification", "phases": ["specification", "issue-tracking"], "skill": "mattpocock/to-spec",
      "reason": "decisions already settled in the conversation", "summary": "Write the export spec and publish it as an issue",
      "alternatives": [{ "skill": "addyosmani/spec-driven-development", "reason": "spec as a repo document instead" }],
      "confirm": false, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "branch", "phases": [], "skill": null, "reason": "work branch named after the issue", "summary": "Create <issue>-csv-export",
      "alternatives": [], "confirm": false, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "implementation", "phases": ["implementation"], "skill": "mattpocock/implement", "reason": "one spec, built here", "summary": "Build the export test-first",
      "alternatives": [], "confirm": false, "optional": false, "covered_by": null, "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "review-1", "phases": ["review"], "skill": "mattpocock/code-review", "reason": "runs inside implement", "summary": "Review since the base commit",
      "alternatives": [], "confirm": false, "optional": false, "covered_by": "implementation", "model": null, "effort": null, "status": "pending", "outcome": null },
    { "id": "review-2", "phases": ["review"], "skill": "addyosmani/code-review-and-quality", "reason": "other axes, other family", "summary": "Second review on the other family",
      "alternatives": [], "confirm": false, "optional": true, "covered_by": null, "model": "openai-codex/gpt-6-sol", "effort": null, "status": "skipped", "outcome": "off (optional)" }
  ],
  "handoff": { "issue": null, "spec": null, "tickets": [], "branch": null, "base_commit": null, "pr": null }
}
```

- **type**, **risk**, **complexity**, **path**, **properties** and **classification** as §1 checked them with `scripts/check-classification` ([classification.md](classification.md)). `compose --new` checks them again; a recomposition keeps the run's own unless the file revises them.
- **Every step** of §5's list, in order, router and covered steps included; `id` unique (the phase name, or `branch`, `review-1`, `review-2`, `comparison`, `verification`, `pull-request`).
- **skill** the selector's default (`source/name`), or `null` for a router step (then no alternatives). At most two **alternatives**, the selector's, none equal to the skill. `compose` refuses any that is not a usable candidate for the step's `phases`.
- **confirm** `false` by default; `true` for a user-requested checkpoint, recorded as in [autonomy.md](autonomy.md).
- **optional** `true` for review 2, comparison, independent-review, verification; while off: `status` `skipped`, `outcome` `off (optional)`.
- **covered_by**: the id of the step whose skill runs this one (review 1 inside implementation); never review 1 on a light path. `compose` recalculates it from the catalog's `invokes`.
- **primary**: the answer to the primary question; leave it out to take `primary` from the user's `preferences.yaml` (default `claude`). A recomposition keeps the run's own ([models.md](models.md)).
- **model** and **effort** `null`: no step has run yet. From §6 on, `scripts/state` sets each step's step model ([models.md](models.md)), recorded as its source names it, when it starts and when it closes; `model` stays `null` only for a step that did not run.
- **handoff.issue** is `{number, url}` when the task is an issue; everything else starts empty and is set later with `scripts/state … handoff`.
