# Run record — format v1

At the pull request (§6) the router appends one **run record** to the PR body: what ran, on which models, what the reviews found and what was done with it. `scripts/stats` reads the records back from a repo's PRs with `gh` and adds them up, so the catalog, the rankings and this skill can be judged on results rather than impressions. This document is the only definition of the format.

- **Writer**: only the router, once, when it opens the PR. A record already in the body (a resumed workflow) is replaced, never duplicated.
- **Where**: the end of the PR body, inside an HTML comment, so GitHub does not show it:

  ````text
  <!-- engineering-router:run
  { ...the JSON below... }
  -->
  ````

  The JSON never holds `-->`; write it as `-->` inside strings.
- **Readers**: `scripts/stats`. Readers skip a record they cannot parse or whose `version` they do not know, and ignore unknown fields. Adding a field keeps `version`; renaming, removing or changing the meaning of a field bumps it.
- **Truth over completeness**: a value the router does not know is `null`, never a guess. Token counts in particular are `null` unless the harness or tool reported them.

## Example

```json
{
  "version": 1,
  "router": { "commit": "fc8f369" },
  "task": "Add CSV export to the reports page",
  "type": "feature",
  "risk": "medium",
  "complexity": "medium",
  "path": "full",
  "steps": [
    { "id": "specification", "skill": "mattpocock/to-spec", "model": "claude-opus-5-5", "effort": null, "status": "done", "tokens": null },
    { "id": "implementation", "skill": "mattpocock/implement", "model": "claude-sonnet-5-5", "effort": "high", "status": "done", "tokens": 182000 },
    { "id": "review-1", "skill": "mattpocock/code-review", "model": "claude-opus-5-5", "effort": null, "status": "done", "tokens": null },
    { "id": "review-2", "skill": "addyosmani/code-review", "model": "openai-codex/gpt-6-sol", "effort": "high", "status": "done", "tokens": null },
    { "id": "comparison", "skill": null, "model": "claude-opus-5-5", "effort": null, "status": "done", "tokens": null }
  ],
  "session_model": "claude-opus-5-5",
  "findings": [
    { "title": "CSV cells starting with = are not escaped", "severity": "high", "found_by": ["review-1", "review-2"], "decision": "fixed" },
    { "title": "Export loads every row into memory", "severity": "medium", "found_by": ["review-2"], "decision": "fixed" },
    { "title": "Rename exportRows to buildCsvRows", "severity": "low", "found_by": ["review-1"], "decision": "declined" }
  ],
  "checklist": { "points": 9, "agent": 5, "passed": 4, "failed": 1 },
  "usage": { "tokens": null, "cost_usd": null }
}
```

## Top level

| Field | Type | Meaning |
|---|---|---|
| `version` | integer | Format version, `1`. |
| `router` | `{commit}` | `commit`: short `git rev-parse HEAD` of the router checkout that ran, or `null`. Ties results to a version of this skill and the catalog. |
| `task`, `type`, `risk`, `complexity`, `path` | string \| null | As in `.router/state.json`. `path` tells whether a light run's review found what a light path should not have missed. |
| `steps` | Step[] | Every step of the workflow, in order, as it ended. |
| `session_model` | string \| null | The main session's model, as the harness names it. In a record from before the step model contract, a step that ran with `model` `null` ran on this; `scripts/stats` reads it so. |
| `findings` | Finding[] | Every finding of the reviews that ran (review 1, review 2, framework-review, security, independent-review), merged: one entry per distinct problem. Empty when no review ran. |
| `checklist` | `{points, agent, passed, failed}` \| null | The manual checklist in the PR: how many points, how many tagged `[agent]`, and, when verification ran, how many of those passed and failed (`null` each when it did not run). `null` when the PR has no checklist. |
| `usage` | `{tokens, cost_usd}` | Whole-workflow totals when the harness reports them, else `null`. |

## Step

| Field | Type | Meaning |
|---|---|---|
| `id` | string | As in the state file. |
| `skill` | string \| null | Catalog id that ran, after any swap; `null` for a router step. |
| `model` | string \| null | The step model: what the step actually ran on, for every step that ran, Precedence: agent record, then the model passed to its subagent (or `review_other_family`'s backend, e.g. `openai-codex/gpt-6-sol`), then `session_model`; full rules in [models.md](models.md). As the source names it: IDs are not normalized, so `claude-bridge/claude-opus-5-5` and `claude-opus-5-5` count as different models. `null` only for a step that did not run. |
| `effort` | string \| null | `low`, `medium` or `high` from the agent record or the one passed to the step; `null` for the default. |
| `status` | string | The step's final status: `done`, `skipped`, `failed`. |
| `tokens` | integer \| null | Tokens the step used, when reported. |

## Finding

| Field | Type | Meaning |
|---|---|---|
| `title` | string | One line naming the problem. |
| `severity` | `"critical"` \| `"high"` \| `"medium"` \| `"low"` | As judged in the comparison (or by the one review that found it). `critical`: wrong results, data loss or a security hole; `high`: a bug or risk a user will meet; `medium`: a real but contained problem; `low`: style, naming, small clean-ups. |
| `found_by` | string[] | Step ids that reported it, at least one. A finding two reviews describe differently is still one entry. |
| `decision` | `"fixed"` \| `"declined"` \| `"deferred"` | What the user chose: fixed in this PR, rejected, or left for later (an issue, a TODO). |
