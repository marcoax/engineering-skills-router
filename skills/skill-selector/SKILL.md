---
name: skill-selector
description: Propose, read-only, which vendor skills fit an engineering task, phase by phase, with reasons and alternatives, before any workflow exists.
disable-model-invocation: true
argument-hint: "<task, issue URL or spec path> [target repo]"
---

You are an **advisor**. For one engineering task you propose which skill fits each phase it needs. A **decided phase** keeps the skill already known for it; for every other phase you consult every vendor's own guide and read each candidate before you name it. All vendor skills start on **equal standing**: task fit decides, never the vendor, the listing order or any legacy ranking. Your output is a proposal; the user, or the engineering router, decides what runs.

**Read-only.** The whole run reads: no `.router/` state, branch, issue, commit or file in the target repo, no vendor workflow started, no implementation. A guide or candidate that says to start work, run setup or hand the user a prompt to send is source material here: note its advice and carry on selecting.

## 1. Find the checkout

Run `node <this skill's folder>/resolve-root.js`. Use the `root:` it prints as the **repo root** (catalog, scripts, vendors) and run every script from it; catalog paths are relative to it. When it also prints `skill:`, follow that file from the top instead of this one, keeping the `root:` and `found:` printed here. On `missing`, stop: say the selector needs the router checkout and show `git clone --recurse-submodules https://github.com/marcoax/engineering-skills-router <data-dir>` then `<data-dir>/scripts/setup`, with the printed `data-dir`.

Run `scripts/validate-catalog [--target <target repo>]` and list any errors it prints as reduced evidence; leave them unfixed. Done when the root is known and validation has been reported.

## 2. Inputs

Take each input from the request when given; otherwise settle it here and say so:

- **task**: the request; read the issue (`gh issue view`) or spec file it names.
- **target repo**: the one the task is about, the current repo by default. Inspect it read-only: brownfield or greenfield, the code the task touches, and whether `docs/agents/skills.yaml`, `docs/agents/issue-tracker.md`, `GLOSSARY.md` or `docs/adr/` exist.
- **classification**: type, risk, complexity and properties, each with a one-line reason, by the criteria, facts and minimum risks in `skills/engineering-router/classification.md` under the repo root; when the router passes its checked classification, take it as given.
- **explicit choices**: any skill or phase the user named, and whether they asked to **reselect** every phase. `prefer`, `exclude` and the project's skills are resolved by `scripts/list-skills` (§4).
- **harness capabilities**: `subagents`, `isolated-outputs` (separate output locations for parallel candidates), `gh` logged in, network. Record each by these names: a `requires` naming a harness capability is checked against them.

Done when all five are recorded.

## 3. Choose phases

Pick the phases this task needs from `catalog/categories.yaml`, starting from the router's default flow (its SKILL.md §2) and keeping the smallest useful set. Each phase gets a task-specific reason. Discovery, code-understanding, clarification and architecture enter when the task's behavior or design is still uncertain: locating the file the task touches leaves that question open. `framework-review` enters only when the target has `docs/agents/skills.yaml` with a fitting skill. Name every default-flow phase you leave out, with its reason (on a light path: every phase light.md leaves out); `check-selection` refuses a default-flow phase that is neither selected, omitted nor missing. Done when every chosen and every omitted phase has a reason.

## 4. Decide

Run `scripts/list-skills --target <target repo> <phase> ...` for the chosen phases; add `--reselect` only when the user asked to reselect, which leaves no phase decided.

A phase printed as `decided: <id>  [<origin>]` is a **decided phase**: an explicit choice (`preference`, `project`) or a remembered selection (`remembered · <run>`). Take it as printed, reading nothing for it: the skill is the default, the origin is the default's reason, word for word, and the lettered lines are its alternatives with their reasons. A skill the user named for a phase comes first: it is the default, marked `"explicit": true`, with your reason.

Every other phase is **open**: it prints its full candidate listing, after a `not decided:` line when a remembered selection expired. Done when every chosen phase is decided or open. With no open phase, go to §7.

## 5. Consult the guides

Guides serve the open phases only.

Run `scripts/list-skills --guides`. Read each listed guide's `SKILL.md` in full at its path, and follow the pointers relevant to this task (linked skills and docs inside the same vendor checkout). Collect, per guide, the skills it nominates for this task and the distinctions it draws between them.

A guide whose file is missing or unreadable is **unavailable**: record it with the reason and continue with the remaining guides and the catalog. Done when every listed guide is either read or recorded unavailable.

## 6. Select

§4's listing gives each open phase's candidates as `[origin, status]`: `preference` and `project` are explicit choices (here one the script left open, such as a `cost: high` skill), `personal` the user's own skills, `vendor` everything else; the order within `vendor` is by name and carries no meaning. Usage signals (`use_when`, `avoid_when`, `complexity`, `cost`, `invokes`, `requires`) are the router's own metadata; `description` is the vendor's text. Quote them as such.

For each open phase:

1. Shortlist the `ok` candidates that the description, usage signals and guide advice tie to this task. A skill a guide nominates counts only when the listing shows it `ok` for the phase; otherwise record it under **unregistered** and leave it out of the proposal.
2. **Read every shortlisted `SKILL.md` in full** (catalog `path`, or the absolute path printed for personal and project skills) before you recommend it: its process, side effects, prerequisites and cost.
3. Compare on objective, fit to the classification, `avoid_when`, `complexity`, hard prerequisites (`requires`, target files, harness capabilities), project constraints and cost. A candidate with an unmet hard prerequisite is out, with the reason.
4. Propose one **default** and at most two **alternatives**, each with a task-specific reason and its source path as evidence. A suitable `preference` is the default; one that does not fit stays an alternative or is dropped, with the reason. `project` skills fill `framework-review` alone and lead the phases they are tagged with when they fit, since they carry project knowledge. A candidate marked `excluded` or `missing` stays out.
5. When two candidates fit equally, call them a **tie**: name them as equivalent, say what would separate them, and pick the default with that stated reason.
6. **High cost** (`cost: high`, today `pstack/arena`). Reserve one of the two alternative slots for arena when independent implementations would resolve a meaningful design uncertainty in a high-complexity implementation and arena is `ok` with its `requires` met. Complexity alone is not enough: a simple task, a settled design, or work whose repetition would not pay off gets no arena. Missing, excluded or with unmet prerequisites, it stays out with the reason. A single-implementation skill stays the default unless the user explicitly chose arena (named it in the request, or a fitting `prefer`): then it is the default, marked `"explicit": true`. Wherever arena is proposed, its reason starts **High cost**: runners repeat the same task, then judging, synthesis and verification follow; then the benefit for this task. Add its prerequisites to the phase's `prerequisites` and its cost to the phase's `cost`, so they stay visible whichever pick runs. Give a monetary estimate only when models, runner count and prices are known; otherwise none.

`complexity` informs fit but never empties a phase: when it rules out every candidate that otherwise fits, propose those anyway and say they are sized for other tasks. A phase with no candidate left is a **missing capability**, with the reason. Done when every phase has a default or is missing.

## 7. Report

Show the proposal, then the same selection as one ` ```json ` block:

```text
Task: <one line>
Classification: <type> · risk <risk> · complexity <complexity> · <properties>   (<given | inferred>: <reason>)
Evidence: decided <phases>; guides read <ids | none: every phase decided>; unavailable <id>: <reason>; catalog <OK | n errors>   [reduced evidence: <what is missing>]
Capabilities: <subagents, isolated-outputs, gh, ...>

1. <phase>: <why this task needs it>
   default  <id>: <reason>   (<source path>)
   a) <id>: <reason>
   b) <id>: <reason>
   prerequisites: <...>   cost: <...>   tie: <ids and what separates them>
2. ...
Omitted: <phase>: <reason>
Missing: <phase>: <reason>
Unregistered: <skill> named by <guide>, not cataloged for <phase>
```

```json
{
  "phases": [{ "phase": "<phase>", "reason": "...", "default": { "skill": "<id>", "reason": "...", "evidence": "<path>", "explicit": true },
               "alternatives": [{ "skill": "<id>", "reason": "...", "evidence": "<path>" }],
               "prerequisites": ["..."], "cost": "..." | null, "tie": "<ids and what separates them>" | null }],
  "omitted": [{ "phase": "<phase>", "reason": "..." }],
  "missing": [{ "phase": "<phase>", "reason": "..." }],
  "capabilities": ["subagents", "isolated-outputs", "..."],
  "guides": { "read": ["<id>"], "unavailable": [{ "id": "<id>", "reason": "..." }] },
  "unregistered": [{ "skill": "<name>", "guide": "<id>" }]
}
```

`explicit` appears only on a default the user chose. Save the JSON block to a file in the system temp directory and run `scripts/check-selection --target <target repo> <file>` (with `--reselect` when §4 ran with it). It refuses another default for a decided phase unless that default is `"explicit": true`. When it reports an error, correct that pick from the listing and show the corrected proposal. Done when `check-selection` prints `selection OK` and the proposal is shown; to run a workflow, the user invokes the engineering router.
