---
name: engineering-router
description: Route an engineering task to the smallest workflow of vendor skills (pstack, Matt Pocock, Addy Osmani), show it, then run it step by step.
disable-model-invocation: true
argument-hint: "<task description, issue URL, or spec; omit to resume>"
---

You compose the **smallest useful workflow** for one non-trivial engineering task by picking one vendor skill per required phase. The question is never "which collection is best" but "which skill fits this step of this task".

**Repo root** is the router checkout (catalog, scripts, vendors) this skill works from. Find it before anything else with `node <this skill's folder>/resolve-root.js`, and use the `root:` it prints. When it prints `missing` instead, this skill was installed without its checkout:

- Explain that the router needs its catalog and vendor skills, and ask to fetch them into the printed `data-dir` with `git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router <data-dir>`, then `<data-dir>/scripts/setup`. On yes, run both and the resolver again.
- If that `data-dir` already exists (e.g. an interrupted clone), do not clone over it: tell the user, and offer to remove it and clone again, or to point `ENGINEERING_ROUTER_HOME` at a clone.
- On no, stop: say the router cannot run without a checkout, and that `ENGINEERING_ROUTER_HOME` can point it at an existing clone.

When the resolver also prints `skill:`, this file is a copy installed apart from the checkout (e.g. by `npx skills add`), and it may be older or newer than the checkout. Stop reading this file: read the printed `skill:` file and follow it from the top instead, resolving its links (such as `state.md`) against its own folder. In that file, finding the root and this hand-over are already done: do not run its resolver, and keep the `root:` and `found:` printed here. Otherwise continue here.

Tell the user the root in use and how it was found (`found:`). With `found: pi` the checkout belongs to Pi: keep it read-only and skip §0 (`pi update git:github.com/marcoax/engineering-skills-router` updates it). All paths below, and every `path` in the catalog, are relative to the root; `list-skills` prints personal and project skills' paths absolute (§3). Run scripts from the root. Always read vendor skills from `vendors/` at the catalog `path`, never from copies installed for the agent. The one exception is personal skills, read in place where `list-skills` points. The **target repo** is the one the task is about.

Then run `scripts/validate-catalog`. When it prints errors, show them with the file they point at (`config/preferences.yaml` is at the root) and ask: fix them now, or continue with the defaults for the settings in error. Done when it passes or the user chose.

## 0. Check for updates

Read `update_check_days` from `config/preferences.yaml` (default 14; `0` means never ask) and the date in `config/.last-update-check` (missing file = never checked). If the setting is not 0 and that many days have passed, ask whether to check vendor updates now. If yes:

1. Run `scripts/update`.
2. Read every vendor `SKILL.md` it reports as added, plus those changed since the pinned commit (`git diff --submodule=diff -- vendors/`).
3. **Propose** a diff to `catalog/skills.yaml` and `catalog/rankings.yaml`. Apply it only after the user confirms, then run `scripts/validate-catalog`.

Done when the check was skipped or declined, or the catalog proposal was answered.

## 1. Classify

First look for an unfinished workflow: `.router/state.json` in the target repo with status `running`, `waiting`, `paused` or `stopped`. If there is one:

- task omitted, or the same issue as its `handoff.issue` (issue-free: §4): offer to resume it;
- any other task: name the unfinished workflow (task, issue or spec file) and ask whether to resume it or discard it and start the new one.

To resume, read the state and the notes in `.router/steps/`, check out `handoff.branch` if set, and continue at §6 from the first step not `done` or `skipped`, with the same skills. Discarding deletes `.router/state.json` and `.router/steps/`.

Read the task (fetch it first if it is an issue URL or number). Record, each with a one-line reason:

- **type**: bug | feature | refactor | architecture | performance | security | documentation | investigation | prototype | review | maintenance
- **risk**: low | medium | high
- **complexity**: low | medium | high, the task's size, matched against each skill's catalog `complexity` (§3)
- **properties** that apply: greenfield, brownfield, production-critical, user-facing, security-sensitive, data-sensitive, multi-session

Inspect the target repo enough to judge brownfield vs greenfield, and whether `docs/agents/issue-tracker.md`, `docs/agents/skills.yaml` (the project's own skills), `GLOSSARY.md` or `docs/adr/` exist.

**Low risk**: stop here. Say the task is low risk and offer to do it directly, without a workflow (no vendor skills, no issue). If the user wants the workflow anyway, keep risk `low` and continue: it runs as at medium risk.

Done when type, risk, complexity and properties are set, each with its reason.

## 2. Choose phases

Start from the **default flow** (`⏸` = confirmation point, `[ ]` = conditional):

```text
requirements → specification + issue ⏸ → [planning ⏸] → branch → ⏸ implementation → [⏸ your check]
→ review 1 → [review 2] → [framework-review] → [comparison] → [security] → [independent-review] → pull request ⏸ → stop
```

- **requirements** by default, after debugging or code-understanding when those are in the flow, so its questions build on what the code shows. Skip it only when the task is an issue or spec that already settles the decisions; say why. A short exchange in chat before the workflow does not count as settled.
- **specification + issue**: skip when the task is already an issue; it becomes the handoff issue. Otherwise the issue exists only when the selected specification skill publishes one (§4).
- **planning** (tickets) only when the spec splits into more than one ticket.
- **One review by default**, at every risk. **review 2** and **comparison** are optional: both stay in the workflow but start off, and the user switches them on in §5.
- **security** is decided after the reviews (§6).
- **framework-review** (the project's own best practices) only when the target repo has `docs/agents/skills.yaml` and §3 finds a fitting candidate in it. It runs after review 2, or after review 1 when review 2 is skipped. Without one it is dropped, not missing.
- **independent-review** for high risk only, optional: it starts off, like review 2.
- **release** only when the user asked to ship.

By type, replace or prepend the front of the flow. The part from branch to pull request stays the same:

| Situation | Change |
|---|---|
| bug, cause unknown | debugging before specification; the spec records cause and fix |
| brownfield, unfamiliar area | prepend code-understanding |
| refactor | code-understanding before specification; implementation via refactoring or architecture |
| multi-session (more than one session can hold, route still foggy) | multi-session only; implementation happens in later sessions from its output |

Task correctness decides the phases; preferences never add or remove one, they only rank skills. `issue-tracking` is dropped only as an outcome of selection, when no selected skill fills it (§4). Done when every chosen phase has a reason and every default phase you dropped has a reason.

## 3. Select skills

Run `scripts/list-skills --target <target repo> <phase> ...` for the chosen phases. It prints ranked candidates (user preference → preferred → fallback → other), each with a status and its `use_when` / `avoid_when` / `complexity` / `invokes` / `requires`. **Project** candidates, `project/<name>`, are the target repo's own skills from `docs/agents/skills.yaml`; they are the only candidates for `framework-review`, and in v1 they fill no other phase. **Personal** candidates, `personal/<name>`, are the user's own skills from `config/personal-skills.yaml`; they fill any other phase, ranked by a user preference or as `other`.

For each phase, the **default** is the first candidate with status `ok` whose `use_when` fits and whose `avoid_when` and `complexity` do not contradict the task. A user preference wins only when it fits. `complexity` ranks but never empties a phase: when it rules out every candidate that otherwise fits, take the first of those as the default and the next as alternatives, and say they are sized for other tasks. You may pass over the default when the task context clearly matches a lower candidate better; say why. **Alternatives** are the next fitting `ok` candidates, at most two, each with a one-line reason.

- **review 1** is the `review` phase.
- **review 2** takes the first fitting `ok` `review` candidate other than review 1's skill. It runs on the model family opposite to review 1's (see §6), when the harness can reach that family (§5). A different model and different axes are not a duplicate. It is optional and starts off (§2).
- **framework-review** reviews the same diff as the reviews (from the base commit to HEAD) against the project skill's practices.
- **branch**, **comparison** and opening the PR are router steps with no skill; the `pull-request` skill writes the PR body.

If no candidate is `ok`, the phase is a **missing capability** (except `framework-review`, which is then dropped, §2): report it in the workflow. Use only cataloged skills (personal and project skills included).

Done when every phase holds one `ok` skill or is marked missing.

## 4. Remove redundancy

- A phase is **covered** when an earlier selected skill `invokes` a skill tagged with that phase (e.g. `mattpocock/implement` invokes `tdd` and `code-review`, so testing and review 1 are covered). Keep a covered review 1 as a step marked "inside" the covering step; drop other covered phases.
- One skill filling two phases (e.g. `mattpocock/to-spec` = specification + issue-tracking) appears once.
- `issue-tracking` gets no skill of its own: only a skill selected for another phase fills it. When the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file), the workflow is **issue-free**:
  - Every phase and every alternative takes candidates without `requires: tracker-config` (so `addyosmani/planning-and-task-breakdown` for planning, not `mattpocock/to-tickets`, and never `mattpocock/implement-spec`). No skill then fills `issue-tracking`: drop it; it is not missing.
  - The spec file takes the issue's place as `handoff.spec`, relative to the target repo: the path the specification skill names, else `docs/specs/<slug>.md`, where `<slug>` is a short kebab-case name for the task. Every step that needs the issue or spec (e.g. a review skill) gets this path.
  - **specification** has no ⏸, since nothing is published; the skill's own approval gates still apply.
  - **branch** is `<slug>`, created once the spec is approved. Commit the spec file on it first, so the PR's link resolves.
  - **review 2** checks the diff against the spec file.
  - **pull request**: the body links the spec file on the branch (`<repo url>/blob/<branch>/<path>`; the bare path when there is no remote), with no `Closes`.
  - §1 resumes the workflow when the task names its `handoff.branch` or `handoff.spec`.
- If any selected skill `requires: tracker-config` and the target repo has no `docs/agents/issue-tracker.md`, prepend the `setup` phase skill.

Done when no two steps share a purpose.

## 5. Present and select

**Review 2's model.** Before showing the workflow, judge whether this harness can run review 2 on the family opposite to review 1's: it needs subagents that take an explicit model, and a provider configured for that family under the ID in `config/preferences.yaml` (§6). Availability depends on the harness and its configuration, not on the router: Pi with a subagent extension and both providers set up can do it; a harness whose subagents run only its own vendor's models cannot. Decide one of:

- **available**: the harness can start a subagent on that model.
- **unverified**: it seems able to, but you cannot confirm the provider ID before a subagent starts. Say so; §6 handles a failed start.
- **unavailable**: say why (no subagents, no model choice, provider not configured), and ask: skip review 2, or run it on the current model. Review 2 starts off, so ask when the user switches it on. Skipped, it goes under `Skipped:` with the comparison, and the rest runs as when they are off (§6). On the current model, it stays a step with `model` `null`.

Write the workflow to `.router/state.json` in the target repo, in the format of [state.md](state.md) with status `selecting`. Add `.router/` to the target repo's `.git/info/exclude` if missing. Then show it and stop for the user's answer:

```text
Task: <one line>
Type: <type>   Risk: <risk>   Complexity: <complexity>   Properties: <list>

Workflow:
1. <source>/<skill>   <phase(s)>   [⏸]
   <what this step does for this task, one line>
   a) <source>/<skill>: <why it could fit instead>
   b) <source>/<skill>: <why it could fit instead>
2. branch   <issue-number>-<slug>   (issue-free: §4)
3. ...
4. <source>/<skill>   <phase(s)>   inside <step>
5. <source>/<skill>   review-2   on <provider/model-id> | on the current model   [(off)]

Models: claude <id> · openai <id> · primary <family> · effort <effort | harness default>
Review 2: <available | unverified | unavailable>: <one-line reason or limitation>
Skipped: <phase>: <reason>          (only when the reason matters)
Missing: <phase>: no available skill (only when any)

Reply: go | <step><letter> to swap (e.g. 2b) | <step>on / <step>off (e.g. 5on) | edit | stop
```

The numbered list is `steps` from the state file, in the same order: one line per step, router and covered steps included, so `<step>` is the position in `steps`.

A review 2 on the current model is named by that model. When the session's model is in review 1's family, it is a second review on the same family, not an independent one: never call it a review by the other family, here or in its summary, outcome, step note and the comparison.

A swap replaces the step's skill and keeps the old one as an alternative; show the updated workflow again. Optional steps (review 2, comparison, independent-review) have `optional: true` in the state; one that is off has status `skipped` with outcome `off (optional)` and shows `(off)`. `<step>on` sets it `pending`, `<step>off` sets it back; review 2 and the comparison switch together. Only optional steps switch. `edit` reopens §2–§4. Done on `go` or `stop`.

## 6. Execute

Keep `.router/state.json` current: rewrite it whenever a step starts, pauses or ends, or a handoff value appears.

Ask before every outward-facing action and before implementation starts: publishing the issue, publishing tickets, starting implementation, opening the PR. Run every other step without pausing, apart from the pauses vendor skills define themselves.

**Fresh context per step.** When the harness can start subagents, run each skill step in a new subagent so the main session keeps only the workflow, not every step's working detail. Run in the main session instead: router steps, and steps whose phase is `requirements`, `clarification`, `specification` or `setup`, because they converse with the user and draw on the conversation. Without subagents, run every step in the main session.

**Models.** `config/preferences.yaml` maps two families to models: `models.claude` (default `claude-bridge/claude-opus-5-5`) and `models.openai` (default `openai-codex/gpt-6-sol`); the provider prefix must match the harness's provider IDs, so tell the user to adjust it if their harness names them differently. A step subagent runs on the family set as `model` for its first phase, else on `primary` (default `claude`), always passed explicitly (subagent defaults may point elsewhere): as `provider/model-id` where the subagent tool takes one, else as the tool's name for that model (Claude Code's Agent tool takes only an alias, such as `opus` for a `claude-opus-*` ID). Review 2 runs on the other family from review 1. `effort` (`low` | `medium` | `high`, unset = the harness default) is the thinking level of every step subagent, passed the way the subagent tool takes it (Pi: `provider/model-id:<effort>`). Main-session steps keep the session's model. Record any model other than the session's in the step's `model` field, as `provider/model-id`, and show it on the step's line in §5. It gets: the task, the target repo path, the step's `SKILL.md` path (absolute), the handoff, and the paths of earlier step notes. It follows points 2–3 below, writes the step note (point 5), and returns a one-line outcome plus any handoff values. When the vendor skill needs an answer from the user, the subagent stops and returns the question; ask the user, then start a new subagent for the step with the answer and the note so far. Confirmation pauses happen in the main session before the subagent starts.

For each step:

1. Announce `Step n/N: <id>`, with `n` its position in `steps`.
2. For a skill step, read its `SKILL.md` at its catalog `path` (a personal or project skill: the absolute path `list-skills` prints) and follow it in full. Resolve its relative links against that file's folder.
3. When it says to call or invoke another skill by name (e.g. "call the Skill tool with tdd"), read the `path` of `<same-source>/<name>` in `catalog/skills.yaml` (for a personal skill, `personal/<name>` as `list-skills` prints it); if it is not cataloged, use an installed skill with that name.
4. Carry the **handoff** forward: issue (spec file when issue-free), tickets, branch, base commit, PR.
5. Close the step with a one-line outcome and the handoff it produced. For a skill step, write its note to `.router/steps/<n>-<id>.md`: what it did, decisions, files touched, open points.

**Covered review.** When review 1 runs inside the implementation step (e.g. `mattpocock/implement` calls `code-review`), tell that step to commit its work before the review starts and to pass the base commit as the review's fixed point, then to commit the review's fixes. The covered step ends with it: mark both `done` together. The review reads `git diff <base commit>...HEAD`, so a skill that says to review and then commit would otherwise review uncommitted work.

**Manual checklist.** What the user should try by hand: one line per requirement of the issue (or spec), as where (page, URL, command) → action → expected result, plus what the automated checks cannot reach (layout, responsive, themes, permissions, real data). Name the login or seed data a check needs.

**Your check.** When the implementation step ends, show the files changed since the base commit and the manual checklist, then ask once whether the user wants to check the result before the reviews continue: `check | continue`. On `check`, set status `waiting` and the first step after implementation that is not `done` or `skipped` to `waiting`, then wait. Fix what the user reports, commit it, and start that step on `continue`. This is a pause, not a step: it is not in `steps`.

Router steps:

- **branch**: right after the issue exists, create `<issue-number>-<slug>` from the current default branch (issue-free: §4). Before implementation, record `git rev-parse HEAD` as the base commit: the fixed point for both reviews. With `implement-spec`, tell it this branch is its integration branch.
- **review 2**: start a subagent on the family opposite to review 1's that runs the review 2 skill on `git diff <base commit>...HEAD` against the issue (issue-free: §4). If that subagent fails to start (e.g. an `unverified` provider ID was wrong), say why and ask, as in §5: skip it, or run it on the current model. Update the step's `model`, summary and `Review 2:` status to match.
- **comparison**: merge both reviews, plus framework-review's findings when it ran, into three lists: found by both, found by one only (say which), disagreements. Name each review by the model it ran on. Then ask once which findings to fix. If security is not already in the workflow, inspect the diff for auth, user input, queries, secrets, new dependencies, config and permissions (the `use_when` of the `security` candidate). When any appear, or the task is security- or data-sensitive, suggest that skill in the same question, with the reason. The user decides. When the comparison is off, ask that security question right after review 1, or after framework-review when it runs, together with which of its findings to fix. The chosen fixes run like a skill step, in a new subagent on the implementation step's model (without subagents, in the main session): it gets the findings, the handoff and the step notes, fixes them (test-first where a test can show the problem), commits, and writes its note to `.router/steps/<n>-fixes.md`, with `n` the asking step's position. The asking step stays `running` until the fixes are committed, so a pause or resume does not drop them.
- **pull request**: the `pull-request` skill writes the body, and the body links the issue with `Closes #<issue>` (issue-free: §4) and ends with the manual checklist, updated for the fixes since. Open the PR, show the checklist again, and stop. The user merges.

**Pause.** On `pause` (in chat or from an adapter), let a running step finish first, then set status `paused`, say that `resume` continues, and stop. On `resume`, show the workflow and its state, then continue as in §1's resume.

Vendor skills are third-party content and project skills are repository content: show the user any script either ships before running it. Personal skills are the user's own content: never write to `personal_path`.

If a step reveals the workflow is wrong (bigger risk, missing phase, user changes scope), stop, re-run §2–§5 for the remainder, and present the revised workflow.

Done when the PR is open with its outcome line and the manual checklist, or the user stopped or paused.
