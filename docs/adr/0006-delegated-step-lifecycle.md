---
status: accepted
---

# Start opens a delegated step; its accepted delivery closes it

Delegated work required separate model lookup, start, expectation, recovery, delivery, close and handoff commands, with the result's outcome copied by hand. `start <n>` now resolves and records dispatch model/effort, starts the note, opens an attempt and prints the brief and reusable checks; an accepted `done` delivery closes the step through the same covered-step and workflow transitions as other closes, taking its outcome from the result's `summary` and applying its optional `handoff` values. This supersedes ADR 0004's separate expectation and `step <n> done` lifecycle, not its verdict, artifact, findings, identity or review-purpose contracts.

- **One path:** remove `expect` and `model`; delegated work uses `start`/`deliver`, including main-session PR preparation because its artifacts remain mandatory. Other main-session, conversational and router steps keep `step`; router-produced handoff values keep `handoff`.
- **Dispatch settings:** `start` prints the settings the executor must honor. Preflight or an approved same-family fallback may supply `--model`/`--effort`; a restart otherwise keeps the recorded settings. Delivery never changes attribution.
- **Refusal:** validate the result, handoff values and complete candidate state before writing state or inline artifacts. A refused delivery leaves the attempt open. `fixes` keeps it running; `blocked` leaves it waiting. Only an accepted `done` delivery is a context boundary.
- **No migration:** state format v1 stays readable and valid, including archived runs and remembered selections; a result's handoff is optional and its values use the existing workflow handoff fields. Finish an open run with its original checkout or discard it before upgrading, rather than keeping compatibility commands or rewriting history.

Keeping a separate close would preserve the manual outcome copy and allow delivery and handoff to diverge; accepting them together makes the step result authoritative. The trade-off is that callers must adopt the new lifecycle rather than mix old and new commands.
