---
status: accepted
---

# A delegated step moves on only on an accepted step result

A step subagent returned a one-line outcome, and the main session decided from the answer's prose whether the step had succeeded. We replace that with a **step result**: before the step starts, `scripts/state … expect <n>` opens an attempt and declares the artifacts the step owes (a note; findings for a review; body and consolidated findings for the pull request). The subagent writes the artifacts and a small JSON result (step, attempt, verdict `done` / `fixes` / `blocked`, summary, artifact paths) under `.router/steps/`. `scripts/state … deliver <n>` checks it. A step that declared a delivery closes as `done` only on an accepted `done` verdict, enforced by `check-state`.

- **Identity**: a result for another step, or from an earlier attempt, is refused. The attempt is a token `expect` issues; a new `expect` (after fixes, or a retry) makes the old one stale.
- **Verdict**: success, corrections and blockers are told apart. A finding without a decision is actionable: `done` with one is refused, `fixes` needs one. A missing or unknown verdict is no verdict, never success.
- **Recoverable refusals**: `deliver` names each missing or invalid artifact and each valid one, writes nothing, and leaves the attempt open.
- **Per step**: only delegated steps declare a delivery, and only the artifacts they produce. Main-session steps close as before, and no field becomes required for old states (`result` is optional in format v1).
- **Write limits**: the files live in `.router/steps/`, which a step subagent may write; the harness's final report keeps its own shape. A read-only reviewer ends its answer with the result as a json block, findings inline; `deliver` reads the last block and writes the findings file.
- **Publication**: the PR is opened with the accepted body file, and `scripts/record` takes the accepted findings, so nothing is extracted from a report.

## Evidence

In eraCms #956, temporary scripts coordinated steps by searching answers for strings like `ROUTER_STEP_READY`, and the advance criteria changed between recoveries. The PR preparer embedded the PR body and the findings in one report, and the final session had to extract them to publish.

## Considered options

- **A marker line in the answer**: rejected. It is what failed: a marker says nothing about whether the files exist or the findings were addressed.
- **Validating the harness's final report**: rejected. The report's shape belongs to the harness, and a read-only reviewer's answer is the only output it has; files plus a json block work for both.
- **Required result on every step**: rejected. Router and conversational steps produce nothing to validate, and existing states would become invalid.
