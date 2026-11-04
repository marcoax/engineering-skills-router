# Live ticket-to-PR checks and a direct comparison (2026-11-04)

Issue #64, testing decision 4: check automatic progression on Claude Code and Pi with a harmless scenario, then compare the router with direct use of the same agent and skill instructions on the same ticket. One ticket, one run per arm: this is a sample, not a benchmark.

## Setup

- **Ticket:** issue #7 of a scratch Node CLI (`tally`): add `tally report <file> --json` printing `{"total":N,"passed":N,"failed":N}`; four acceptance criteria (exact JSON fields, default output unchanged, unit + CLI test, README).
- **Fixture:** a fresh `git init` target with one commit and a local bare `origin`; a fake `gh` on `PATH` that serves the issue and records PR calls without reaching GitHub. Router at `963f533`.
- **Claude Code** 2.1.318, `claude -p` resumed turn by turn, `claude-opus-5-5`, effort medium, `--permission-mode dontAsk` with file, shell and Agent tools; scratch router copy via `ENGINEERING_ROUTER_HOME`.
- **Pi** 1.5.0, `pi -p` with a fixed session id, primary family OpenAI (`openai-codex/gpt-6.1-sol`) from a scratch `preferences.yaml` via `ENGINEERING_ROUTER_CONFIG`. Pi resolved the router from its installed skill, which points at the maintainer's checkout.
- **Direct arm:** same Claude Code settings, a fresh fixture, one prompt naming the same skill files the router chose (`mattpocock/implement`, `mattpocock/code-review` in a fresh subagent, `addyosmani/security-and-hardening` if the diff warrants it, `mattpocock/pr`) and authorizing branch, commits, push and PR up front.

Cost is the harness-reported `total_cost_usd` (Claude Code) or the per-message `usage.cost` sum (Pi). Elapsed time is wall-clock per `-p` call; time spent waiting for the user is not included because answers were sent immediately.

## Claude Code, with the router

| Turn | Message sent | Router stopped at | s | USD |
| --- | --- | --- | --- | --- |
| 1 | start router on issue #7 | missing `scripts/state` in the scratch router copy: asked whether to restore it | 117 | 1.14 |
| 2 | restore it and continue | workflow shown, waiting for `go` | 18 | 1.28 |
| 3 | `go` | cut off by the account spend limit during review 1 (implementation done, 2 commits) | 167 | 2.33 |
| 4 | continue after the spend-limit cutoff | `gh pr create` printed a URL but `gh pr view` found nothing: refused to claim the PR, step left `waiting` | 136 | 3.00 |
| 5 | PR #101 exists; fake `gh` fixed | done | 25 | 4.11 |
| | | **total** | **463** | **11.86** |

- **Ordinary continuation requests after `go`: 0.** Implementation, review in a fresh subagent, the in-scope fix, the security decision, the PR body and the record ran without asking.
- **Exception stops: 2, both caused by the eval harness, both correct behavior** (an unavailable prerequisite; an unverifiable publication reported instead of claimed). Turn 3's cutoff is an infrastructure interruption; turn 4 resumed from the state without redoing completed steps and reused review 1's saved report.
- **Result:** branch `7-report-json-flag`, 3 commits, `npm test` 6/6. Review 1: all four criteria met, 7 low findings: 1 fixed (CLI test for `--json` before the file), 5 declined, 1 deferred (test-helper rename, out of #7). Security skipped with a recorded reason (no new input boundary, dependency, config or secret).
- **Final records:** `.router/state.json` status `done`, every step `done` or `skipped`; the run record in the PR body carries the same findings and dispositions; `usage` is `null` (unknown), not zero. CI status reported unknown (fake `gh` has no `pr checks`). One disagreement, see below.

## Pi, with the router

| Turn | Message sent | Router stopped at | s | USD |
| --- | --- | --- | --- | --- |
| 1 | start router on issue #7 | update check due (SKILL.md section 0): asked whether to check vendor updates | 47 | 0.05 |
| 2 | skip the update check | primary question (models.md): asked which family is primary | 141 | 0.20 |
| 3 | `1` (OpenAI, the preference) | workflow shown, waiting for `go` | 22 | 0.02 |
| 4 | `go` | done | 1116 | 0.19 |
| | | **total** | **1326** | **0.45** |

- **Ordinary continuation requests after `go`: 0.** Branch, implementation, review 1 and security in subagents, PR and record ran in one turn.
- **Questions before `go`: 2, both by design.** The update check was due because Pi resolved the maintainer's checkout, not the scratch copy; the primary question is asked once per run on harnesses whose subagents can run both families. Together with the start and `go` that is four user messages before any code, against two on Claude Code.
- **Result:** branch `7-report-json`, 1 commit, 7 tests passing. Implementation default `addyosmani/incremental-implementation` (Claude Code chose `mattpocock/implement` for the same ticket: both were offered, each as the other's alternative). Review 1: no findings, criteria met. Security ran (CLI argument input), no findings. PR #101 opened through the fake `gh` with checklist and run record; CI unknown.
- **Cost** is Pi's own per-message `usage.cost` sum for the main session (2.2 M tokens); whether it includes subagent usage is not established, so treat it as a lower bound and not comparable with the Claude Code figures.

## Defect found: the record showed the PR step running

On both harnesses the PR body's run record listed `pull-request` as `running` while the state said `done`: the same symptom as newEra #951 in issue #64. Cause: after-implementation.md has the record written before the PR step is closed, and `scripts/record` copied each step's status from the state as it stood. Since writing the record is that step's last act, `scripts/record` now records a running `pull-request` step as `done`; `scripts/selftest` covers it. Records already attached to the two scratch PRs keep the old value.

## Direct, without the router

One turn, 108 s, USD 0.71, no question asked. Branch `feat/report-json-flag`, 2 commits, `npm test` 6/6 (tests written first, including `--json` in both positions). The review subagent ran standards and spec checks: no defects, all four criteria met; one style rename applied, three remarks left with reasons. The security skill ran (argument parsing touched) and found nothing. PR opened through the fake `gh`; no structured run record.

## Comparison

| | Router (Claude Code) | Direct (Claude Code) |
| --- | --- | --- |
| Acceptance criteria met | 4/4 | 4/4 |
| Tests | 6/6 | 6/6 |
| User messages to reach the PR | 2 by design (start, `go`) + 2 harness-caused + 1 infra resume | 1 |
| Ordinary continuation requests | 0 | 0 |
| Wall-clock (sum of turns) | 463 s | 108 s |
| Cost | USD 11.86 (includes the cut-off turn) | USD 0.71 |
| Review findings fixed / declined / deferred | 1 / 5 / 1 (Pi run: 0 findings) | 1 / 3 / 0 |
| Security | skipped with reason | ran, nothing found |
| Structured run record, resumable state | yes | no |

The direct arm was given the router's own skill choices, so this compares orchestration only, not selection. On this ticket both arms reach the same acceptable result; the router's one fixed finding (a flag-position test) was already covered in the direct arm by its first tests. The router's cost is dominated by its own procedure (classification, selection proposal, state writes, record), roughly 16 times the direct run here even allowing for the interrupted turn.

## Limits

- One small, low-risk ticket; one run per arm; no repetition. Results on high-risk or multi-file work, where review 2 and conditional checks apply, are not measured here.
- Two of the router's stops come from fixture defects (now fixed in the eval scripts), and one turn was cut by the spend limit; the per-turn table keeps them visible rather than subtracting them.
- The direct arm benefits from a prompt that already names the right skills; choosing them is the work the router does.
- Unknown values stay unknown: no CI results, no Pi cost for subagents beyond what Pi reports, no waiting time.

## Recommendation

**Simplify.** On a settled, low-risk ticket the router produced the same acceptable result as a direct prompt naming the same skills, at about 4 times the wall-clock and 16 times the cost on Claude Code, and with more user messages before code on Pi. What it adds here is not code quality but the things the direct arm lacks: a skill choice the user did not have to make, a resumable state (exercised: the run survived a spend-limit cutoff without redoing work), honest stops at unverifiable publication, and a structured record for `scripts/stats`. Automatic progression after `go` works on both harnesses.

Concrete simplifications this sample supports, each for a separate decision:

1. Offer `direct` (or a lighter procedure) more readily for settled low-risk tickets, where the router's overhead is not repaid.
2. Do not run the vendor update check as a blocking question at the start of a run; it is maintenance, not part of the task.
3. Reconsider asking the primary question on every new Pi run when `preferences.yaml` already names a primary.

The value claimed for high-risk work (review 2 on another family, conditional security, framework checks) is not measured by this ticket and needs its own small comparison before a keep or stop decision on those parts.
