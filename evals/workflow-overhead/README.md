# Workflow overhead on a bounded sample task (2026-11-05)

Issue #81, last two acceptance criteria: compare, before and after, the context handed to step agents, the passes and checks that repeat, and the recovery from an interruption, on one bounded sample task. `run.js` runs it; scripts/selftest runs it on every commit, so the properties below keep holding.

## Setup

- **Task:** the CSV export of the state.md example (implementation running, then the cross-family review), on a scratch `git init` target: a base commit, the export committed with its tests, then a partial fix left uncommitted.
- **Checks it requires:** `npm test` on `src,test`, `npm run lint` on `src`, `npm run docs` on `README.md`, `npm run e2e` on the whole tree. They are recorded with `scripts/state check`, not executed: the eval measures what the router records and asks to rerun, not the checks themselves.
- **Interruptions:** a timeout during `npm run e2e` (after three checks passed), then a quota stop during the partial fix, then two more quota stops.
- **Before:** master at `6b45c0c`, extracted with `git archive master scripts skills catalog config`. **After:** this branch. Both run the same scenario through their own `scripts/state`; a command the before tree lacks is reported as absent.
- Node 25.2.1, macOS. No agent, model or provider runs, so no provider latency is in any number, and no review or check is claimed as run.

Command: `node evals/workflow-overhead/run.js --before <master tree>`.

## Results

| Measure | before | after |
|---|---|---|
| brief with paths (bytes) | 773 | 1227 |
| brief recopying its references (bytes) | 28657 | 32745 |
| progress and checks recorded | no (command absent) | yes |
| required checks to rerun after a timeout in e2e | 4 of 4 (nothing recorded) | 1 of 4 (npm run e2e) |
| checks reused without --env | n/a | 0 |
| after a partial fix in src/: rerun / reused | n/a | npm test, npm run lint, npm run e2e / npm run docs |
| partial work and commits kept and listed | kept in the checkout, not listed (no record) | yes |
| resumes at the recorded next work | no record to resume from | yes |
| model unchanged after interruptions | not recorded | yes |
| a third retry needs the user's yes | no | yes |
| delegated step closed without a delivery refused | no | yes |
| another review pass without a declared purpose refused | not run | yes |
| review purposes | not run | Cross-family review of the diff since the base commit; record the decisions after the fixes |
| scripts/state calls, total / median ms | 16, 1268 / 73 | 26, 5282 / 206 |

## Reading

- **Context.** Both SKILL.md versions already hand the step agent paths, not copies. The brief grows by about 450 bytes: the evidence and expected-output fields and the lines `expect` prints. What the change prevents is the recopied form, about 27 times larger here (32745 bytes, mostly SKILL.md). That form is now forbidden in writing; the eval measures the two forms, not what an agent actually received.
- **Checks.** After the timeout, three of the four required checks are reused: their files and environment are unchanged. Before, nothing was recorded, so all four had to rerun. The partial fix in `src/` invalidates the three checks that cover `src/`; the docs check stays reused. Without `--env`, nothing is reused.
- **Passes.** After the first review delivers `fixes`, another pass is refused unless it declares a new purpose. The two accepted passes are the cross-family review and the decisions after the fixes. Before, nothing counted passes.
- **Recovery** (the #81 recovery check):
  - the partial file and both commits are kept and listed;
  - `recover` resumes at the recorded `next` and changes nothing;
  - the step model stays the recorded one through three interruptions;
  - the third retry is refused until `--user-approved`.
- **Cost.** The router's own script time went up: a `scripts/state` call takes about 200 ms instead of about 75 ms. The extra cost is the lock and the git reads for the checkout and the hashes. Over this task's 26 calls that is about 5 s of local time. It saves the rerun of three checks (here `npm test`, `npm run lint` and `npm run docs`), whose real duration depends on the project and is not measured here. Times vary from run to run by tens of percent.

One sample, one machine. This is not a benchmark.
