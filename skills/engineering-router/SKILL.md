---
name: engineering-router
description: Route an engineering task to the smallest workflow of vendor skills (pstack, Matt Pocock, Addy Osmani), show it, then run it step by step.
disable-model-invocation: true
argument-hint: "<task description, issue URL, or spec; omit to resume>"
---

You compose the **smallest useful workflow** for one non-trivial engineering task by picking one vendor skill per required phase. The question is never "which collection is best" but "which skill fits this step of this task".

This file holds what every run needs. The rest is in files beside it; read each one in full when the run reaches it, not before:

| Read | When |
|---|---|
| [checkout.md](checkout.md) | the resolver prints `missing`, or the update check is due (§0) |
| [autonomy.md](autonomy.md) | before presenting the workflow (§5), throughout execution (§6), and on resume |
| [context.md](context.md) | a step-close command prints a `context:` line (§6), before starting the next step |
| [resume.md](resume.md) | the target repo holds an unfinished workflow (§1), or on `pause` / `resume` |
| [light.md](light.md) | §1 offers or sets the light path |
| [issue-free.md](issue-free.md) | the task is a spec file (§2), or §4 finds the workflow issue-free |
| [models.md](models.md) | before showing the workflow (§5): the primary question, which model each step runs on, and how §6 records it |
| [review-2.md](review-2.md) | the workflow has a review 2 step: before showing it (§5) and when it runs (§6) |
| [state-brief.md](state-brief.md) | writing `.router/state.json` the first time (§5) |
| [after-implementation.md](after-implementation.md) | the implementation step is about to start (§6) |

**Repo root** is the router checkout (catalog, scripts, vendors) this skill works from. Find it first with `node <this skill's folder>/resolve-root.js` and use the `root:` it prints; on `missing`, follow [checkout.md](checkout.md).

When it also prints `skill:`, this file is a copy installed apart from the checkout, possibly older or newer. Stop here: follow the printed `skill:` file from the top, resolving its links against its own folder. Root finding and this hand-over are done there: skip its resolver and keep the `root:` and `found:` printed here.

Tell the user the root in use and how it was found (`found:`). With `found: pi` the checkout belongs to Pi: keep it read-only and skip §0 (`pi update git:github.com/marcoax/engineering-skills-router` updates it). Run scripts from the root; every path below and every catalog `path` is relative to it, while `list-skills` prints personal and project skills' paths absolute (§3). Read vendor skills from `vendors/` at their catalog `path` and personal skills in place, where `list-skills` points, rather than from copies installed for the agent. The **target repo** is the one the task is about.

Then run `scripts/validate-catalog`. When it prints errors, show them with the file they point at and ask: fix them now, or continue with the defaults for the settings in error. Done when it passes or the user chose.

## 0. Check for updates

Read `update_check_days` from `config/preferences.yaml` (default 14; `0` means never ask) and the date in `config/.last-update-check` (missing file = never checked). If the setting is not 0 and that many days have passed, the check is due: follow [checkout.md](checkout.md). Done when it is not due, or checkout.md's check is done.

## 1. Classify

First look for an unfinished workflow: `.router/state.json` in the target repo with status `running`, `waiting`, `paused` or `stopped`. If there is one, follow [resume.md](resume.md) before anything else.

Read the task (fetch it first if it is an issue URL or number; read the file if it is a path to a spec in the target repo). Record, each with a one-line reason:

- **type**: bug | feature | refactor | architecture | performance | security | documentation | investigation | prototype | review | maintenance
- **risk**: low | medium | high
- **complexity**: low | medium | high, the task's size, matched against each skill's catalog `complexity` (§3)
- **properties** that apply: greenfield, brownfield, production-critical, user-facing, security-sensitive, data-sensitive, multi-session
- **path**: `light` or `full`. **light** fits a task given as an issue or spec that already settles what to build, at risk `low`, or `medium` with complexity `low`: one implementer and an independent review ([light.md](light.md)). **full** is everything else, and any task the user asks to run in full.

Inspect the target repo enough to judge brownfield vs greenfield, to locate the code the task touches (files or components the task names, or a quick search), and whether `docs/agents/issue-tracker.md`, `docs/agents/skills.yaml` (the project's own skills), `GLOSSARY.md` or `docs/adr/` exist.

**Low risk**: stop here. Say the task is low risk and offer: do it directly, without a workflow (no vendor skills, no issue); the **light** path, when the task is a ticket; or the full workflow, which runs as at medium risk with risk kept `low`. For a medium-risk ticket of low complexity, propose **light** and say how to ask for `full`. On a light path, follow [light.md](light.md) for §2.

Done when type, risk, complexity, properties and path are set, each with its reason.

## 2. Choose phases

Start from the **default flow** (`[ ]` = conditional). Approval in §5 authorizes execution through the PR:

```text
requirements → specification + issue → [planning] → branch → implementation
→ review 1 → [review 2] → [framework-review] → [comparison] → [security] → [independent-review] → [verification] → pull request → stop
```

- **requirements** when material decisions remain unresolved, after debugging or code-understanding when those are in the flow, so its questions build on what the code shows. Skip it when the issue, spec or conversation already settles the objective and boundaries; say why. Ask only about gaps that affect the result, using [autonomy.md](autonomy.md) for routine technical choices.
- **specification + issue**: skip when the task is already an issue; it becomes the handoff issue. Skip it too when the task is an existing spec file: the file becomes `handoff.spec` and the workflow is issue-free ([issue-free.md](issue-free.md)). Otherwise the issue exists only when the selected specification skill publishes one (§4).
- **planning** (tickets) runs only when the spec splits into more than one ticket, judged on the spec itself. When the task is already an issue or spec, judge it now: keep planning, or drop it with the reason. When the spec is still to be written, keep planning as a conditional step (`[planning]`) whenever the task could split; the decision is made when the specification step closes (§6).
- **One review by default**, at every risk.
- **Optional steps** stay in the workflow but start off, and the user switches them on in §5: review 2 and comparison (together), independent-review (high risk only), and verification (a router step, `skill` `null`, in which a fresh agent works through the manual checklist's `[agent]` points).
- **framework-review** (the project's own best practices) only when the target repo has `docs/agents/skills.yaml` and §3 finds a fitting candidate in it; otherwise it is dropped, not missing. It runs after the last of review 1 and review 2.
- **security** stays as a conditional step with its candidate selected in §3. After the reviews, run or skip it from the task and actual diff ([after-implementation.md](after-implementation.md)); this condition is part of the workflow approval.
- **release** only when the user asked to ship.

By type, replace or prepend the front of the flow. The part from branch to pull request stays the same:

| Situation | Change |
|---|---|
| bug, cause unknown | debugging before specification; the spec records cause and fix |
| brownfield, and the §1 inspection could not locate the code the task touches | prepend code-understanding; when it could, implementation explores on its own |
| refactor | code-understanding before specification; implementation via refactoring or architecture |
| multi-session (more than one session can hold, route still foggy) | multi-session only; implementation happens in later sessions from its output |

Task correctness decides the phases; preferences only rank skills. `issue-tracking` is dropped only as an outcome of selection, when no selected skill fills it (§4). Done when every chosen phase has a reason and every default phase you dropped has a reason.

## 3. Select skills

Run `scripts/list-skills --target <target repo> <phase> ...` for the chosen phases. It prints ranked candidates (user preference → project → preferred → fallback → other), each with a status and its `use_when` / `avoid_when` / `complexity` / `invokes` / `requires`. **Project** candidates, `project/<name>`, are the target repo's own skills from `docs/agents/skills.yaml`; they are the only candidates for `framework-review`, and they fill any other phase they are tagged with, ranked right after a user preference, since they know the project. **Personal** candidates, `personal/<name>`, are the user's own skills from `config/personal-skills.yaml`; they fill any other phase, ranked by a user preference or as `other`.

For each phase, the **default** is the first candidate with status `ok` whose `use_when` fits and whose `avoid_when` and `complexity` do not contradict the task. A user preference wins only when it fits. `complexity` ranks but never empties a phase: when it rules out every candidate that otherwise fits, take the first of those as the default and the next as alternatives, and say they are sized for other tasks. You may pass over the default when the task context clearly matches a lower candidate better; say why. **Alternatives** are the next fitting `ok` candidates, at most two, each with a one-line reason.

**Competing implementations.** For a high-complexity implementation with meaningful competing solutions, reserve one of the two alternative slots for `pstack/arena` when it is `ok`, its usage signals fit, and the harness supports subagents with isolated candidate outputs. Keep a single-implementation skill as the default unless the user explicitly chooses arena. Whenever arena appears in the proposal, label its reason **High cost** and explain that agents build the same artifact independently, followed by judging, synthesis and verification, consuming substantially more tokens than a single implementation. State the task-specific benefit of comparing candidates; quote a monetary estimate only when models, runner count and prices are known.

- **review 1** is the `review` phase.
- **review 2** takes the first fitting `ok` `review` candidate other than review 1's skill ([review-2.md](review-2.md)).
- **framework-review** reviews the same diff as the reviews (from the base commit to HEAD) against the project skill's practices.
- **branch**, **comparison** and opening the PR are router steps with no skill; the `pull-request` skill writes the PR body.

If no candidate is `ok`, the phase is a **missing capability** (`framework-review` is dropped instead, §2): report it in the workflow. Use only cataloged skills, personal and project skills included.

Done when every phase holds one `ok` skill or is marked missing.

## 4. Remove redundancy

- A phase is **covered** when an earlier selected skill `invokes` a skill tagged with that phase (e.g. `mattpocock/implement` invokes `tdd` and `code-review`, so testing and review 1 are covered). Keep a covered review 1 as a step marked "inside" the covering step; drop other covered phases. On a light path review 1 is never covered.
- One skill filling two phases (e.g. `mattpocock/to-spec` = specification + issue-tracking) appears once.
- `issue-tracking` gets no skill of its own: only a skill selected for another phase fills it. When the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file), the workflow is **issue-free**: follow [issue-free.md](issue-free.md) for every step from here on.
- If any selected skill `requires: tracker-config` and the target repo has no `docs/agents/issue-tracker.md`, prepend the `setup` phase skill.

Done when no two steps share a purpose.

## 5. Present and select

Read [autonomy.md](autonomy.md) for the approval's scope and exceptional stops, [models.md](models.md), and [review-2.md](review-2.md) when the workflow has a review 2 step, to settle each step's model and whether review 2 can run on the other family.

Write the workflow to `.router/state.json` in the target repo, as in [state-brief.md](state-brief.md) with status `selecting`, and run `scripts/check-state <target repo>` until it passes. This is the only time you write the file by hand: every later change goes through `scripts/state` (§6). Add `.router/` to the target repo's `.git/info/exclude` if missing. Then, on a harness whose subagents can run both families, ask the primary question ([models.md](models.md#the-primary-question)). Then show the workflow and stop for the user's answer:

```text
Task: <one line>
Type: <type>   Risk: <risk>   Complexity: <complexity>   Path: <light | full>   Properties: <list>

Workflow:
1. <source>/<skill>   <phase(s)>   [⏸]
   <what this step does for this task, one line>
   a) <source>/<skill>: <why it could fit instead>
   b) <source>/<skill>: <why it could fit instead>
2. branch   <issue-number>-<slug>   (issue-free: <slug>)
3. ...
4. <source>/<skill>   <phase(s)>   inside <step>
5. <source>/<skill>   review-2   on <provider/model-id> | on the current model   [(off)]

Models: claude <id> · openai <id> · primary <family> · effort <effort | harness default>
Review 2: <available | unverified | unavailable>: <one-line reason or limitation>
Skipped: <phase>: <reason>          (only when the reason matters)
Missing: <phase>: no available skill (only when any)
Execution: go authorizes this workflow through commit, push and the open PR; stops only for exceptions or checkpoints you request. Merge and deployment are separate.
Security: runs if the diff or task triggers the conditional check (after-implementation.md).

Reply: go | <step><letter> to swap (e.g. 2b) | <step>on / <step>off (e.g. 5on) | edit | full (light path) | stop
```

The numbered list is `steps` from the state file, in the same order: one line per step, router and covered steps included, so `<step>` is the position in `steps`. Show `⏸` only for an explicit user checkpoint. `primary` in the `Models:` line is the run's, from the state file ([models.md](models.md)).

Apply every reply with `scripts/state <target repo> reply <reply>`: it swaps (the old skill becomes the alternative), switches optional steps (review 2 and the comparison together; an optional step that is off shows `(off)`; `<step>on` also works later, until the step starts), and starts or stops the workflow. After a swap or switch, show the workflow again. It exits 2 on `edit`, and on `full` for a light path: recompose §2–§4 (set `path` to `full` for `full`) and write the state again as above, keeping the run's `primary` as the script's message names it: the primary question belongs to the run's first write only. Done on `go` or `stop`.

## 6. Execute

Keep `.router/state.json` current with `scripts/state <target repo>`: `step <n> running` when a step starts, `step <n> waiting` when it waits for the user, `step <n> done --outcome "..."` (or `skipped` / `failed`, with an outcome) when it ends, with `--model` / `--effort` as in [models.md](models.md), and `handoff <field> <value>` when a handoff value appears. The script carries covered steps with their covering step, sets the workflow's status from its steps, validates, and refuses an invalid change with the reason. `scripts/state <target repo> show` prints the workflow. On `pause` or `resume`, follow [resume.md](resume.md).

Execute under [autonomy.md](autonomy.md): `go` authorizes the selected workflow through the open PR. Continue across step boundaries and resolve selected skills' routine gates from that authorization; pause only for its exceptional stops or an explicit user checkpoint.

**Fresh context per step.** When the harness can start subagents, run each skill step in a new subagent, on the model [models.md](models.md) gives it, so the main session keeps only the workflow, not every step's working detail. Run in the main session instead: router steps, and steps whose phase is `requirements`, `clarification`, `specification` or `setup`, because they converse with the user and draw on the conversation. Without subagents, run every step in the main session.

A step subagent gets: the task, the target repo path, the step's `SKILL.md` path (absolute), the handoff, the paths of earlier step notes, and the execution policy and approved scope from [autonomy.md](autonomy.md). It follows points 2–3 below under that policy, writes the step note (point 5), and returns a one-line outcome plus any handoff values. Handle unresolved questions as that policy's exceptions, using existing context before involving the user.

**Nested subagents.** A vendor skill may start subagents of its own (e.g. `code-review` runs its two axes in parallel). Tell every step subagent: where it cannot start subagents itself, run those parts in sequence in its own context, each with fresh eyes: it reuses the inputs already read (the diff, the issue, the spec), never an earlier part's conclusions, and says so in the step note (`code-review: axes run in sequence, no nested subagents`). The step stays in its subagent even then: in the main session, an independent step (review 1 on a light path, verification) would have seen the implementation.

For each step:

1. Announce `Step n/N: <id>`, with `n` its position in `steps`.
2. For a skill step, read its `SKILL.md` at its catalog `path` (a personal or project skill: the absolute path `list-skills` prints) and follow its procedure under [autonomy.md](autonomy.md). Resolve its relative links against that file's folder.
3. When it says to call or invoke another skill by name (e.g. "call the Skill tool with tdd"), read the `path` of `<same-source>/<name>` in `catalog/skills.yaml` (for a personal skill, `personal/<name>` as `list-skills` prints it); if it is not cataloged, use an installed skill with that name.
4. Carry the **handoff** forward: issue (spec file when issue-free), tickets, branch, base commit, PR.
5. Write the skill step's note to `.router/steps/<n>-<id>.md`: what it did, decisions, files touched, open points. Close the step with a one-line outcome and the handoff it produced. Run `scripts/state <target repo> step <n> done ...` as a separate shell command, with no batch or chained command, so its output is available before the next step starts. If that output includes a `context:` line and a step remains, follow [context.md](context.md) now. Otherwise continue normally.

**Planning decision** (when the specification step closes and the workflow holds a conditional planning step): read the spec and judge whether it splits into more than one ticket: more than one independently demoable or verifiable slice, or more than one fresh context window of work. Tell the user the decision in one line with its reason, then either run planning, or `step <n> skipped --outcome "single ticket: <reason>"`. The user may overrule it before the next step starts. When planning is skipped, an implementation step whose skill builds from tickets (`mattpocock/implement-spec`) is swapped to its first alternative, and the user is told.

**branch** (router step): right after the issue exists, create `<issue-number>-<slug>` from the current default branch (issue-free: [issue-free.md](issue-free.md)) and record it with `handoff branch <name>`. Before implementation, record the base commit with `handoff base HEAD`: the fixed point for every review. With `implement-spec`, tell it this branch is its integration branch.

**From implementation on**, follow [after-implementation.md](after-implementation.md): the covered review, the manual checklist, comparison, security and fixes, verification and the pull request. Review 2 runs as in [review-2.md](review-2.md).

Vendor skills are third-party content and project skills are repository content: show the user any script either ships before running it. Personal skills are the user's own content: leave `personal_path` read-only.

If a step reveals a material unexpected workflow change (bigger risk, an unplanned required phase, user changes scope), stop, re-run §2–§5 for the remainder, and present the revised workflow. Resolving the approved planning and security conditions is ordinary execution.

Done when the PR is open with its outcome line and the manual checklist, or the user stopped or paused.
