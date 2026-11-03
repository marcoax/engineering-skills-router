# How the router works

What a run does beyond the backbone in the [README](../README.md). Why it is built this way: [design rationale](engineering-skills-router-spec.md).

## Classification and backbone

```text
task → classify → phases → one skill per phase → dedupe → show workflow → run
```

The router first records the task's type, risk, size (`complexity`) and properties, each with a reason. A low-risk task gets no workflow: the router offers to do it directly, and if you want the workflow anyway it runs as at medium risk. Size helps pick skills: a skill's catalog `complexity` ranks it, but never leaves a phase without a skill.

Default backbone: **requirements → spec + GitHub issue → tickets → implement + test → review**, trimmed or extended by task type and risk. Requirements (a grilling session) runs after any code-understanding step, so its questions build on the code; it is skipped only when the task is an issue or spec that already settles the decisions. One review runs by default at every risk; a second review on the other model family and a comparison of both (and, at high risk, an independent review) start off, and you switch them on when you approve the workflow.

## Light path

A ticket that already says what to build, at low risk (or medium risk and low complexity), can run as one implementer and one independent look at its work: `branch → implementation → review 1 → [security] → [framework-review] → pull request`. Review 1 runs in a fresh agent, never inside the implementation step; security joins when the diff touches auth, input, queries, secrets, dependencies, config or permissions, and framework-review when the project lists its own best-practice skills. No grilling, spec, issue, review 2 or comparison. The router proposes it; `full` in the selection switches back. The run record marks the path, so `scripts/stats` shows whether light runs turned up serious findings.

## What each run leaves

The PR ends with a manual checklist of at most 15 points built from what the diff really changed, each tagged `[agent]` or `[you]`; the optional **verification** step has a fresh agent check the `[agent]` points first. The body also carries a hidden run record (skills, models, efforts, findings with severity, who found them and what was decided): `scripts/stats` adds them up across PRs, to see which reviews and models earn their place. Format: [run-record.md](../skills/engineering-router/run-record.md).

## Without GitHub issues

To keep the spec as a file in the target repo instead, prefer a specification skill that writes one, in `config/preferences.yaml`:

```yaml
preferences:
  specification:
    prefer: [addyosmani/spec-driven-development]
```

The preference only picks the skill; since no selected skill then publishes an issue, the workflow has none. Steps use skills that need no issue tracker, except planning, which can publish tickets from the spec (below); the branch is `<slug>` and starts by committing the spec file, review 2 checks the diff against the spec file, and the PR links it instead of closing an issue.

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

When one fits the task, the workflow gets a `framework-review` step after the reviews: the change is checked against the project's own conventions, and its findings join the comparison. A repo without the file gets no such step. Only project skills fill `framework-review`; tagged with another phase (e.g. `implementation`), a project skill ranks right after a user preference there; `scripts/validate-catalog --target <repo>` checks the file.

## Personal skills

Your own skills can be candidates too. Set `personal_path` in `config/preferences.yaml` to the folder that holds them (a leading `~` is your home dir; a relative path resolves against the router checkout), then copy `config/personal-skills.example.yaml` to `config/personal-skills.yaml` (git-ignored) and list them there, in the format of `catalog/skills.yaml` with ids `personal/<name>` and paths relative to `personal_path`, inside it:

```yaml
preferences:
  personal_path: ~/my-skills
```

They fill any phase but `framework-review`, after the ranked vendor skills; rank one first with `prefer` (`catalog/rankings.yaml` stays vendor-only). The router reads them in place and never writes there. They are not pinned: editing one changes the next workflow. One named like a cataloged vendor skill (`personal/tdd` next to `mattpocock/tdd`) is skipped with a warning, never used in its place. `scripts/validate-catalog` checks the file. A Pi package update wipes `config/`, so keep them in a personal clone, as for preferences.

## State and subagents

While running, the router keeps `.router/state.json` and one note per step in `.router/steps/` in the target repo (git-excluded). Where the agent supports subagents, each skill step runs in a fresh subagent on the session's model; steps that talk with the user (requirements, specification, setup) stay in the main session. The review findings you choose to fix are fixed in a fresh subagent too. An unfinished workflow can be resumed later, also from a new session.

## Context at a step boundary

After a step closes, the Claude Code and Pi adapters append a `context:` line to that state command's output when the session reaches `context_threshold` (default 150000 tokens). The command runs separately so the router reads its output before starting the next step. It asks **continue or pause**, recommending continue when every remaining step runs in a subagent, and pause when any runs in the main session or context is above 80% of the model's window. The token threshold triggers the question; 80% only changes the recommendation.

Continue starts the next step, with the question repeated at later boundaries while usage stays above the threshold. Pause prints the completed steps, next step, issue or spec, branch, PR, target directory and exact router command for a fresh session. It uses the existing state and step notes; resuming reads them and starts at the first step not done or skipped. No step is interrupted, and a finished workflow needs no question.

With `context_threshold: 0`, unknown context (including after compaction), or a harness without an adapter, there is no context line or question. Preferences belong to the router checkout, not the target repo; unreadable or invalid runtime preferences fall back to 150000, with invalid values reported by `scripts/validate-catalog`.

## Review 2 on another model family

Steps run on the run's primary family, kept in its `.router/state.json`: a new run starts from `primary` in `config/preferences.yaml`, and where subagents can run both families the router first asks whether to keep it or switch for this run. Review 2 runs on the family opposite to review 1's (`models` in `config/preferences.yaml` names each family's model), which works only where the agent can actually reach both: subagents that take an explicit model, and a provider configured for each family under the ID the preferences name. Pi with a subagent extension and both providers set up is one such environment; it is an example, not a requirement, and Pi without them cannot do it either. An agent whose subagents run only its own vendor's models cannot (a run from Codex, for instance, could not reach the Claude family; Claude Code reaches the other family through its mod, see [claude-code.md](claude-code.md)). Before the workflow starts, the router says whether review 2 on the other family is available, unverified (the provider ID is checked only when its subagent starts) or unavailable, and why. When it is unavailable, or its subagent fails to start, you choose: skip review 2, or run it on the current model. On the current model it is a second review, not an independent one, and the workflow and comparison say so.
