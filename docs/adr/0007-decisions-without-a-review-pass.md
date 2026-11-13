---
status: accepted
---

# A review's findings are decided on its step, without a pass of their own

After a review delivered `fixes` and the fixes ran, the main session opened another attempt on the review step with the purpose "record the decisions after the fixes", rewrote the findings with their decisions by hand and delivered `done`. That pass checked nothing a review checks, yet counted as one. Now every finding gets its decision on the review step (the coordinating step) from the party that made it, and the step closes when none is actionable. This amends how [ADR 0004](0004-step-result-contract.md) describes the pass after the fixes; the delivery lifecycle of [ADR 0006](0006-delegated-step-lifecycle.md) otherwise holds.

- **Fixed:** `start <n> --fixes` opens the fixes run's attempt on the review step: no purpose, the code writer's model printed for dispatch, the step's own model unchanged. Its delivery carries its note and, as `findings`, each finding it fixed with `decision: "fixed"`; a finding the review did not report, or another decision, is refused.
- **Declined and deferred:** `decide <n> <finding> declined|deferred --reason "..."` records the main session's decision with its evidence or reason, one command per finding. It is refused before the review's `fixes` verdict was accepted.
- **Closing:** the step keeps the review's findings and their decisions in its result (`findings`) and in the review's findings file, in the format `scripts/record` reads. While one is actionable the step stays `running` and names it; when none is, the step closes as `done` on that delivery or decision, its outcome the deliveries' summaries and the decision counts. `check-state` refuses a done review with an actionable finding, and accepts one closed on its `fixes` verdict once all its findings carry a decision.
- **Unchanged:** a review never decides its own findings, on any pass now. A fix that materially changes behavior still gets one re-check: the fixes result names it in `recheck`, the step waits for that pass, and the pass declares its own purpose. Findings and decisions reach the run record as before.
- **Context boundary:** a decision that closes the step prints `done:` first, like a closing delivery, so the adapters measure context there too.

## Evidence

On eraCms PR #1003 one review step took four passes, among them an attempt opened only to record the decisions after the fixes ran, its findings rewritten by hand and delivered again.

## Considered options

- **Keep the decisions pass with a mandatory purpose:** rejected. A purpose cannot make copying decisions a review, and the pass still costs an attempt and a delivery.
- **The fixes run decides every finding, declined and deferred included:** rejected. Declining or deferring is the main session's judgment under the approved scope, with its evidence, not the implementer's.
- **A separate fixes step in the workflow:** rejected. The fixes belong to the review that found them; a step of their own would change composition, coverage and every recorded workflow.
