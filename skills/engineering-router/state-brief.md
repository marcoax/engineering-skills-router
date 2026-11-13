# Composing the state

Read from SKILL.md §5. `scripts/state` builds the workflow's steps itself: give it the two files already checked, never steps of your own ([ADR 0008](../../docs/adr/0008-compose-builds-the-steps.md)).

```sh
scripts/state <target repo> compose --new \
  --classification <file> --selection <file> --task "<one line>" \
  [--issue <number|url>] [--spec <path>] [--checkpoint <step>[,<step>]]
```

- `--classification`: the classification file §1 checked with `scripts/check-classification` ([classification.md](classification.md)). `compose` checks it again.
- `--selection`: the selector's JSON block, saved to a file, that `scripts/check-selection --target <target repo>` passed (§3). Add `--reselect` when the selection ran with it. `compose` checks it again.
- `--task`: the task in one line.
- `--issue`: the issue the task already is; it becomes `handoff.issue`. `--spec`: the spec file the task already is; it becomes `handoff.spec` and the workflow is issue-free ([issue-free.md](issue-free.md)).
- `--checkpoint`: the steps (id or phase) the user asked to confirm before they start ([autonomy.md](autonomy.md)); each is recorded as `confirm` on its step.

From those files `compose` writes `.router/state.json` with status `selecting`, so §2 and §4 hold without any step written by hand:

- The steps follow §2's default flow, with the changes by type and, on a light path, [light.md](light.md)'s steps. The router steps (`branch`, `verification`, opening the PR) are in place; a selected `pull-request` skill's step is the PR step, which writes the body before the router opens the PR. A multi-session workflow is its multi-session step alone (and `setup` when needed): the later sessions implement from its output, so a selection that also picks their phases is refused.
- A skill selected for two phases is one step, keeping each phase's selection: every phase's alternatives (one offered for both appears once), and the reasons, cost and tie as they are when the phases agree, otherwise each labelled with its phase. `issue-tracking` gets no step of its own: a skill selected for it alone is dropped, with a `dropped:` line; when nothing fills it and the task is not an issue, the workflow is issue-free.
- `setup` is prepended when a selected skill `requires: tracker-config` and the target has no `docs/agents/issue-tracker.md`.
- Optional steps (independent-review, verification) are present and off.
- Each step carries the selection's default, alternatives, reasons, prerequisites, cost and tie unchanged; a decided phase's reason is its origin. Coverage is calculated from the catalog's `invokes`; a covered step keeps the selector's pick aside.
- The selection's `omitted` and `missing` phases are kept, and shown as `Skipped:` and `Missing:`.

When a check fails, `compose` prints the checker's errors and writes nothing: correct the classification or the pick, check it again, and rerun. It then prints the workflow presentation of §5; `scripts/state <target repo> show` prints it again later.

**A recomposition** (SKILL.md §5 `edit` and `full`, §6) drops `--new` and passes the new selection: `compose --selection <file> [--classification <file>]`. It keeps the run's completed steps, `primary`, handoff, manual checklist and reviewed revisions, and its classification unless `--classification` revises it. A completed step's phase must be selected again. A file holding a complete state is refused.

The state's format, for reading it, is [state.md](state.md).
