# `.router/state.json` — format v1

The router writes this file in the **target repo** during a workflow so that adapters (agent-specific UIs) can show progress. This document is the only definition of the format.

- **Writer**: only the router. It rewrites the whole file after every change of state (selection made, step started, step finished, pause, handoff produced).
- **Readers**: adapters. They never write the file. A user choice made in an adapter UI is sent to the agent as a chat message in the router's text syntax (`go`, `2b`, `5on`, `5off`, `edit`, `full`, `stop`, `pause`, `resume`, or `checklist <run> <id> on|off`; `full` only on a light path); the router applies it and rewrites the file. In a selection reply, `<step>` is the 1-based position in `steps` and the letter is the position in that step's `alternatives` (`a` = first).
- The router adds `.router/` to the target repo's `.git/info/exclude`, so the file is never committed.
- Readers ignore unknown fields. Adding a field keeps `version`; renaming, removing or changing the meaning of a field bumps it.
- A field added within a version is marked *(optional)* in its table; readers use its documented default when missing (`null` unless specified).

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
    "policy": 3,
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
      "summary": "Build the CSV export test-first, without the review implement runs inside",
      "alternatives": [],
      "confirm": false,
      "covered_by": null,
      "model": "claude-bridge/claude-opus-5-5",
      "effort": null,
      "status": "running",
      "outcome": null,
      "progress": {
        "at": "2026-10-17T09:40:00Z",
        "branch": "42-csv-export",
        "head": "9c1d4e2a7b3f8e0d6a5c2b1f4e7d9a3c8b0e6f2d",
        "changes": ["src/reports/export.js"],
        "done": "CSV writer and its tests committed",
        "next": "add the export button",
        "limits": null,
        "interrupted": null,
        "interruptions": 0,
        "checks": [
          {
            "command": "npm test -- reports",
            "scope": ["src/reports", "test/reports"],
            "environment": "node 22, darwin",
            "result": "pass",
            "head": "9c1d4e2a7b3f8e0d6a5c2b1f4e7d9a3c8b0e6f2d",
            "content": "5d41402abc4b2a76b9719d911017c592ae0f3c4b8e9a6d2f1c7b3e0a9d8c6f4e",
            "at": "2026-10-17T09:38:00Z"
          }
        ]
      }
    },
    {
      "id": "testing",
      "phases": ["testing"],
      "skill": "mattpocock/tdd",
      "reason": "runs inside implement",
      "summary": "Red-green-refactor for the export",
      "alternatives": [],
      "confirm": false,
      "covered_by": "implementation",
      "selected": {
        "skill": "addyosmani/test-driven-development",
        "reason": "test-first with a prove-it pattern for the export",
        "alternatives": [{ "skill": "mattpocock/tdd", "reason": "vertical red-green slices" }]
      },
      "model": null,
      "effort": null,
      "status": "pending",
      "outcome": null
    },
    {
      "id": "review",
      "phases": ["review"],
      "skill": "addyosmani/code-review-and-quality",
      "reason": "five review axes fit a user-facing export",
      "summary": "Cross-family review of the diff since the base commit",
      "alternatives": [{ "skill": "mattpocock/code-review", "reason": "standards and spec axes" }],
      "confirm": false,
      "covered_by": null,
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
  },
  "run": "20261017T093000Z-4f2a",
  "owner": { "session": "session-example", "since": "2026-10-17T09:30:00Z", "previous": null }
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
| `path` (optional) | `"light"` \| `"full"` | Light: a ticket of low risk (or medium risk and low complexity) run as branch → implementation → cross-family review → [security] → [framework-review] → pull request; full: every other workflow. |
| `properties` | string[] | Task properties from the classification; may be empty. |
| `classification` (optional) | Classification \| null | How `type`, `risk` and `complexity` were assigned, under which policy ([classification.md](classification.md)); `null` in a state written before it. |
| `primary` (optional) | `"claude"` \| `"openai"` | The run's primary model family ([models.md](models.md)). A state without it gets the preferences' `primary` on its next write by `scripts/state`. |
| `status` | string | Workflow status, see below. |
| `updated_at` | string | ISO-8601 UTC time of the last write. |
| `steps` | Step[] | All steps in execution order, including router steps and covered steps. |
| `handoff` | Handoff | What the steps have produced so far. |
| `run` (optional) | string | The run's id, set by `compose --new`: the first line of each of its step notes is `run: <run>`, and `.router/runs/<run>/` keeps the run once it is archived ([ADR 0002](../../docs/adr/0002-workflow-ownership.md)). Missing in a state written before it. |
| `owner` (optional) | Owner \| null | The session that may change the workflow; `null` or missing in a state written before it, which is claimed before any change. |
| `manual_checklist` (optional) | Manual point[] | Optional personal reminders, at most 15; missing means empty. Never verification evidence or a workflow gate. |

Workflow `status`:

| Value | Meaning |
|---|---|
| `selecting` | Workflow shown; waiting for the user to accept or swap skills. |
| `running` | Executing: a step is running, or one has ended and the next has not started yet. |
| `waiting` | Paused for an unresolved question, an exceptional blocker or an explicit user checkpoint ([autonomy.md](autonomy.md)). The step concerned is `waiting` too. |
| `done` | Stopped at the open pull request, or the last step finished. |
| `paused` | The user paused the workflow to resume it later (`resume`). |
| `stopped` | The user stopped the workflow. |

## Manual point

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Nonempty, unique within this checklist; generated by `scripts/state`. |
| `action` | string | Nonempty where/action to try, including any login or seed data needed. |
| `expected` | string | Nonempty expected result. |
| `checked` | boolean | Only the user's personal tick; false does not mean failure. |

The router saves JSON `[{"action":"…", "expected":"…"}]` with `scripts/state <target> checklist set <file>`. Identical action and expected strings keep their id and tick even when reordered; new or edited points get a fresh id and start unchecked. Duplicate content is refused. Recomposition keeps the checklist; `compose --new` starts without one, archiving the old run's checklist with its state.

Adapters send `checklist <run> <id> on|off` as chat intent, never as a state write. The owning router forwards it unchanged to `scripts/state <target> reply "checklist <run> <id> on|off"` (equivalent to `checklist check <run> <id> on|off`). Both commands use the existing owner guard, lock and validation; a stale run or removed/edited point is refused without changes. Readers show only persisted ticks, not pending intents. A missing run id leaves the checklist read-only until a normal new run is composed.

These ticks never change steps, findings, verification results, PR text or run-record counts. Empty, missing and unchecked lists never block any workflow status or PR creation.

## Owner

Set by `scripts/state`: `compose --new`, `claim` and `takeover`. Every other change is refused unless it comes from this session ([ADR 0002](../../docs/adr/0002-workflow-ownership.md)).

| Field | Type | Meaning |
|---|---|---|
| `session` | string | The owning session's id: `--session`, else `ROUTER_SESSION`, `CLAUDE_CODE_SESSION_ID` or `PI_SESSION_ID`. |
| `since` | string | ISO-8601 UTC time the session became owner. |
| `previous` | string \| null | The session that owned the workflow before an explicit `takeover`; `null` otherwise. |

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
| `id` | string | Unique, stable within the workflow. Usually the phase name; router steps use `branch`, `verification`, `pull-request`; the general review is `review`. States written before [ADR 0001](../../docs/adr/0001-single-cross-family-review.md) may hold `review-1`, `review-2` and `comparison`. |
| `phases` | string[] | Catalog categories this step fills; empty for router steps without a phase (`branch`, `verification`). |
| `skill` | string \| null | Chosen catalog id (`source/name`); `null` when the router does the step itself. |
| `reason` | string | One line: why this skill (or step) was chosen. A `cost: high` skill's reason starts "High cost", as an alternative too, so a swap carries it. |
| `summary` | string | One line: what the step does for this task. |
| `alternatives` | `{skill, reason}[]` | At most two other `ok` candidates, each with a one-line reason ("High cost" first for a `cost: high` one). After a swap, the previous skill takes the swapped alternative's place. |
| `prerequisites` (optional) | string[] | The selector's hard prerequisites for the step's skill (tools, files, harness capabilities), one line each; may be empty. |
| `cost` (optional) | string \| null | The selector's cost note for the step (arena's **High cost** included); `null` when it gave none. |
| `tie` (optional) | string \| null | The selector's tie: the skills it judged equivalent for the step and what separates them; `null` when there is none. |
| `confirm` | boolean | Whether the router pauses before this step. Defaults to `false`; use `true` for an explicit user checkpoint and record the request in its reason or step note ([autonomy.md](autonomy.md)). |
| `optional` (optional) | boolean | `true` when the user may switch the step on and off during selection (independent-review, verification). An optional step that is off is `skipped` with outcome `off (optional)`; switching it on sets `pending`. |
| `covered_by` | string \| null | `id` of the step whose skill runs this one internally (e.g. testing inside implementation). Never set for a review step: a review runs on its own. |
| `selected` (optional) | Selection \| null | The selector's own pick for a covered step, kept while `skill` holds the skill its covering step runs; restored when a swap leaves the step to run on its own. `null` for a step that is not covered. |
| `model` | string \| null | The **step model**: the model the step actually ran on, for every step that ran (`running`, `waiting`, `done`, `failed`, or `skipped` after running). Precedence: agent record, then the model passed to the step's subagent (or `review_other_family`'s backend), then the session's model; full rules in [models.md](models.md). Recorded as the source names it (`claude-bridge/claude-opus-5-5` and `claude-opus-5-5` may both appear), no spaces. `null` only for a step that did not run. |
| `effort` (optional) | `"low"` \| `"medium"` \| `"high"` \| null | The step's effort, from the agent record or the one passed to the step ([models.md](models.md)); `null` when neither names one (the harness default). Never taken from the session. |
| `progress` (optional) | Progress \| null | What a running step has saved so far, so an interruption loses nothing ([ADR 0003](../../docs/adr/0003-progress-records.md)); `null` until it saves any. Written with `scripts/state … progress`, `check` and `interrupt`; read back with `recover`. |
| `status` | string | Step status, see below. |
| `outcome` | string \| null | One-line result once the step ends. |
| `result` (optional) | Result \| null | The delivery a delegated step owes ([step-result.md](step-result.md)): set by `scripts/state … expect`, accepted by `… deliver`. A step that has one closes as `done` only on an accepted `done` verdict. `null` or absent for a step that declares none. |

Step `status`:

| Value | Meaning |
|---|---|
| `pending` | Not started. |
| `running` | In progress (for a covered step: its covering step is running it). |
| `waiting` | Paused for an unresolved question, an exceptional blocker or an explicit user checkpoint. A user-requested check after implementation waits on the next unfinished step; it adds no step. |
| `done` | Finished; `outcome` set. |
| `skipped` | Will not run (user declined, or no longer needed); `outcome` says why. |
| `failed` | Could not finish; `outcome` says why. |

## Progress

A step's latest progress, rewritten by `progress`; `branch`, `head` and `changes` are read from the checkout each time `progress`, `check` or `interrupt` writes.

| Field | Type | Meaning |
|---|---|---|
| `at` | string | ISO-8601 UTC time of the last write. |
| `branch` | string \| null | Checked-out branch; `null` when detached or outside a git repo. |
| `head` | string \| null | The commit checked out; `null` outside a git repo. |
| `changes` | string[] | Paths with uncommitted changes, tracked or untracked (`.router/` excluded). |
| `done` | string \| null | One line: what the step has completed and verified so far. |
| `next` | string \| null | One line: the first work still needed. `null` leaves the record incomplete. |
| `limits` | string \| null | Known limits and open points; `null` when none. |
| `interrupted` | Interruption \| null | The last interruption, until the step saves progress again. |
| `interruptions` | integer | How many times the step was interrupted; it is retried at most twice ([resume.md](resume.md)). |
| `approved` (optional) | integer \| null | The interruptions the user's yes to another retry covers (`progress --user-approved`); past the retries, `progress` and `expect` are refused until it reaches `interruptions`; `null` until the user approves one. |
| `checks` | Check[] | The checks the step ran, one per command: a rerun replaces the earlier one. |

## Interruption

| Field | Type | Meaning |
|---|---|---|
| `reason` | string | One line: `timeout`, `quota`, `model unavailable`, `cancelled`, or what else stopped the step. Neither a success nor a question for the user. |
| `at` | string | ISO-8601 UTC time. |

## Check

A check's result holds only for the content it ran on: `recover` reuses a passing check while the files in its scope hash to the same `content` and its environment matches.

| Field | Type | Meaning |
|---|---|---|
| `command` | string | The command run, as typed. |
| `scope` | string[] | Paths, relative to the target repo, whose content the result depends on; `["."]` for the whole repo. |
| `environment` | string | The relevant environment in one line (runtime and version, OS, services). |
| `result` | "pass" \| "fail" \| "interrupted" | `interrupted`: the check did not finish and proves nothing. |
| `head` | string \| null | The commit checked out when it ran. |
| `content` | string \| null | SHA-256 over the scope's files (each path and its content, uncommitted changes included); `null` when it could not be computed, which leaves the check unprovable. |
| `at` | string | ISO-8601 UTC time. |

## Selection

| Field | Type | Meaning |
|---|---|---|
| `skill` | string | The selector's default for the step. |
| `reason` | string | Its one-line reason. |
| `alternatives` | `{skill, reason}[]` | The selector's alternatives for the step. |

## Result

| Field | Type | Meaning |
|---|---|---|
| `attempt` | string | The current execution's token; a result naming another one is stale. |
| `requires` | string[] | The artifacts this step must deliver: `note`, `findings`, `pr-body`. |
| `verdict` | null \| "done" \| "fixes" \| "blocked" | The accepted verdict; `null` while the delivery is expected. |
| `artifacts` | {kind, path}[] | The accepted artifacts, each path relative to the target repo; empty while expected. |
| `remaining` | string \| null | What blocks the step or is left, from a `blocked` (or any) delivery. |
| `purpose` (optional) | string \| null | What this attempt is for: the step's summary on its first pass; another pass of a review after an accepted verdict declares its own, distinct one (a review counts once per purpose). |
| `earlier` (optional) | Attempt[] | The step's earlier attempts, oldest first; a review's findings carry decisions only after one of them delivered `fixes`. |

## Attempt

| Field | Type | Meaning |
|---|---|---|
| `attempt` | string | The earlier attempt's token. |
| `purpose` | string \| null | Its purpose. |
| `verdict` | null \| "done" \| "fixes" \| "blocked" | Its accepted verdict; `null` when it delivered nothing. |

## Handoff

| Field | Type | Meaning |
|---|---|---|
| `issue` | `{number, url}` \| null | Spec issue, published or given as the task; `null` in an issue-free workflow. |
| `spec` (optional) | string \| null | Spec file, relative to the target repo; set when the workflow has no issue. |
| `tickets` | `{number, url}[]` | Tickets published from the spec. |
| `branch` | string \| null | Work branch, `<issue-number>-<slug>`, or `<slug>` without an issue. |
| `base_commit` | string \| null | `git rev-parse HEAD` just before implementation; the fixed point for every review. |
| `pr` | `{number, url}` \| null | Opened pull request. |
