# Light path

Read from SKILL.md when §1 sets `path` to `light`, or offers it.

A light workflow is one implementer, then one independent look at its work:

```text
branch → implementation → review → [security] → [framework-review] → pull request → stop
```

- **Fits** when `scripts/check-classification` offers it: a ticket (an issue or spec that already settles what to build) at risk `low`, or `medium` with complexity `low`, as [classification.md](classification.md) defines. A fact that sets risk `high` (authorization, payment, destructive) rules it out.
- **Not in it**: requirements, specification, issue, planning, independent-review, verification.
- **The review is independent**, as on the full path: a cross-family review in a fresh subagent that has not seen the implementation, on `git diff <base commit>...HEAD` against the ticket ([cross-family-review.md](cross-family-review.md)).
- **security** is conditional after the review: select its candidate with the workflow, then run or skip it as [after-implementation.md](after-implementation.md) describes (auth, user input, queries, secrets, new dependencies, config, permissions).
- **framework-review** (the project's own best practices) joins as in SKILL.md §2, when the target repo has a fitting skill in `docs/agents/skills.yaml`.
- Consolidate their findings after the last of them and fix in-scope problems as in [after-implementation.md](after-implementation.md). Approval and exceptional stops follow [autonomy.md](autonomy.md), as on the full path.
- The PR closes the ticket and carries the manual checklist and the run record. Given a spec file instead of an issue, the spec file is `handoff.spec`, the branch and the PR follow [issue-free.md](issue-free.md), and the review reads the spec file as the ticket.

§3–§5 run as usual on those steps, so the user still sees the workflow and can swap skills. `full` in the selection reply switches to the full path: `scripts/state … reply full` exits 2; set `path` to `full` in the classification file, run the selector again, then recompose with `scripts/state … compose --classification <file> --selection <file>` (SKILL.md §5).
