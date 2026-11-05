---
status: accepted
---

# A delegated step moves on only on an accepted step result

A step subagent returned a one-line outcome, and the main session decided from the answer's prose whether the step had succeeded. We replace that with a **step result**: before the step starts, `scripts/state … expect <n>` opens an attempt and declares the artifacts the step owes (a note; findings for a review; body and consolidated findings for the pull request). The subagent writes the artifacts and a small JSON result (step, attempt, verdict `done` / `fixes` / `blocked`, summary, artifact paths) under `.router/steps/`. `scripts/state … deliver <n>` checks it. A step that declared a delivery closes as `done` only on an accepted `done` verdict, enforced by `check-state`. A delegated step of a run (a skill step, not conversational, not run inside another) cannot close as `done` without one even if it never declared it: `step <n> done` refuses it unless `--main-session` says it ran in the main session. PR preparation keeps its delivery even when the main session writes it; publication still consumes validated files.

- **Identity**: a result for another step, or from an earlier attempt, is refused. The attempt is a token `expect` issues; a new `expect` (after fixes, or a retry) makes the old one stale.
- **Verdict**: success, corrections and blockers are told apart. A finding without a decision is actionable: `done` with one is refused, `fixes` needs one. A missing or unknown verdict is no verdict, never success. A review cannot decide its own findings: decisions are refused until its `fixes` verdict was accepted.
- **Purpose**: a review pass counts once per purpose. Another pass on a review step after an accepted verdict declares `--purpose`, distinct from the earlier ones, which the result keeps in `earlier`; the mandatory cross-family review ([ADR 0001](0001-single-cross-family-review.md)) is one purpose.
- **Recoverable refusals**: `deliver` names each missing or invalid artifact and each valid one, writes nothing, and leaves the attempt open.
- **Per step**: delegated steps and PR preparation declare a delivery, with only the artifacts they produce. PR preparation always declares its body and findings, including in the main session; other main-session steps close as before, and no field becomes required for old states (`result` is optional in format v1).
- **Write limits**: the files live in `.router/steps/`, which a step subagent may write; the harness's final report keeps its own shape. A read-only reviewer ends its answer with the result as a json block, findings inline; `deliver` reads the last block and writes the findings file.
- **Publication**: the PR is opened with the accepted body file, and `scripts/record` takes the accepted findings, so nothing is extracted from a report.

## Evidence

In eraCms #956, temporary scripts coordinated steps by searching answers for strings like `ROUTER_STEP_READY`, and the advance criteria changed between recoveries. The PR preparer embedded the PR body and the findings in one report, and the final session had to extract them to publish.

## Considered options

- **A marker line in the answer**: rejected. It is what failed: a marker says nothing about whether the files exist or the findings were addressed.
- **Validating the harness's final report**: rejected. The report's shape belongs to the harness, and a read-only reviewer's answer is the only output it has; files plus a json block work for both.
- **Required result on every step**: rejected. Router and conversational steps produce nothing to validate, and existing states would become invalid.
