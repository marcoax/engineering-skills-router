---
status: accepted
---

# A workflow has one owning session, and each run keeps its state and notes together

Before this, `.router/state.json` recorded no owner. Any session could write it, and the step notes in `.router/steps/` were keyed only by step position and id. #80 made adapters show a workflow found at session start as `elsewhere`, but that was display only. In eraCms on 2026-11-04, #897 and #898 stayed incomplete in the router after their PRs were merged, and the recovery of #897 read notes left by #801.

We record an **owner** (`owner.session`) and a **run id** (`run`) in the state, and `scripts/state` enforces them. Both harnesses share that command:

- The session is `--session <id>`, else `ROUTER_SESSION`, `CLAUDE_CODE_SESSION_ID` or `PI_SESSION_ID`. Both harnesses set their id in the agent's shell, and subagents inherit it. The Pi `router_primary` tool passes its session id explicitly.
- `compose --new` makes the composing session the owner of a new run. Every other write (`step`, `workflow`, `handoff`, `reply`, `primary`, a recomposition, `discard`) is refused unless it comes from the owner. A state with no owner refuses every write until `claim`.
- `claim` takes an unowned workflow, or keeps one already owned by this session. It is refused when another session owns the workflow. `takeover --previous-closed` is the only explicit handover, run once the user confirms the owning session is closed: it records the previous owner, and from then on that session's writes are refused, so it cannot keep writing without noticing. It is refused without the flag, for a workflow with no owner (`claim` it), and for the session that already owns it.
- Every writing command holds `.router/state.lock` (created exclusively) from reading the state to writing it, so two concurrent claims leave one owner. A lock older than 30 s counts as a crashed command's: it is broken only by the one command that creates `.router/state.lock.break`, which checks the lock is still stale first, and a command removes the lock on exit only while it still holds its own token, so two commands that find the same stale lock never both write. The locking, archiving, note and reconcile code lives in `scripts/lib/run-files.js`.
- `step <n> running` writes the note headed `run: <run>` when it is missing; the step keeps that line first and appends below it (SKILL.md §6). If a note from another run sits at that path, it moves to `.router/runs/<its run>/steps/`. `discard` and a new run move the state and `.router/steps/` together to `.router/runs/<run>/`. Nothing is deleted.
- `reconcile` prints the state next to the branch, the commits since the base, the PR's state from `gh`, and which run each note belongs to. A merged PR is reported as evidence to reconcile, never as proof that the open steps ran.

Adapters do not show a workflow as `elsewhere` when its owner is the session they run in. They still never write the state.

## Considered options

- **An owner token printed by `claim`**, which the agent passes back on every write: rejected. The agent would have to carry it through compaction and subagents. The harness session id already identifies the session and reaches every shell the agent runs.
- **Storing only a hash of the session id**: rejected. The guard prevents accidental concurrent writes, not malicious ones, and adapters need to compare owners.
- **Moving notes into a per-run directory** (`.router/runs/<run>/steps/` while the run is live): rejected for now. Every reader of `.router/steps/` (prose, other tickets) would have to change. The run line together with archiving gives the same isolation.
- **Allowing writes to a state with no owner**: rejected. Two sessions could keep writing such a state. Claiming it is one explicit command.
