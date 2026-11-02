# Light path

Read from SKILL.md when §1 sets `path` to `light`, or offers it.

A light workflow is one implementer, then one independent look at its work:

```text
branch → ⏸ implementation → review 1 → [security] → [framework-review] → pull request ⏸ → stop
```

- **Fits** a task given as an issue or spec that already settles what to build (the ticket is the spec) when risk is `low`, or `medium` with complexity `low`.
- **Not in it**: requirements, specification, issue, planning, review 2, comparison, verification.
- **Review 1 is independent**: it never runs inside the implementation step (no covered review, even when the implementation skill offers one); it runs in a fresh subagent that has not seen the implementation, on `git diff <base commit>...HEAD` against the ticket.
- **security** joins when the diff touches what [after-implementation.md](after-implementation.md) lists for the security question (auth, user input, queries, secrets, new dependencies, config, permissions): add it after review 1 without asking, say why, and the user may skip it.
- **framework-review** (the project's own best practices) joins as in SKILL.md §2, when the target repo has a fitting skill in `docs/agents/skills.yaml`.
- Their findings are asked about once, after the last of them, as with the comparison off; the fixes run as in [after-implementation.md](after-implementation.md).
- The PR closes the ticket and carries the manual checklist and the run record.

§3–§5 run as usual on those steps, so the user still sees the workflow and can swap skills. `full` in the selection reply switches to the full path: `scripts/state … reply full` exits 2; set `path` to `full`, recompose §2–§4 and write the state again (SKILL.md §5).
