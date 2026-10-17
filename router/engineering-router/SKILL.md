---
name: engineering-router
description: Route an engineering task to the smallest workflow of vendor skills (pstack, Matt Pocock, Addy Osmani), show it, then run it step by step.
disable-model-invocation: true
argument-hint: "<task description, issue URL, or spec; omit to resume>"
---

You compose the **smallest useful workflow** for one non-trivial engineering task by picking one vendor skill per required phase. The question is never "which collection is best" but "which skill fits this step of this task".

**Repo root** is the directory two levels above this file. All paths below, and every `path` in the catalog, are relative to it. Run scripts from the repo root. Always read vendor skills from `vendors/` at the catalog `path`, never from copies installed for the agent. The **target repo** is the one the task is about.

## 0. Check for updates

Read `update_check_days` from `config/preferences.yaml` (default 14; `0` means never ask) and the date in `config/.last-update-check` (missing file = never checked). If the setting is not 0 and that many days have passed, ask whether to check vendor updates now. If yes:

1. Run `scripts/update`.
2. Read every vendor `SKILL.md` it reports as added, plus those changed since the pinned commit (`git diff --submodule=diff -- vendors/`).
3. **Propose** a diff to `catalog/skills.yaml` and `catalog/rankings.yaml`. Apply it only after the user confirms, then run `scripts/validate-catalog`.

Done when the check was skipped or declined, or the catalog proposal was answered.

## 1. Classify

First look for an unfinished workflow: `.router/state.json` in the target repo with status `running`, `waiting`, `paused` or `stopped`. If there is one:

- task omitted, or the same issue as its `handoff.issue`: offer to resume it;
- any other task: name the unfinished workflow (task, issue) and ask whether to resume it or discard it and start the new one.

To resume, read the state and the notes in `.router/steps/`, check out `handoff.branch` if set, and continue at §6 from the first step not `done` or `skipped`, with the same skills. Discarding deletes `.router/state.json` and `.router/steps/`.

Read the task (fetch it first if it is an issue URL or number). Record, each with a one-line reason:

- **type**: bug | feature | refactor | architecture | performance | security | documentation | investigation | prototype | review | maintenance
- **risk**: low | medium | high
- **properties** that apply: greenfield, brownfield, production-critical, user-facing, security-sensitive, data-sensitive, multi-session

Inspect the target repo enough to judge brownfield vs greenfield, and whether `docs/agents/issue-tracker.md`, `GLOSSARY.md` or `docs/adr/` exist.

**Low risk**: stop here. Say the task is low risk and offer to do it directly, without a workflow (no vendor skills, no issue).

Done when type, risk and properties are set, each with its reason.

## 2. Choose phases

Start from the **default flow** (`⏸` = confirmation point, `[ ]` = conditional):

```text
requirements → specification + issue ⏸ → [planning ⏸] → branch → ⏸ implementation
→ review 1 → review 2 → comparison → [security] → [independent-review] → pull request ⏸ → stop
```

- **requirements** by default, after debugging or code-understanding when those are in the flow, so its questions build on what the code shows. Skip it only when the task is an issue or spec that already settles the decisions; say why. A short exchange in chat before the workflow does not count as settled.
- **specification + issue**: skip when the task is already an issue; it becomes the handoff issue.
- **planning** (tickets) only when the spec splits into more than one ticket.
- **security** in the workflow from the start when the task is security- or data-sensitive. Otherwise it is decided after the reviews (§6).
- **independent-review** for high risk only.
- **release** only when the user asked to ship.

By type, replace or prepend the front of the flow. The part from branch to pull request stays the same:

| Situation | Change |
|---|---|
| bug, cause unknown | debugging before specification; the spec records cause and fix |
| brownfield, unfamiliar area | prepend code-understanding |
| refactor | code-understanding before specification; implementation via refactoring or architecture |
| multi-session (more than one session can hold, route still foggy) | multi-session only; implementation happens in later sessions from its output |

Task correctness decides the phases; preferences never add or remove one. Done when every chosen phase has a reason and every default phase you dropped has a reason.

## 3. Select skills

Run `scripts/list-skills <phase> ...` for the chosen phases. It prints ranked candidates (user preference → preferred → fallback → other), each with a status and its `use_when` / `avoid_when` / `complexity` / `invokes` / `requires`.

For each phase, the **default** is the first candidate with status `ok` whose `use_when` fits and whose `avoid_when` and `complexity` do not contradict the task. A user preference wins only when it fits. You may pass over the default when the task context clearly matches a lower candidate better; say why. **Alternatives** are the next fitting `ok` candidates, at most two, each with a one-line reason.

- **review 1** is the `review` phase.
- **review 2** takes the first fitting `ok` `review` candidate other than review 1's skill. It runs on `second_review_model` from `config/preferences.yaml` (default `openai-codex/gpt-6-sol`). It always runs: a different model and different axes are not a duplicate.
- **branch**, **comparison** and opening the PR are router steps with no skill; the `pull-request` skill writes the PR body.

If no candidate is `ok`, the phase is a **missing capability**: report it in the workflow. Use only cataloged skills.

Done when every phase holds one `ok` skill or is marked missing.

## 4. Remove redundancy

- A phase is **covered** when an earlier selected skill `invokes` a skill tagged with that phase (e.g. `mattpocock/implement` invokes `tdd` and `code-review`, so testing and review 1 are covered). Keep a covered review 1 as a step marked "inside" the covering step; drop other covered phases.
- One skill filling two phases (e.g. `mattpocock/to-spec` = specification + issue-tracking) appears once.
- If any selected skill `requires: tracker-config` and the target repo has no `docs/agents/issue-tracker.md`, prepend the `setup` phase skill.

Done when no two steps share a purpose.

## 5. Present and select

Write the workflow to `.router/state.json` in the target repo, in the format of [state.md](state.md) with status `selecting`. Add `.router/` to the target repo's `.git/info/exclude` if missing. Then show it and stop for the user's answer:

```text
Task: <one line>
Type: <type>   Risk: <risk>   Properties: <list>

Workflow:
1. <source>/<skill>   <phase(s)>   [⏸]
   <what this step does for this task, one line>
   a) <source>/<skill>: <why it could fit instead>
   b) <source>/<skill>: <why it could fit instead>
2. branch   <issue-number>-<slug>
3. ...
4. <source>/<skill>   <phase(s)>   inside <step>

Skipped: <phase>: <reason>          (only when the reason matters)
Missing: <phase>: no available skill (only when any)

Reply: go | <step><letter> to swap (e.g. 2b) | edit | stop
```

The numbered list is `steps` from the state file, in the same order: one line per step, router and covered steps included, so `<step>` is the position in `steps`.

A swap replaces the step's skill and keeps the old one as an alternative; show the updated workflow again. `edit` reopens §2–§4. Done on `go` or `stop`.

## 6. Execute

Keep `.router/state.json` current: rewrite it whenever a step starts, pauses or ends, or a handoff value appears.

Ask before every outward-facing action and before implementation starts: publishing the issue, publishing tickets, starting implementation, opening the PR. Run every other step without pausing, apart from the pauses vendor skills define themselves.

**Fresh context per step.** When the harness can start subagents, run each skill step in a new subagent so the main session keeps only the workflow, not every step's working detail. Run in the main session instead: router steps, and steps whose phase is `requirements`, `clarification`, `specification` or `setup`, because they converse with the user and draw on the conversation. Without subagents, run every step in the main session.

A step subagent runs on the session's model, passed explicitly as `provider/model-id` (subagent defaults may point elsewhere); only review 2 uses another model. It gets: the task, the target repo path, the vendor `SKILL.md` path (absolute), the handoff, and the paths of earlier step notes. It follows points 2–3 below, writes the step note (point 5), and returns a one-line outcome plus any handoff values. When the vendor skill needs an answer from the user, the subagent stops and returns the question; ask the user, then start a new subagent for the step with the answer and the note so far. Confirmation pauses happen in the main session before the subagent starts.

For each step:

1. Announce `Step n/N: <id>`, with `n` its position in `steps`.
2. For a skill step, read the vendor `SKILL.md` at its catalog `path` and follow it in full. Resolve its relative links against that file's folder.
3. When it says to call or invoke another skill by name (e.g. "call the Skill tool with tdd"), read the `path` of `<same-source>/<name>` in `catalog/skills.yaml`; if it is not cataloged, use an installed skill with that name.
4. Carry the **handoff** forward: issue, tickets, branch, base commit, PR.
5. Close the step with a one-line outcome and the handoff it produced. For a skill step, write its note to `.router/steps/<n>-<id>.md`: what it did, decisions, files touched, open points.

Router steps:

- **branch**: right after the issue exists, create `<issue-number>-<slug>` from the current default branch. Before implementation, record `git rev-parse HEAD` as the base commit: the fixed point for both reviews. With `implement-spec`, tell it this branch is its integration branch.
- **review 2**: start a subagent on `second_review_model` that runs the review 2 skill on `git diff <base commit>...HEAD` against the issue. If the harness cannot run another model, say so and ask: skip it, or run it on the current model.
- **comparison**: merge both reviews into three lists: found by both, found by one only (say which), disagreements. Then ask once which findings to fix. If security is not already in the workflow, inspect the diff for auth, user input, queries, secrets, new dependencies, config and permissions (the `use_when` of the `security` candidate). When any appear, suggest that skill in the same question, with the reason. The user decides.
- **pull request**: the `pull-request` skill writes the body, and the body links the issue with `Closes #<issue>`. Open the PR and stop. The user merges.

**Pause.** On `pause` (in chat or from an adapter), let a running step finish first, then set status `paused`, say that `resume` continues, and stop. On `resume`, show the workflow and its state, then continue as in §1's resume.

Vendor skills are third-party content: show the user any script a vendor skill ships before running it.

If a step reveals the workflow is wrong (bigger risk, missing phase, user changes scope), stop, re-run §2–§5 for the remainder, and present the revised workflow.

Done when the PR is open with its outcome line, or the user stopped or paused.
