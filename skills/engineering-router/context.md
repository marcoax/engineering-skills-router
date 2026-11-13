# Context at a step boundary

Read when an accepted `scripts/state … deliver <n>` or a main-session `step <n> done` command prints a `config:` line, or a line like:

```text
context: 162000 of 200000 window, threshold 150000
```

The adapter emits this only at or above the checkout's `context_threshold`. Read the exact counts. With no line, continue normally: the preference may be disabled, usage unknown, or the harness may have no adapter. A `config: error: …` line instead means the user configuration cannot be read: tell the user the error and that `scripts/config` shows the file, then continue.

Before starting the next step, read the remaining steps from the state, excluding `done` and `skipped`. If none remain, finish the workflow's final report. Otherwise handle the measurement under [autonomy.md](autonomy.md):

- At most 80% of the window: include usage in the progress update and continue automatically, including when the next step runs in the main session.
- Greater than 80%: report capacity pressure and continue using fresh step subagents and the harness's compaction when available. The percentage alone does not require a pause. If the harness reports exhaustion, or the next operation cannot fit after available recovery, preserve the finished step and follow [resume.md](resume.md) with the exact fresh-session handoff. Name that capacity blocker and the remaining work.

Read later measurements as further capacity information. A threshold crossing alone never asks `continue or pause`; the user can still request a pause at any point.
