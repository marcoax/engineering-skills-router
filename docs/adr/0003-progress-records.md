---
status: accepted
---

# Progress records let an interrupted step resume without repeating valid work

A step's result was saved only when the step ended: its note and `step <n> done`. A step whose agent stopped before handing back (timeout, quota, unavailable model) left its commits and partial changes in the checkout but nothing the router could read, so recovery meant reading transcripts and rerunning checks that may still have held.

A running step now keeps a **progress record** in its state (`steps[].progress`, state.md "Progress"), written as the work is made with `scripts/state … progress`, `check` and `interrupt`:

- `progress` records what is done and verified, the first work still needed, the known limits, and the checkout's branch, HEAD and uncommitted paths.
- `check` records each check with its command, environment, scope and result, and a SHA-256 of the scope's files as they were when it ran (uncommitted changes included).
- `interrupt` records why the step stopped and counts interruptions. The step and the workflow stay `running`: an interruption is neither a success nor a question for the user.

`scripts/state … recover` reads the records against the current checkout and changes nothing. It keeps finished steps, lists uncommitted work, says whether the recorded commit is still in the checkout's history, and reuses a passing check only while its scope hashes the same and its environment, given with `--env`, matches; without `--env` nothing is reused. A path named in a scope counts even when it is gitignored (a `.env`). Anything it cannot prove (no git, an interrupted or failed check, a commit missing from history) is a rerun. A missing or incomplete record is reported as such, never filled in.

Retries are bounded: after two interruptions the user decides whether to retry, change model or stop, and `progress` and `expect` on the step are refused until `--user-approved` records the yes (`progress.approved`). Adapters show an interrupted running step as a recoverable error, not as active work. `recover` prints the step model as recorded, and an interruption never changes it, so a quota stop never switches model or family silently ([ADR 0001](0001-single-cross-family-review.md)).

## Considered options

- **Hash the whole tree, or trust the HEAD commit**: rejected. A later commit outside a check's scope would invalidate it, and an uncommitted change inside it would not.
- **A new step status `interrupted`**: rejected. Adapters and `UNFINISHED` already know `running`; a record on the step distinguishes the interruption without changing the status set.
- **Records in the step notes**: rejected. Notes are prose written at the end; the record must be machine-checked and exist before the step ends.
