---
name: engineering-router
description: Route an engineering task to the smallest workflow of vendor skills (pstack, Matt Pocock, Addy Osmani), show it, then run it step by step.
disable-model-invocation: true
argument-hint: "<task description, issue URL, or spec; omit to resume>"
---

You compose the **smallest useful workflow** for one non-trivial engineering task by picking one vendor skill per required phase. The question is never "which collection is best" but "which skill fits this step of this task".

This file holds what every run needs. The rest is in files beside it, read only when the run reaches them; read each one in full at that moment, not before:

| Read | When |
|---|---|
| [checkout.md](checkout.md) | the resolver prints `missing`, or the update check is due (§0) |
| [resume.md](resume.md) | the target repo holds an unfinished workflow (§1), or on `pause` / `resume` |
| [light.md](light.md) | §1 offers or sets the light path |
| [issue-free.md](issue-free.md) | §4 finds the workflow issue-free |
| [review-2.md](review-2.md) | the workflow has a review 2 step: before showing it (§5) and when it runs (§6) |
| [after-implementation.md](after-implementation.md) | the implementation step is about to start (§6) |
| [state-brief.md](state-brief.md) | writing `.router/state.json` the first time (§5) |

**Repo root** is the router checkout (catalog, scripts, vendors) this skill works from. Find it before anything else with `node <this skill's folder>/resolve-root.js`, and use the `root:` it prints. When it prints `missing` instead, follow [checkout.md](checkout.md).

When the resolver also prints `skill:`, this file is a copy installed apart from the checkout (e.g. by `npx skills add`), and it may be older or newer than the checkout. Stop reading this file: read the printed `skill:` file and follow it from the top instead, resolving its links (such as `state.md`) against its own folder. In that file, finding the root and this hand-over are already done: do not run its resolver, and keep the `root:` and `found:` printed here. Otherwise continue here.

Tell the user the root in use and how it was found (`found:`). With `found: pi` the checkout belongs to Pi: keep it read-only and skip §0 (`pi update git:github.com/marcoax/engineering-skills-router` updates it). All paths below, and every `path` in the catalog, are relative to the root; `list-skills` prints personal and project skills' paths absolute (§3). Run scripts from the root. Always read vendor skills from `vendors/` at the catalog `path`, never from copies installed for the agent. The one exception is personal skills, read in place where `list-skills` points. The **target repo** is the one the task is about.

Then run `scripts/validate-catalog`. When it prints errors, show them with the file they point at (`config/preferences.yaml` is at the root) and ask: fix them now, or continue with the defaults for the settings in error. Done when it passes or the user chose.

## 0. Check for updates

Read `update_check_days` from `config/preferences.yaml` (default 14; `0` means never ask) and the date in `config/.last-update-check` (missing file = never checked). If the setting is not 0 and that many days have passed, the check is due: follow [checkout.md](checkout.md). Done when it is not due, or checkout.md's check is done.

## 1. Classify

First look for an unfinished workflow: `.router/state.json` in the target repo with status `running`, `waiting`, `paused` or `stopped`. If there is one, follow [resume.md](resume.md) before anything else.

Read the task (fetch it first if it is an issue URL or number). Record, each with a one-line reason:

- **type**: bug | feature | refactor | architecture | performance | security | documentation | investigation | prototype | review | maintenance
- **risk**: low | medium | high
- **complexity**: low | medium | high, the task's size, matched against each skill's catalog `complexity` (§3)
- **properties** that apply: greenfield, brownfield, production-critical, user-facing, security-sensitive, data-sensitive, multi-session
- **path**: `light` or `full`. **light** fits a task given as an issue or spec that already settles what to build, at risk `low`, or `medium` with complexity `low`: one implementer and an independent review ([light.md](light.md)). **full** is everything else, and any task the user asks to run in full.

Inspect the target repo enough to judge brownfield vs greenfield, to locate the code the task touches (files or components the task names, or a quick search), and whether `docs/agents/issue-tracker.md`, `docs/agents/skills.yaml` (the project's own skills), `GLOSSARY.md` or `docs/adr/` exist.

**Low risk**: stop here. Say the task is low risk and offer: do it directly, without a workflow (no vendor skills, no issue); the **light** path, when the task is a ticket; or the full workflow, which runs as at medium risk with risk kept `low`. For a medium-risk ticket of low complexity, propose **light** and say how to ask for `full`. On a light path, follow [light.md](light.md) for §2.

Done when type, risk, complexity, properties and path are set, each with its reason.

## 2. Choose phases

Start from the **default flow** (`⏸` = confirmation point, `[ ]` = conditional):

```text
requirements → specification + issue ⏸ → [planning ⏸] → branch → ⏸ implementation → [⏸ your check]
→ review 1 → [review 2] → [framework-review] → [comparison] → [security] → [independent-review] → [verification] → pull request ⏸ → stop
```

- **requirements** by default, after debugging or code-understanding when those are in the flow, so its questions build on what the code shows. Skip it only when the task is an issue or spec that already settles the decisions; say why. A short exchange in chat before the workflow does not count as settled.
- **specification + issue**: skip when the task is already an issue; it becomes the handoff issue. Otherwise the issue exists only when the selected specification skill publishes one (§4).
- **planning** (tickets) only when the spec splits into more than one ticket.
- **One review by default**, at every risk. **review 2** and **comparison** are optional: both stay in the workflow but start off, and the user switches them on in §5.
- **security** is decided after the reviews (after-implementation.md).
- **framework-review** (the project's own best practices) only when the target repo has `docs/agents/skills.yaml` and §3 finds a fitting candidate in it. It runs after review 2, or after review 1 when review 2 is skipped. Without one it is dropped, not missing.
- **independent-review** for high risk only, optional: it starts off, like review 2.
- **verification**, optional at every risk, starts off: a router step (`skill` `null`) in which a fresh agent works through the manual checklist's `[agent]` points.
- **release** only when the user asked to ship.

By type, replace or prepend the front of the flow. The part from branch to pull request stays the same:

| Situation | Change |
|---|---|
| bug, cause unknown | debugging before specification; the spec records cause and fix |
| brownfield, and the §1 inspection could not locate the code the task touches | prepend code-understanding; when it could, implementation explores on its own |
| refactor | code-understanding before specification; implementation via refactoring or architecture |
| multi-session (more than one session can hold, route still foggy) | multi-session only; implementation happens in later sessions from its output |

Task correctness decides the phases; preferences never add or remove one, they only rank skills. `issue-tracking` is dropped only as an outcome of selection, when no selected skill fills it (§4). Done when every chosen phase has a reason and every default phase you dropped has a reason.

## 3. Select skills

Run `scripts/list-skills --target <target repo> <phase> ...` for the chosen phases. It prints ranked candidates (user preference → project → preferred → fallback → other), each with a status and its `use_when` / `avoid_when` / `complexity` / `invokes` / `requires`. **Project** candidates, `project/<name>`, are the target repo's own skills from `docs/agents/skills.yaml`; they are the only candidates for `framework-review`, and in any other phase they are tagged with they rank right after a user preference, since they know the project. **Personal** candidates, `personal/<name>`, are the user's own skills from `config/personal-skills.yaml`; they fill any other phase, ranked by a user preference or as `other`.

For each phase, the **default** is the first candidate with status `ok` whose `use_when` fits and whose `avoid_when` and `complexity` do not contradict the task. A user preference wins only when it fits. `complexity` ranks but never empties a phase: when it rules out every candidate that otherwise fits, take the first of those as the default and the next as alternatives, and say they are sized for other tasks. You may pass over the default when the task context clearly matches a lower candidate better; say why. **Alternatives** are the next fitting `ok` candidates, at most two, each with a one-line reason.

- **review 1** is the `review` phase.
- **review 2** takes the first fitting `ok` `review` candidate other than review 1's skill ([review-2.md](review-2.md)).
- **framework-review** reviews the same diff as the reviews (from the base commit to HEAD) against the project skill's practices.
- **branch**, **comparison** and opening the PR are router steps with no skill; the `pull-request` skill writes the PR body.

If no candidate is `ok`, the phase is a **missing capability** (except `framework-review`, which is then dropped, §2): report it in the workflow. Use only cataloged skills (personal and project skills included).

Done when every phase holds one `ok` skill or is marked missing.

## 4. Remove redundancy

- A phase is **covered** when an earlier selected skill `invokes` a skill tagged with that phase (e.g. `mattpocock/implement` invokes `tdd` and `code-review`, so testing and review 1 are covered). Keep a covered review 1 as a step marked "inside" the covering step; drop other covered phases. On a light path review 1 is never covered.
- One skill filling two phases (e.g. `mattpocock/to-spec` = specification + issue-tracking) appears once.
- `issue-tracking` gets no skill of its own: only a skill selected for another phase fills it. When the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file), the workflow is **issue-free**: follow [issue-free.md](issue-free.md) for every step from here on.
- If any selected skill `requires: tracker-config` and the target repo has no `docs/agents/issue-tracker.md`, prepend the `setup` phase skill.

Done when no two steps share a purpose.

## 5. Present and select

When the workflow has a review 2 step, follow [review-2.md](review-2.md) first, to decide whether it can run on the other model family.

Write the workflow to `.router/state.json` in the target repo, as in [state-brief.md](state-brief.md) with status `selecting`, and run `scripts/check-state <target repo>` until it passes. This is the only time you write the file by hand: every later change goes through `scripts/state` (§6). Add `.router/` to the target repo's `.git/info/exclude` if missing. Then show it and stop for the user's answer:

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

Reply: go | <step><letter> to swap (e.g. 2b) | <step>on / <step>off (e.g. 5on) | edit | full (light path) | stop
```

The numbered list is `steps` from the state file, in the same order: one line per step, router and covered steps included, so `<step>` is the position in `steps`.

Apply every reply with `scripts/state <target repo> reply <reply>`: it swaps (the old skill becomes the alternative), switches optional steps (review 2 and the comparison together; an optional step that is off shows `(off)`; `<step>on` also works later, until the step starts), and starts or stops the workflow. After a swap or switch, show the workflow again. It exits 2 on `edit`, and on `full` for a light path: recompose §2–§4 (set `path` to `full` for `full`) and write the state again as above. Done on `go` or `stop`.

## 6. Execute

Keep `.router/state.json` current with `scripts/state <target repo>`, never by hand: `step <n> running` when a step starts, `step <n> waiting` when it waits for the user, `step <n> done --outcome "..."` (or `skipped` / `failed`, with an outcome) when it ends, adding `--model` / `--effort` when it ran on another model or effort, and `handoff <field> <value>` when a handoff value appears. The script carries covered steps with their covering step, sets the workflow's status from its steps, validates, and refuses an invalid change with the reason. `scripts/state <target repo> show` prints the workflow. On `pause` or `resume`, follow [resume.md](resume.md).

Ask before every outward-facing action and before implementation starts: publishing the issue, publishing tickets, starting implementation, opening the PR. Run every other step without pausing, apart from the pauses vendor skills define themselves.

**Fresh context per step.** When the harness can start subagents, run each skill step in a new subagent so the main session keeps only the workflow, not every step's working detail. Run in the main session instead: router steps, and steps whose phase is `requirements`, `clarification`, `specification` or `setup`, because they converse with the user and draw on the conversation. Without subagents, run every step in the main session.

A step subagent gets: the task, the target repo path, the step's `SKILL.md` path (absolute), the handoff, and the paths of earlier step notes. It follows points 2–3 below, writes the step note (point 5), and returns a one-line outcome plus any handoff values. When the vendor skill needs an answer from the user, the subagent stops and returns the question; ask the user, then start a new subagent for the step with the answer and the note so far. Confirmation pauses happen in the main session before the subagent starts.

**Models.** `config/preferences.yaml` maps two families to models: `models.claude` (default `claude-bridge/claude-opus-5-5`) and `models.openai` (default `openai-codex/gpt-6-sol`); the provider prefix must match the harness's provider IDs, so tell the user to adjust it if their harness names them differently. A step subagent runs on the family set as `model` for its first phase, else on `primary` (default `claude`), always passed explicitly (subagent defaults may point elsewhere): as `provider/model-id` where the subagent tool takes one, else as the tool's name for that model (Claude Code's Agent tool takes only an alias, such as `opus` for a `claude-opus-*` ID). `effort` (`low` | `medium` | `high`, unset = the harness default) is the thinking level of every step subagent, passed the way the subagent tool takes it (Pi: `provider/model-id:<effort>`). Main-session steps keep the session's model. Record any model other than the session's in the step's `model` field, as `provider/model-id`, and show it on the step's line in §5. **A step's family is the one it actually runs on.** A harness whose subagents run only its own vendor's models (Claude Code: only Claude) runs every step on that family, whatever `primary` or a phase's `model` says: say so once in the workflow (`primary openai, not reachable here: steps run on claude`), and record those steps with `model` `null`. Review 2's family: [review-2.md](review-2.md).

For each step:

1. Announce `Step n/N: <id>`, with `n` its position in `steps`.
2. For a skill step, read its `SKILL.md` at its catalog `path` (a personal or project skill: the absolute path `list-skills` prints) and follow it in full. Resolve its relative links against that file's folder.
3. When it says to call or invoke another skill by name (e.g. "call the Skill tool with tdd"), read the `path` of `<same-source>/<name>` in `catalog/skills.yaml` (for a personal skill, `personal/<name>` as `list-skills` prints it); if it is not cataloged, use an installed skill with that name.
4. Carry the **handoff** forward: issue (spec file when issue-free), tickets, branch, base commit, PR.
5. Close the step with a one-line outcome and the handoff it produced. For a skill step, write its note to `.router/steps/<n>-<id>.md`: what it did, decisions, files touched, open points.

**branch** (router step): right after the issue exists, create `<issue-number>-<slug>` from the current default branch (issue-free: [issue-free.md](issue-free.md)) and record it with `handoff branch <name>`. Before implementation, record the base commit with `handoff base HEAD`: the fixed point for every review. With `implement-spec`, tell it this branch is its integration branch.

**From implementation on**, follow [after-implementation.md](after-implementation.md): the covered review, the manual checklist, your check, comparison, security and fixes, verification and the pull request. Review 2 runs as in [review-2.md](review-2.md).

Vendor skills are third-party content and project skills are repository content: show the user any script either ships before running it. Personal skills are the user's own content: never write to `personal_path`.

If a step reveals the workflow is wrong (bigger risk, missing phase, user changes scope), stop, re-run §2–§5 for the remainder, and present the revised workflow.

Done when the PR is open with its outcome line and the manual checklist, or the user stopped or paused.
