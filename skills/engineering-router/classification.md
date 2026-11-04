# Classification — policy 1

Read from SKILL.md §1. These are the criteria the router classifies a task by, and the constraints `scripts/check-classification` enforces on the result. The policy revision is the number in the title: change it when a criterion, a fact or a minimum changes meaning, never for wording.

## Criteria

Three independent judgments, each with a one-line reason that cites what was read (the task, the spec, an inspected file):

- **type**: what kind of work it is: `bug`, `feature`, `refactor`, `architecture`, `performance`, `security`, `documentation`, `investigation`, `prototype`, `review`, `maintenance`. It names the work, not its danger.
- **risk**: what a mistake would cost once merged. `low`: a mistake is harmless or obvious and cheap to undo (wording, docs, an isolated dev script); `medium`: a mistake reaches users or other code but stays contained and reversible; `high`: a mistake can lose data or money, open access, or break something others depend on, or is hard to undo.
- **complexity**: how much work it is: files and components touched, unknowns, sessions needed. `low`: one bounded change; `medium`: several coordinated changes; `high`: a design is needed first or the route is foggy.

Record the **properties** that apply, without a reason of their own: greenfield, brownfield, production-critical, user-facing, security-sensitive, data-sensitive, multi-session.

Complexity never stands in for risk: a one-line permission check is simple and high risk; a large docs restructure is complex and low risk. How many reviews or steps a workflow would get is an outcome of the classification, never evidence for it.

## Facts

A **fact** is a property of the change itself that sets a minimum risk. Record one only with evidence of where it holds: `where` is `task` (the task or spec states it) or the path of the inspected file that shows it, and `evidence` says what was seen in one line. A word in the task or in unrelated documentation is not evidence: documenting a login page does not change authorization, and "drop shadow" is not a destructive operation.

| Fact | Minimum risk | Holds when the change |
|---|---|---|
| `authorization` | high | alters who can sign in, or what an identity may see or do: login, sessions, tokens, roles, permission checks |
| `payment` | high | alters how money is charged, refunded, priced, paid out or recorded |
| `destructive` | high | deletes or irreversibly overwrites data, history or infrastructure, or runs something that does: dropping migrations, bulk deletes, force pushes, teardown |
| `sensitive-data` | medium | reads, stores, logs or exposes personal data, credentials or secrets in a new way |
| `public-contract` | medium | changes an interface others depend on: a public API, schema, CLI, file format or configuration key |

Risk is at least the highest minimum among the facts; judgment may raise it further, never lower it.

## Offers

What §1 may offer, from the checked classification: the first row that matches applies. `ticket` means the task is an issue or spec that already settles what to build.

| Risk | Complexity | Ticket | Offer |
|---|---|---|---|
| low | any | yes | direct, light or full |
| low | any | no | direct or full |
| medium | low | yes | light (proposed) or full |
| any other | | | full |

Full is always available: the user may ask for it at any risk. A user's explicit request outside the offer is not silently followed: report the constraint and its evidence, and let the user correct the facts or choose an offered path.

## Uncertainty

When the evidence does not settle a fact or a class (the task is vague, the code was not found, two readings are plausible), list it under `uncertain` and say it with the offer, in one line each.

## Classification file

Write the classification to a file outside the target repo and run `scripts/check-classification <file>` before offering anything. The same fields go into `.router/state.json` ([state.md](state.md)): `type`, `risk`, `complexity`, `path` at the top level, the rest under `classification`.

```json
{
  "type": "bug",
  "risk": "high",
  "complexity": "low",
  "classification": {
    "policy": 1,
    "ticket": true,
    "facts": [
      { "fact": "authorization", "where": "src/auth/guard.ts", "evidence": "the fix changes which roles pass canEditInvoice" }
    ],
    "rationale": {
      "type": "the issue reports wrong behavior in an existing check",
      "risk": "authorization: a wrong guard lets users edit invoices they should not",
      "complexity": "one guard and its test"
    },
    "uncertain": []
  },
  "requested": null
}
```

`requested` is the workflow the user asked for (`direct`, `light`, `full`), or `null`; `path` is set once chosen. The check prints the minimum risk with the facts behind it and the offer, or the errors to correct.
