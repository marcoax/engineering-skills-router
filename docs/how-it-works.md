# How the router works

What a run does beyond the backbone in the [README](../README.md). Why it is built this way: [design rationale](engineering-skills-router-spec.md).

## Classification and backbone

```text
task → classify → skill selector (phases, one skill per phase) → dedupe → show workflow → run
```

The router hands phase and skill choice to the [skill selector](../skills/skill-selector/SKILL.md): every vendor skill starts on equal terms, the selector consults each vendor's guide, reads the candidates and gives a default and up to two alternatives per phase with reasons. The router composes that proposal into the workflow and `scripts/state … compose` refuses any skill that is not usable for its step. When you swap a skill, the steps it runs internally (tests) are recalculated before `go`: picking an implementer without integrated tests puts testing back as a step of its own. A review is never run inside another step. A resumed workflow keeps its skills; a recomposition keeps the steps already done.

The router first records the task's type, risk, size (`complexity`) and properties, each with a reason, by the versioned criteria in [classification.md](../skills/engineering-router/classification.md). Judging the task stays with the model, but a few **facts** about the change, recorded only with evidence from the task or the inspected code, set a minimum risk: an authorization, payment or destructive change is at least high risk, sensitive data or a public contract at least medium. Words alone set nothing: docs that mention login stay low risk. `scripts/check-classification` checks the classification against those minimums before anything is offered and prints the offer; `scripts/state … compose` checks it again and stores it with its policy revision, and the run record carries it. Direct work is offered for low risk and recommended for settled tickets at low risk or medium risk with low complexity. It retains project checks, enabled commit hooks and a proportionate fresh review for behavior or shared-contract changes, without selection, workflow state or a run record. Light and full remain available when orchestration or resumable handoffs pay for themselves; high-risk work stays full-only. A resumed or recomposed run keeps the classification it was approved with unless the recomposition revises it. Size helps pick skills: the selector weighs a skill's catalog `complexity`, which never leaves a phase without a skill.

Default backbone: **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by task type and risk. Requirements runs after any code-understanding step and asks only about material gaps; it is skipped when the issue, spec or conversation already settles the objective and boundaries. One review runs at every risk, on the model family opposite to the one that wrote the code; at high risk an independent review starts off, and you switch it on when you approve the workflow.

## Light path

A ticket that already says what to build, at low risk (or medium risk and low complexity), can run as one implementer and one independent look at its work: `branch → implementation → review → [security] → [framework-review] → pull request`. The review is a cross-family review in a fresh agent, as on the full path; security is preselected as a conditional check and runs when the task or diff warrants it (auth, input, queries, secrets, dependencies, config or permissions). Framework-review joins when the project lists its own best-practice skills. No grilling, spec, issue, independent review or verification. It is an alternative to direct work for settled small tickets; `full` in the selection switches back. The run record marks the path, so `scripts/stats` shows whether light runs turned up serious findings.

## Approval through delivery

`go` approves the selected workflow through the open PR, including issue and ticket publication when selected, implementation, tests, reviews, in-scope fixes, commits and push. Progress updates continue into the next step. Selected and nested skills use that authorization for routine approval gates; documents and test plans still get produced. Real unresolved decisions, changed scope, missing prerequisites and explicit user checkpoints can interrupt the run. The manual checklist travels to the PR with human checks still pending. Merge and deployment require separate authorization. The full policy is [autonomy.md](../skills/engineering-router/autonomy.md).

## What each run leaves

The PR ends with a manual checklist of at most 15 points built from what the diff really changed, each tagged `[agent]` or `[you]`; the optional **verification** step has a fresh agent check the `[agent]` points first. The body also carries a hidden run record (skills, models, efforts, findings with severity, who found them and what was decided): `scripts/stats` adds them up across PRs, to see which reviews and models earn their place. Format: [run-record.md](../skills/engineering-router/run-record.md).

## Without GitHub issues

To keep the spec as a file in the target repo instead, prefer a specification skill that writes one, in your `preferences.yaml` ([configuration.md](configuration.md)):

```yaml
preferences:
  specification:
    prefer: [addyosmani/spec-driven-development]
```

The preference only picks the skill; since no selected skill then publishes an issue, the workflow has none. Steps use skills that need no issue tracker, except planning, which can publish tickets from the spec (below); the branch is `<slug>` and starts by committing the spec file, every review checks the diff against the spec file, and the PR links it instead of closing an issue.

You can also start from a spec you already wrote: give its path as the task (`/engineering-router docs/specs/export.md`). The router skips the specification step, uses the file as the spec, and runs the rest of the workflow as above, without an issue. Requirements runs only when the file leaves decisions open.

A spec file can still get tickets on the tracker: when the spec splits, planning uses `mattpocock/to-tickets`, which publishes them from the file (standalone, each naming the spec), and the PR closes them. It is the default when the target repo has `docs/agents/issue-tracker.md`; otherwise planning only breaks the spec into tasks, and `to-tickets` is offered as the alternative that publishes them (it adds the one-time tracker setup step).

Tickets are decided on the spec, not before it: when the spec is still to be written, planning is a conditional step, and once the spec exists the router says whether it splits into more than one ticket (run planning) or not (skip it), with the reason.

## Project skills

A target repo can list its own skills in `docs/agents/skills.yaml`, in the format of `catalog/skills.yaml` with ids `project/<name>` and paths relative to that repo, inside it:

```yaml
skills:
  project/laravel-best-practices:
    path: .claude/skills/laravel-best-practices/SKILL.md
    categories: [framework-review]
    use_when:
      - change touches PHP/Laravel code
```

When one fits the task, the workflow gets a `framework-review` step after the reviews: the change is checked against the project's own conventions, and its findings join the other reviews'. A repo without the file gets no such step. Only project skills fill `framework-review`; tagged with another phase (e.g. `implementation`), a project skill is listed right after a user preference there; `scripts/validate-catalog --target <repo>` checks the file.

## Personal skills

Your own skills can be candidates too. Set `personal_path` in your `preferences.yaml` to the folder that holds them (a leading `~` is your home dir; a relative path resolves against the configuration directory, or the router checkout for a clone-local `config/`), then copy `config/personal-skills.example.yaml` to `personal-skills.yaml` beside it and list them there, in the format of `catalog/skills.yaml` with ids `personal/<name>` and paths relative to `personal_path`, inside it:

```yaml
preferences:
  personal_path: ~/my-skills
```

They fill any phase but `framework-review`, on equal terms with the vendor skills; name one in `prefer` to have it chosen when it fits. The router reads them in place and never writes there. They are not pinned: editing one changes the next workflow. One named like a cataloged vendor skill (`personal/tdd` next to `mattpocock/tdd`) is skipped with a warning, never used in its place. `scripts/validate-catalog` checks the file. A Pi package update wipes `config/`, so keep both files in the external configuration directory ([configuration.md](configuration.md)).

## State and subagents

While running, the router keeps `.router/state.json` and one note per step in `.router/steps/` in the target repo (git-excluded). Where the agent supports subagents, each skill step runs in a fresh subagent on the session's model; steps that talk with the user (requirements, specification, setup) and simple PR preparation stay in the main session. PR preparation still delivers validated body and findings files. The review findings you choose to fix are fixed in a fresh subagent too. A delegated step moves on only when `scripts/state … deliver` accepts its step result: a JSON object for that step and attempt with a verdict (`done`, `fixes`, `blocked`) and the files the step declared (note, findings, PR body), so a phrase in an answer never counts as success ([step-result.md](../skills/engineering-router/step-result.md)). An unfinished workflow can be resumed later, also from a new session. One session owns it, and `scripts/state` refuses changes from any other until that session hands it over explicitly with `takeover --previous-closed`. Each run has an id: its notes carry it, notes of another run never count as evidence, and a finished or discarded run is archived with its notes in `.router/runs/` ([ADR 0002](adr/0002-workflow-ownership.md)). A running step saves a progress record as it goes (work done, next work, the checks it ran tied to the files they covered), so a step stopped by a timeout or a quota resumes from its first missing work: `scripts/state <target-repo> recover --env "<environment>"` reuses only the checks whose files and environment are unchanged (without `--env`, none), keeps commits and uncommitted changes as they are, and never switches model on its own: past two retries the user decides ([ADR 0003](adr/0003-progress-records.md)). The adapters show such a step as a recoverable error, not as running work. A delegated step closes as done only on an accepted step result, and a review pass counts once per purpose.

## Context at a step boundary

After a step closes, the Claude Code and Pi adapters append a `context:` line to that state command's output when the session reaches `context_threshold` (default 150000 tokens). The command runs separately so the router reads its output before starting the next step. The warning is informational: the workflow continues automatically. Above 80% of the window it reports capacity pressure, using fresh step subagents and harness compaction when available. Only actual exhaustion or insufficient capacity after available recovery requires a fresh-session handoff.

The handoff prints completed steps, next step, issue or spec, branch, PR, target directory and the exact router command for a fresh session. It uses the existing state and step notes; resuming reads them and starts at the first step not done or skipped. No step is interrupted, and a finished workflow goes straight to its final report.

With `context_threshold: 0`, unknown context (including after compaction), or a harness without an adapter, there is no context line or question. Preferences belong to the router checkout, not the target repo; an invalid value falls back to 150000 and is reported by `scripts/validate-catalog`; an unreadable configuration file is reported after the step as a `config:` line, never taken for the default.

## Cross-family review

Steps run on the run's primary family, kept in its `.router/state.json`: a new run starts from `primary` in your `preferences.yaml` ([configuration.md](configuration.md)), and where subagents can run both families the router first asks whether to keep it or switch for this run. Every step that reviews code (the review, framework-review, security, independent-review and the re-check after fixes) runs on the family opposite to the one that wrote the code, whatever a review phase's `model` says (`models` in your `preferences.yaml` ([configuration.md](configuration.md)) names each family's model; why: [ADR 0001](adr/0001-single-cross-family-review.md)). That works only where the agent can actually reach both: subagents that take an explicit model, and a provider configured for each family under the ID the preferences name. Pi with a subagent extension and both providers set up is one such environment; it is an example, not a requirement, and Pi without them cannot do it either. An agent whose subagents run only its own vendor's models cannot (a run from Codex, for instance, could not reach the Claude family; Claude Code reaches the other family through its mod, see [claude-code.md](claude-code.md)). Before the workflow starts, the router says whether the reviews on the other family are available, unverified (the provider ID is checked only when its subagent starts) or unavailable, and why. When they are unavailable, or a review fails to start, you choose once: run them as same-family reviews, or stop. A same-family review runs in a fresh agent, and the workflow, its outcome and the run record (`cross_family: false`) say it is not independent.
