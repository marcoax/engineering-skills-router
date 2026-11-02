# Context at a step boundary

Read when a completed `scripts/state … step <n> done` command prints a line like:

```text
context: 162000 of 200000 window, threshold 150000
```

The adapter emits this only at or above the checkout's `context_threshold`. Read the exact counts; the 80% rule below changes the recommendation, not the trigger. With no line, continue normally: the preference may be disabled, usage unknown, or the harness may have no adapter.

Before starting the next step, read the remaining steps from the state, excluding `done` and `skipped`. If none remain, the workflow is finished. Otherwise ask **continue or pause**, with the counts and a recommendation:

- Recommend **pause** if tokens are greater than 80% of the window, or any remaining step runs in the main session. Under §6 that includes router steps, requirements, clarification, specification and setup; without subagents, every step runs in the main session.
- Recommend **continue** when every remaining step runs in a subagent and tokens are at most 80% of the window.

Wait for the choice. On **continue**, start the next step under §6's normal confirmation rules. Read the output again at every later step boundary: continuing once applies to this boundary only. On **pause**, follow [resume.md](resume.md), including its handoff summary and exact command for a new session.
