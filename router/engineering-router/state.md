# `.router/state.json` — format v1

The router writes this file in the **target repo** during a workflow so that adapters (agent-specific UIs) can show progress. This document is the only definition of the format.

- **Writer**: only the router. It rewrites the whole file after every change of state (selection made, step started, step finished, pause, handoff produced).
- **Readers**: adapters. They never write the file. A user choice made in an adapter UI is sent to the agent as a chat message in the text syntax of the router's selection (`go`, `2b`, `edit`, `stop`, `pause`, `resume`); the router applies it and rewrites the file. In a selection reply, `<step>` is the 1-based position in `steps` and the letter is the position in that step's `alternatives` (`a` = first).
- The router adds `.router/` to the target repo's `.git/info/exclude`, so the file is never committed.
- Readers ignore unknown fields. Adding a field keeps `version`; renaming, removing or changing the meaning of a field bumps it.

## Example

```json
{
  "version": 1,
  "task": "Add CSV export to the reports page",
  "type": "feature",
  "risk": "medium",
  "properties": ["brownfield", "user-facing"],
  "status": "running",
  "updated_at": "2026-10-17T09:42:00Z",
  "steps": [
    {
      "id": "specification",
      "phases": ["specification", "issue-tracking"],
      "skill": "mattpocock/to-spec",
      "reason": "decisions already settled in the conversation",
      "summary": "Write the export spec and publish it as a GitHub issue",
      "alternatives": [
        { "skill": "addyosmani/spec-driven-development", "reason": "spec as a repo document instead of an issue" }
      ],
      "confirm": true,
      "covered_by": null,
      "model": null,
      "status": "done",
      "outcome": "Published #42"
    },
    {
      "id": "branch",
      "phases": [],
      "skill": null,
      "reason": "work branch named after the issue",
      "summary": "Create 42-csv-export",
      "alternatives": [],
      "confirm": false,
      "covered_by": null,
      "model": null,
      "status": "done",
      "outcome": "On 42-csv-export"
    },
    {
      "id": "review-1",
      "phases": ["review"],
      "skill": "mattpocock/code-review",
      "reason": "runs inside implement",
      "summary": "Standards and spec review since the base commit",
      "alternatives": [],
      "confirm": false,
      "covered_by": "implementation",
      "model": null,
      "status": "pending",
      "outcome": null
    }
  ],
  "handoff": {
    "issue": { "number": 42, "url": "https://github.com/acme/app/issues/42" },
    "tickets": [],
    "branch": "42-csv-export",
    "base_commit": null,
    "pr": null
  }
}
```

## Top level

| Field | Type | Meaning |
|---|---|---|
| `version` | integer | Format version, `1`. |
| `task` | string | The task in one line. |
| `type` | string | Task type from the classification (`feature`, `bug`, …). |
| `risk` | `"medium"` \| `"high"` | Low-risk tasks never get a workflow, so never a state file. |
| `properties` | string[] | Task properties from the classification; may be empty. |
| `status` | string | Workflow status, see below. |
| `updated_at` | string | ISO-8601 UTC time of the last write. |
| `steps` | Step[] | All steps in execution order, including router steps and covered steps. |
| `handoff` | Handoff | What the steps have produced so far. |

Workflow `status`:

| Value | Meaning |
|---|---|
| `selecting` | Workflow shown; waiting for the user to accept or swap skills. |
| `running` | A step is running. |
| `waiting` | Paused for the user (a confirmation point or a question). |
| `done` | Stopped at the open pull request, or the last step finished. |
| `paused` | The user paused the workflow to resume it later (`resume`). |
| `stopped` | The user stopped the workflow. |

## Step

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique, stable within the workflow. Usually the phase name; router steps use `branch`, `review-1`, `review-2`, `comparison`, `pull-request`. |
| `phases` | string[] | Catalog categories this step fills; empty for router steps without a phase (`branch`, `comparison`). |
| `skill` | string \| null | Chosen catalog id (`source/name`); `null` when the router does the step itself. |
| `reason` | string | One line: why this skill (or step) was chosen. |
| `summary` | string | One line: what the step does for this task. |
| `alternatives` | `{skill, reason}[]` | At most two other `ok` candidates, each with a one-line reason. After a swap, the previous skill takes the swapped alternative's place. |
| `confirm` | boolean | `true` when the router pauses for the user before this step (outward-facing action or start of implementation). |
| `covered_by` | string \| null | `id` of the step whose skill runs this one internally (e.g. review 1 inside implementation). |
| `model` | string \| null | `provider/model-id` when the step runs on a model other than the session's (review 2). |
| `status` | string | Step status, see below. |
| `outcome` | string \| null | One-line result once the step ends. |

Step `status`:

| Value | Meaning |
|---|---|
| `pending` | Not started. |
| `running` | In progress (for a covered step: its covering step is running it). |
| `waiting` | Paused for the user: its confirmation point, or a question raised while it runs. |
| `done` | Finished; `outcome` set. |
| `skipped` | Will not run (user declined, or no longer needed); `outcome` says why. |
| `failed` | Could not finish; `outcome` says why. |

## Handoff

| Field | Type | Meaning |
|---|---|---|
| `issue` | `{number, url}` \| null | Spec issue, published or given as the task. |
| `tickets` | `{number, url}[]` | Tickets published from the spec. |
| `branch` | string \| null | Work branch, `<issue-number>-<slug>`. |
| `base_commit` | string \| null | `git rev-parse HEAD` just before implementation; the fixed point for both reviews. |
| `pr` | `{number, url}` \| null | Opened pull request. |
