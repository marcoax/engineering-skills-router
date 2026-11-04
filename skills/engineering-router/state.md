# `.router/state.json` — format v1

The router writes this file in the **target repo** during a workflow so that adapters (agent-specific UIs) can show progress. This document is the only definition of the format.

- **Writer**: only the router. It rewrites the whole file after every change of state (selection made, step started, step finished, pause, handoff produced).
- **Readers**: adapters. They never write the file. A user choice made in an adapter UI is sent to the agent as a chat message in the text syntax of the router's selection (`go`, `2b`, `5on`, `5off`, `edit`, `full`, `stop`, `pause`, `resume`; `full` only on a light path); the router applies it and rewrites the file. In a selection reply, `<step>` is the 1-based position in `steps` and the letter is the position in that step's `alternatives` (`a` = first).
- The router adds `.router/` to the target repo's `.git/info/exclude`, so the file is never committed.
- Readers ignore unknown fields. Adding a field keeps `version`; renaming, removing or changing the meaning of a field bumps it.
- A field added within a version is marked *(optional)* in its table: the router always writes it, and readers treat a missing one as `null`.

## Example

```json
{
  "version": 1,
  "task": "Add CSV export to the reports page",
  "type": "feature",
  "risk": "medium",
  "complexity": "medium",
  "path": "full",
  "properties": ["brownfield", "user-facing"],
  "classification": {
    "policy": 1,
    "ticket": false,
    "facts": [],
    "rationale": {
      "type": "a new capability on an existing page",
      "risk": "no fact applies; a wrong export is visible to users but contained and reversible",
      "complexity": "a query, a CSV writer and a button across three files"
    },
    "uncertain": []
  },
  "primary": "claude",
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
      "prerequisites": ["gh logged in, to publish the issue"],
      "cost": null,
      "tie": "to-spec and spec-driven-development fit equally; publishing an issue separates them",
      "confirm": false,
      "covered_by": null,
      "model": "claude-opus-5-5",
      "effort": null,
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
      "model": "claude-opus-5-5",
      "effort": null,
      "status": "done",
      "outcome": "On 42-csv-export"
    },
    {
      "id": "implementation",
      "phases": ["implementation"],
      "skill": "mattpocock/implement",
      "reason": "one spec, implemented in this session",
      "summary": "Build the CSV export test-first, then run review 1",
      "alternatives": [],
      "confirm": false,
      "covered_by": null,
      "model": "claude-bridge/claude-opus-5-5",
      "effort": null,
      "status": "running",
      "outcome": null
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
      "selected": {
        "skill": "addyosmani/code-review-and-quality",
        "reason": "five review axes fit a user-facing export",
        "alternatives": [{ "skill": "mattpocock/code-review", "reason": "standards and spec axes" }]
      },
      "model": null,
      "effort": null,
      "status": "pending",
      "outcome": null
    }
  ],
  "handoff": {
    "issue": { "number": 42, "url": "https://github.com/acme/app/issues/42" },
    "spec": null,
    "tickets": [],
    "branch": "42-csv-export",
    "base_commit": "3f2a9c1e7b4d8f0a6c5e2b9d1f3a7c4e8b0d2f6a",
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
| `risk` | `"low"` \| `"medium"` \| `"high"` | A low-risk task gets a workflow only when the user asks for one anyway (it then runs as at medium risk). |
| `complexity` (optional) | `"low"` \| `"medium"` \| `"high"` | Task size from the classification, matched against each skill's catalog `complexity`. |
| `path` (optional) | `"light"` \| `"full"` | Light: a ticket of low risk (or medium risk and low complexity) run as branch → implementation → independent review 1 → [security] → [framework-review] → pull request; full: every other workflow. |
| `properties` | string[] | Task properties from the classification; may be empty. |
| `classification` (optional) | Classification \| null | How `type`, `risk` and `complexity` were assigned, under which policy ([classification.md](classification.md)); `null` in a state written before it. |
| `primary` (optional) | `"claude"` \| `"openai"` | The run's primary model family ([models.md](models.md)). A state without it gets the preferences' `primary` on its next write by `scripts/state`. |
| `status` | string | Workflow status, see below. |
| `updated_at` | string | ISO-8601 UTC time of the last write. |
| `steps` | Step[] | All steps in execution order, including router steps and covered steps. |
| `handoff` | Handoff | What the steps have produced so far. |

Workflow `status`:

| Value | Meaning |
|---|---|
| `selecting` | Workflow shown; waiting for the user to accept or swap skills. |
| `running` | Executing: a step is running, or one has ended and the next has not started yet. |
| `waiting` | Paused for an unresolved question, an exceptional blocker or an explicit user checkpoint ([autonomy.md](autonomy.md)). The step concerned is `waiting` too. |
| `done` | Stopped at the open pull request, or the last step finished. |
| `paused` | The user paused the workflow to resume it later (`resume`). |
| `stopped` | The user stopped the workflow. |

## Classification

Checked by `scripts/check-classification` and by `scripts/state … compose`. A recomposition keeps the run's classification, policy revision included, unless the composed file revises it; a revision is checked against the current policy.

| Field | Type | Meaning |
|---|---|---|
| `policy` | integer | The classification policy revision the run was classified under. |
| `ticket` | boolean | The task is an issue or spec that already settles what to build. |
| `facts` | Fact[] | The policy facts that hold, each with its evidence; empty when none does. |
| `rationale` | {type, risk, complexity} | One line each: why that class, citing what was read. |
| `uncertain` | string[] | What the evidence left unsettled, one line each; may be empty. |

## Fact

| Field | Type | Meaning |
|---|---|---|
| `fact` | string | A fact named in the policy's Fact table (`authorization`, `payment`, …). |
| `where` | string | `task`, or the path of the inspected file that shows it. |
| `evidence` | string | One line: what was seen. |

## Step

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Unique, stable within the workflow. Usually the phase name; router steps use `branch`, `review-1`, `review-2`, `comparison`, `verification`, `pull-request`. |
| `phases` | string[] | Catalog categories this step fills; empty for router steps without a phase (`branch`, `comparison`). |
| `skill` | string \| null | Chosen catalog id (`source/name`); `null` when the router does the step itself. |
| `reason` | string | One line: why this skill (or step) was chosen. A `cost: high` skill's reason starts "High cost", as an alternative too, so a swap carries it. |
| `summary` | string | One line: what the step does for this task. |
| `alternatives` | `{skill, reason}[]` | At most two other `ok` candidates, each with a one-line reason ("High cost" first for a `cost: high` one). After a swap, the previous skill takes the swapped alternative's place. |
| `prerequisites` (optional) | string[] | The selector's hard prerequisites for the step's skill (tools, files, harness capabilities), one line each; may be empty. |
| `cost` (optional) | string \| null | The selector's cost note for the step (arena's **High cost** included); `null` when it gave none. |
| `tie` (optional) | string \| null | The selector's tie: the skills it judged equivalent for the step and what separates them; `null` when there is none. |
| `confirm` | boolean | Whether the router pauses before this step. Defaults to `false`; use `true` for an explicit user checkpoint and record the request in its reason or step note ([autonomy.md](autonomy.md)). |
| `optional` (optional) | boolean | `true` when the user may switch the step on and off during selection (review 2, comparison, independent-review, verification). An optional step that is off is `skipped` with outcome `off (optional)`; switching it on sets `pending`. |
| `covered_by` | string \| null | `id` of the step whose skill runs this one internally (e.g. review 1 inside implementation). |
| `selected` (optional) | Selection \| null | The selector's own pick for a covered step, kept while `skill` holds the skill its covering step runs; restored when a swap leaves the step to run on its own. `null` for a step that is not covered. |
| `model` | string \| null | The **step model**: the model the step actually ran on, for every step that ran (`running`, `waiting`, `done`, `failed`, or `skipped` after running). Precedence: agent record, then the model passed to the step's subagent (or `review_other_family`'s backend), then the session's model; full rules in [models.md](models.md). Recorded as the source names it (`claude-bridge/claude-opus-5-5` and `claude-opus-5-5` may both appear), no spaces. `null` only for a step that did not run. |
| `effort` (optional) | `"low"` \| `"medium"` \| `"high"` \| null | The step's effort, from the agent record or the one passed to the step ([models.md](models.md)); `null` when neither names one (the harness default). Never taken from the session. |
| `status` | string | Step status, see below. |
| `outcome` | string \| null | One-line result once the step ends. |

Step `status`:

| Value | Meaning |
|---|---|
| `pending` | Not started. |
| `running` | In progress (for a covered step: its covering step is running it). |
| `waiting` | Paused for an unresolved question, an exceptional blocker or an explicit user checkpoint. A user-requested check after implementation waits on the next unfinished step; it adds no step. |
| `done` | Finished; `outcome` set. |
| `skipped` | Will not run (user declined, or no longer needed); `outcome` says why. |
| `failed` | Could not finish; `outcome` says why. |

## Selection

| Field | Type | Meaning |
|---|---|---|
| `skill` | string | The selector's default for the step. |
| `reason` | string | Its one-line reason. |
| `alternatives` | `{skill, reason}[]` | The selector's alternatives for the step. |

## Handoff

| Field | Type | Meaning |
|---|---|---|
| `issue` | `{number, url}` \| null | Spec issue, published or given as the task; `null` in an issue-free workflow. |
| `spec` (optional) | string \| null | Spec file, relative to the target repo; set when the workflow has no issue. |
| `tickets` | `{number, url}[]` | Tickets published from the spec. |
| `branch` | string \| null | Work branch, `<issue-number>-<slug>`, or `<slug>` without an issue. |
| `base_commit` | string \| null | `git rev-parse HEAD` just before implementation; the fixed point for both reviews. |
| `pr` | `{number, url}` \| null | Opened pull request. |
