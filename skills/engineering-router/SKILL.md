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
| [checkout.md](checkout.md) | the resolver prints `missing`, or the user asks for the vendor update check (§0) |
| [autonomy.md](autonomy.md) | before presenting the workflow (§5), throughout execution (§6), and on resume |
| [context.md](context.md) | a step-close command prints a `context:` or `config:` line (§6), before starting the next step |
| [resume.md](resume.md) | the target repo holds an unfinished workflow (§1), or on `pause` / `resume` |
| [classification.md](classification.md) | classifying the task (§1) |
| [light.md](light.md) | §1 offers or sets the light path |
| [issue-free.md](issue-free.md) | the task is a spec file (§2), or §4 finds the workflow issue-free |
| [models.md](models.md) | before showing the workflow (§5): the primary question, which model each step runs on, and how §6 records it |
| [cross-family-review.md](cross-family-review.md) | before showing the workflow (§5), and when a review step runs (§6) |
| [state-brief.md](state-brief.md) | composing `.router/state.json` (§5) |
| [after-implementation.md](after-implementation.md) | the implementation step is about to start (§6) |
| [step-result.md](step-result.md) | a skill step is about to start in a subagent (§6) |

**Repo root** is the router checkout (catalog, scripts, vendors) this skill works from. Find it first with `node <this skill's folder>/resolve-root.js` and use the `root:` it prints; on `missing`, follow [checkout.md](checkout.md).

When it also prints `skill:`, this file is a copy installed apart from the checkout, possibly older or newer. Stop here: follow the printed `skill:` file from the top, resolving its links against its own folder. Root finding and this hand-over are done there: skip its resolver and keep the `root:` and `found:` printed here.

Tell the user the root in use and how it was found (`found:`). With `found: pi` the checkout belongs to Pi: keep it read-only and skip §0 (`pi update git:github.com/marcoax/engineering-skills-router` updates it). Run scripts from the root; every path below and every catalog `path` is relative to it, while `list-skills` prints personal and project skills' paths absolute (§3). Read vendor skills from `vendors/` at their catalog `path` and personal skills in place, where `list-skills` points, rather than from copies installed for the agent. The **target repo** is the one the task is about.

Run `scripts/config` and tell the user the configuration source it prints (`source:`) and, when it is `clone-local` and `found: pi`, that a package update removes that configuration and `scripts/config migrate` shows how to move it out ([docs/configuration.md](../../docs/configuration.md)); move nothing unless the user asks. Every user setting below (`preferences.yaml`, `personal-skills.yaml`) is read from the directory it prints.

Then run `scripts/validate-catalog`. When it prints errors, show them with the file they point at and ask: fix them now, or continue with the defaults for the settings in error. Done when it passes or the user chose.

## 0. Update check

`scripts/config` printed an `update-check:` line. When it says `due`, the run goes on to §1 without asking: the check is maintenance, not part of the task. Carry it as one `Updates:` line in the workflow (§5); when the run ends before a workflow is shown (the task is done directly, or the user stops), tell the user that line then. When the user asks for the check, follow [checkout.md](checkout.md) between steps, never inside a running one. Done when the due note is carried, or the line says `not due` or `off`.

## 1. Classify

First look for an unfinished workflow: `.router/state.json` in the target repo with status `running`, `waiting`, `paused` or `stopped`. Look before asking which task to run when the invocation names none. If there is one, follow [resume.md](resume.md) before anything else: it checks which session owns the workflow (`scripts/state <target repo> owner`) and asks for an explicit handover when another one does; a resumed workflow keeps its skills, and the selector runs again only when the user asks to recompose.

Read the task (fetch it first if it is an issue URL or number; read the file if it is a path to a spec in the target repo). Inspect the target repo enough to judge brownfield vs greenfield, to locate the code the task touches (files or components the task names, or a quick search), and whether `docs/agents/issue-tracker.md`, `docs/agents/skills.yaml` (the project's own skills), `GLOSSARY.md` or `docs/adr/` exist.

Read [classification.md](classification.md) and classify by its criteria, from the task and what the inspection showed: **type**, **risk** (at least the minimum its evidenced facts set), **complexity** (the task's size, later matched against each skill's catalog `complexity`, never a stand-in for risk) and **properties**, each class with a one-line reason.

Write it as classification.md's classification file, with the workflow the user asked for (`requested`) when they named one, and run `scripts/check-classification <file>`. On errors, correct the classification when the evidence supports it; otherwise tell the user the conflict with its evidence and offer only what the check allows. Never offer a path it does not print.

Tell the user the classes with their reasons and any `uncertain:` lines, then follow the `offer:` it prints; a routine classification needs no approval of its own:

- `direct` in the offer: recommend it when `propose: direct` prints, with the checked risk and reason. Direct means work in the current session under the project's rules, without skill selection, a new issue, workflow state or run record; create a branch and PR within the user's authorized delivery scope. Keep required checks and enabled hooks; behavior or shared-contract changes get one proportionate fresh review. Offer **light**, when listed, or **full** when orchestration, multiple stages or resumable handoffs are useful. Honor an existing direct-work choice; otherwise wait for the user's choice before selecting skills or writing state. A low-risk full workflow runs as at medium risk, with risk kept `low`.
- `full` alone: take **full**.

A path the user already named and the check accepted is taken without asking. Set **path** to the chosen `light` or `full` and keep it in the classification file. On a light path, follow [light.md](light.md) for §2.

Done when the check passes with the chosen path, and type, risk, complexity, properties and path are set, each with its reason.

## 2. Workflow contract

The selector (§3) chooses the phases and skills; this section is the workflow it chooses within, and §4–§6 compose and run it. Start from the **default flow** (`[ ]` = conditional). Approval in §5 authorizes execution through the PR:

```text
requirements → specification + issue → [planning] → branch → implementation
→ review → [framework-review] → [security] → [independent-review] → [verification] → pull request → stop
```

- **requirements** when material decisions remain unresolved, after debugging or code-understanding when those are in the flow, so its questions build on what the code shows. Skip it when the issue, spec or conversation already settles the objective and boundaries; say why. Ask only about gaps that affect the result, using [autonomy.md](autonomy.md) for routine technical choices.
- **specification + issue**: skip when the task is already an issue; it becomes the handoff issue. Skip it too when the task is an existing spec file: the file becomes `handoff.spec` and the workflow is issue-free ([issue-free.md](issue-free.md)). Otherwise the issue exists only when the selected specification skill publishes one (§4).
- **planning** (tickets) runs only when the spec splits into more than one ticket, judged on the spec itself. When the task is already an issue or spec, judge it now: keep planning, or drop it with the reason. When the spec is still to be written, keep planning as a conditional step (`[planning]`) whenever the task could split; the decision is made when the specification step closes (§6).
- **One review**, at every risk: a cross-family review, on the family opposite to the one that wrote the code ([cross-family-review.md](cross-family-review.md)). It is never covered by the implementation step. Every other review step (framework-review, security, independent-review) runs on that family too.
- **Optional steps** stay in the workflow but start off, and the user switches them on in §5: independent-review (high risk only), and verification (a router step, `skill` `null`, in which a fresh agent works through the manual checklist's `[agent]` points).
- **framework-review** (the project's own best practices) only when the target repo has `docs/agents/skills.yaml` and §3 finds a fitting candidate in it; otherwise it is dropped, not missing. It runs after the review.
- **security** stays as a conditional step with its candidate selected in §3. After the reviews, run or skip it from the task and actual diff ([after-implementation.md](after-implementation.md)); this condition is part of the workflow approval.
- **release** only when the user asked to ship.

By type, replace or prepend the front of the flow. The part from branch to pull request stays the same:

| Situation | Change |
|---|---|
| bug, cause unknown | debugging before specification; the spec records cause and fix |
| brownfield, and the §1 inspection could not locate the code the task touches | prepend code-understanding; when it could, implementation explores on its own |
| refactor | code-understanding before specification; implementation via refactoring or architecture |
| multi-session (more than one session can hold, route still foggy) | multi-session only; implementation happens in later sessions from its output |

Task correctness decides the phases; a preference only chooses among skills that fit. `issue-tracking` is dropped only as an outcome of selection, when no selected skill fills it (§4). Done when §3's proposal gives every chosen phase a reason and every default phase it dropped a reason.

## 3. Select skills

Selection policy lives in the skill selector alone: which phases the task needs, which skill fits each, which alternatives to offer, user preferences, project skills, `complexity`, arena and its cost. Read `skills/skill-selector/SKILL.md` under the repo root in full and follow its §2–§6, skipping its §1: the root is the one found above. Give it what §1 settled (task, target repo, classification, path, the inspection) instead of settling those again, plus the harness capabilities. On a light path it chooses skills for [light.md](light.md)'s phases only.

Its proposal gives each phase a default, at most two alternatives and their reasons, cost notes (arena's **High cost** included) and missing capabilities; `scripts/check-selection --target <target repo>` has passed on it. Carry each default into its step's `skill`, the alternatives with their reasons into `alternatives`, and its `prerequisites`, `cost` and `tie` into the step's fields of the same name, unchanged, so the user sees them in §5.

- **review** is the `review` phase.
- **framework-review** reviews the same diff as the reviews (from the base commit to HEAD) against the project skill's practices.
- **branch** and opening the PR are router steps with no skill; the `pull-request` skill writes the PR body.

A phase the selector reports missing is a **missing capability** (`framework-review` is dropped instead, §2): report it in the workflow. Use only skills the proposal names; never add an unregistered one.

Done when every phase holds the selector's default or is marked missing.

## 4. Remove redundancy

- A phase is **covered** when an earlier selected skill `invokes` a skill tagged with that phase (e.g. `mattpocock/implement` invokes `tdd`, so testing is covered). Keep every covered phase the workflow needs as a step, written with the selector's pick, rather than dropping it: `compose` marks it "inside" the covering step (`covered_by`) with the invoked skill and keeps the pick aside. When a swap picks a skill that does not run it, the step runs on its own with the selector's pick again; tests the old skill ran inside with no step of their own come back as a step. A review is never covered: when the implementation skill runs one inside (`mattpocock/implement` invokes `code-review`), the review keeps its own step, and the implementation step is told to skip that internal review (after-implementation.md). `scripts/state … compose` recalculates coverage from the catalog and says what it changed.
- One skill filling two phases (e.g. `mattpocock/to-spec` = specification + issue-tracking) appears once.
- `issue-tracking` gets no skill of its own: only a skill selected for another phase fills it. When the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file), the workflow is **issue-free**: follow [issue-free.md](issue-free.md) for every step from here on.
- If any selected skill `requires: tracker-config` and the target repo has no `docs/agents/issue-tracker.md`, prepend the `setup` phase skill.

Done when no two steps share a purpose.

## 5. Present and select

Read [autonomy.md](autonomy.md) for the approval's scope and exceptional stops, [models.md](models.md), and [cross-family-review.md](cross-family-review.md), to settle each step's model and whether the reviews can run on the other family.

Write the composed workflow to a file outside the target repo, as in [state-brief.md](state-brief.md), and run `scripts/state <target repo> compose --new <file>` until it passes: it refuses skills and alternatives that are unknown, guides, excluded, missing or not candidates for their step's phases (choose another from the proposal, or report the phase missing), recalculates coverage, and writes `.router/state.json` with status `selecting`. Every later change goes through `scripts/state` (§6). Add `.router/` to the target repo's `.git/info/exclude` if missing. Then, on a harness whose subagents can run both families, settle the run's primary family ([models.md](models.md#the-primary-question)): asked only when `preferences.yaml` names none. Then show the workflow and stop for the user's answer:

```text
Task: <one line>
Type: <type>   Risk: <risk>   Complexity: <complexity>   Path: <light | full>   Properties: <list>

Workflow:
1. <source>/<skill>   <phase(s)>   [⏸]
   <what this step does for this task, one line>
   a) <source>/<skill>: <why it could fit instead>
   b) <source>/<skill>: <why it could fit instead>
   needs: <prerequisites> · cost: <cost> · tie: <tie>   (only the ones the selector gave)
2. branch   <issue-number>-<slug>   (issue-free: <slug>)
3. ...
4. <source>/<skill>   <phase(s)>   inside <step>
5. <source>/<skill>   review   on <provider/model-id>   (cross-family | same-family: <reason>)

Models: claude <id> · openai <id> · primary <family> · effort <effort | harness default>
        (primary from preferences.yaml: the reply "primary <other family>" changes it)   (only when it was not asked)
Reviews: <available | unverified | unavailable>: <one-line reason or limitation>
Skipped: <phase>: <reason>          (only when the reason matters)
Missing: <phase>: no available skill (only when any)
Updates: vendor update check due (last checked <date | never>); say "check updates" after this run, or run scripts/update   (only when §0 found it due)
Execution: go authorizes this workflow through commit, push and the open PR; stops only for exceptions or checkpoints you request. Merge and deployment are separate.
Security: runs if the diff or task triggers the conditional check (after-implementation.md).

Reply: go | <step><letter> to swap (e.g. 2b) | <step>on / <step>off (e.g. 5on) | primary <family> (when not asked) | edit | full (light path) | stop
```

The numbered list is `steps` from the state file, in the same order: one line per step, router and covered steps included, so `<step>` is the position in `steps`. Show `⏸` only for an explicit user checkpoint. `primary` in the `Models:` line is the run's, from the state file ([models.md](models.md)).

Apply every reply with `scripts/state <target repo> reply <reply>`: it swaps (the old skill becomes the alternative) and recalculates coverage from the newly selected skill, printing a `coverage:` line for each step that now runs inside it or on its own; switches optional steps (an optional step that is off shows `(off)`; `<step>on` also works later, until the step starts), sets the run's primary family (`primary <family>`, before `go`), and starts or stops the workflow. After a swap, switch or primary change, show the workflow again. It exits 2 on `edit`, and on `full` for a light path: run the selector again (§3) and recompose §4 (set `path` to `full` for `full`), then write it with `scripts/state <target repo> compose <file>` (no `--new`): it keeps the run's `primary` and handoff, since the primary question belongs to the run's first write only. Done on `go` or `stop`.

## 6. Execute

Keep `.router/state.json` current with `scripts/state <target repo>`: `step <n> running` when a step starts, `step <n> waiting` when it waits for the user, `step <n> done --outcome "..."` (or `skipped` / `failed`, with an outcome) when it ends, with `--model` / `--effort` as in [models.md](models.md), and `handoff <field> <value>` when a handoff value appears. The script carries covered steps with their covering step, sets the workflow's status from its steps, validates, and refuses an invalid change with the reason. `scripts/state <target repo> show` prints the workflow. On `pause` or `resume`, follow [resume.md](resume.md).

Execute under [autonomy.md](autonomy.md): `go` authorizes the selected workflow through the open PR. Continue across step boundaries and resolve selected skills' routine gates from that authorization; pause only for its exceptional stops or an explicit user checkpoint.

**Fresh context per step.** When the harness can start subagents, run each skill step in a new subagent, on the model [models.md](models.md) gives it, so the main session keeps only the workflow, not every step's working detail. Run in the main session instead: router steps; conversational phases (`requirements`, `clarification`, `specification`, `setup`); and simple PR preparation as [after-implementation.md](after-implementation.md) defines. Without subagents, run every step in the main session.

Before it starts, declare the step's delivery with `scripts/state <target repo> expect <n>` ([step-result.md](step-result.md)). One step, one verifiable result: implementation, fixes and a review each get their own subagent, never one growing context. A step subagent's **brief** has these fields, each short:

- **Goal**: the task and what this step must produce for it.
- **Authorized scope**: the approved scope and execution policy from [autonomy.md](autonomy.md), the target repo path, the branch.
- **References**: the step's `SKILL.md` path (absolute), the handoff, the paths of earlier step notes and of the spec or issue.
- **Constraints**: the project's rules that apply (by path: its `AGENTS.md`, `CLAUDE.md`), what the step must not touch, and point 5's progress saving.
- **Evidence already available**: what earlier steps established, as paths and one-line facts (`recover`'s `reuse:` checks, the accepted findings, the commits since the base), so the step does not redo it.
- **Expected output**: the lines `expect` printed, and the one-line outcome plus handoff values it returns.

Give paths, never copies: the brief does not recopy this file, a skill's procedure, earlier notes or the whole workflow, since the subagent reads what it needs from the paths and the constraints stay where they are maintained. It follows points 2–3 below under that policy, records its checks and progress as it goes with `scripts/state <target repo> check` and `progress` (point 5, [ADR 0003](../../docs/adr/0003-progress-records.md)), writes the step note (point 5) and its step result, and returns a one-line outcome plus any handoff values. The step moves on only after `scripts/state <target repo> deliver <n>` accepts the result; its verdict decides what follows, never a phrase in the answer, and `step <n> done` is refused for a delegated step until then. A skill step that ran in the main session (no subagents) closes with `step <n> done --outcome "..." --main-session`. Handle unresolved questions as that policy's exceptions, using existing context before involving the user.

**Updates** to the user say which of these the workflow is in, with the current step (`Step n/N: <id>`) and what is left:

- **running**: a step is executing; say what it is doing, not that it is finished.
- **waiting for your decision**: a step is `waiting` on a question, blocker or checkpoint; say exactly what is needed.
- **recoverable error**: a step was interrupted (timeout, quota, unavailable model; `recover` shows it) and resumes from its record; say what stopped it and the retry it is on.
- **done**: the workflow reached its end (the open PR), or a step closed with an accepted delivery.

Ending a reply while a subagent or check still runs is neither a pause nor done: say it is still running. Only `pause` pauses the workflow ([resume.md](resume.md)).

**Panel checklist intents**, at any workflow status (including paused or done): forward `checklist <run> <id> on|off` unchanged with `scripts/state <target repo> reply "<intent>"` ([state.md, Checklist point](state.md#checklist-point)). Acknowledge only a successful write; report a refusal and leave the saved display alone. Retain the workflow's status and ownership.

**Nested subagents.** A vendor skill may start subagents of its own (e.g. `code-review` runs its two axes in parallel). Tell every step subagent: where it cannot start subagents itself, run those parts in sequence in its own context, each with fresh eyes: it reuses the inputs already read (the diff, the issue, the spec), never an earlier part's conclusions, and says so in the step note (`code-review: axes run in sequence, no nested subagents`). The step stays in its subagent even then: in the main session, an independent step (a review, verification) would have seen the implementation.

For each step:

1. Announce `Step n/N: <id>`, with `n` its position in `steps`.
2. For a skill step, read its `SKILL.md` at its catalog `path` (a personal or project skill: the absolute path `list-skills` prints) and follow its procedure under [autonomy.md](autonomy.md). Resolve its relative links against that file's folder.
3. When it says to call or invoke another skill by name (e.g. "call the Skill tool with tdd"), read the `path` of `<same-source>/<name>` in `catalog/skills.yaml` (for a personal skill, `personal/<name>` as `list-skills` prints it); if it is not cataloged, use an installed skill with that name.
4. Carry the **handoff** forward: issue (spec file when issue-free), tickets, branch, base commit, PR.
5. **Save progress as it is made**, not only at the end: whoever runs the step (its subagent included) records each check it ran with `scripts/state <target repo> check <n> pass|fail|interrupted --command "..." --env "..." --scope <paths>`, and after each commit or verified piece of work `progress <n> --done "..." --next "..." [--limits "..."]`, so a timeout or quota stop loses nothing ([resume.md](resume.md) **Interrupted step**). When the step's agent stops before it hands back, run `interrupt <n> --reason "..."` and recover as resume.md says, never from transcripts. Write the skill step's note to `.router/steps/<n>-<id>.md`: `step <n> running` starts it with the first line `run: <run>` (the run id); keep that line first and append below it what the step did, decisions, files touched, open points. A note written from scratch starts with that line too. Close the step with a one-line outcome and the handoff it produced. Run `scripts/state <target repo> step <n> done ...` as a separate shell command, with no batch or chained command, so its output is available before the next step starts. If that output includes a `context:` or `config:` line and a step remains, follow [context.md](context.md) now. Otherwise continue normally.

**Planning decision** (when the specification step closes and the workflow holds a conditional planning step): read the spec and judge whether it splits into more than one ticket: more than one independently demoable or verifiable slice, or more than one fresh context window of work. Tell the user the decision in one line with its reason, then either run planning, or `step <n> skipped --outcome "single ticket: <reason>"`. The user may overrule it before the next step starts. When planning is skipped, an implementation step whose skill builds from tickets (`mattpocock/implement-spec`) is swapped to its first alternative with `scripts/state <target repo> reply <n>a` before the step starts, and the user is told, with any `coverage:` lines it prints.

**branch** (router step): inspect existing task commits against the fetched remote default branch before creating a branch or recording the review base. For new work, create `<issue-number>-<slug>` from the default branch (issue-free: [issue-free.md](issue-free.md)), record `handoff branch <name>` and `handoff base HEAD` before implementation. For existing work, keep its branch or preserve local default-branch commits on a new branch; record the parent before the first task commit, never a HEAD that already contains the work. When the task is already published on the remote default branch, reconcile completed work from its commits, notes and PR instead of opening an empty PR or rerunning checks without evidence. A mixed or ambiguous commit range needs clarification before history changes. With `implement-spec`, this is its integration branch.

**From implementation on**, follow [after-implementation.md](after-implementation.md): the manual checklist, the reviews, security and fixes, verification and the pull request. Every review runs as in [cross-family-review.md](cross-family-review.md).

Vendor skills are third-party content and project skills are repository content: show the user any script either ships before running it. Personal skills are the user's own content, registered in the `personal-skills.yaml` of the configuration directory `scripts/config` printed: leave `personal_path` read-only.

If a step reveals a material unexpected workflow change (bigger risk, an unplanned required phase, user changes scope), stop, run the selector (§3) for the remaining work, recompose §4 and write it with `scripts/state <target repo> compose <file>`: completed steps, the run's `primary` and the handoff stay as they are. Present the revised workflow as in §5. Resolving the approved planning and security conditions is ordinary execution.

Done when the PR is open with its outcome line and the manual checklist, or the user stopped or paused.
