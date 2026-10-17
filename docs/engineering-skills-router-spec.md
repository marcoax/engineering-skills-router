# Engineering Skills Router — Project Specification

> **Historical document.** This is the original V1 specification plus the V2 decisions (§34). Section numbering is not unique (several numbers repeat) and parts are superseded. The source of truth for behavior is `skills/engineering-router/SKILL.md`; for the state format, `skills/engineering-router/state.md`; for open work, `docs/backlog.md`. Where this file disagrees with them, they win.

## 1. Overview

**engineering-skills-router** is a standalone repository that catalogs and routes AI coding skills from multiple public skill collections.

The initial supported sources are:

- pstack  
  https://github.com/backnotprop/pstack

- Matt Pocock Skills  
  https://github.com/mattpocock/skills

- Addy Osmani Agent Skills  
  https://github.com/addyosmani/agent-skills

The goal is not to choose one collection as the winner.

The goal is to analyze a software-engineering task and compose the **smallest useful workflow** by selecting the most appropriate skill for each phase.

---

## 2. Main Goal

Given a task, the router should:

1. classify the task;
2. estimate its complexity and risk;
3. determine which engineering phases are necessary;
4. select the most suitable available skill for each phase;
5. avoid redundant or overlapping skills;
6. build a minimal workflow;
7. verify that selected skills actually exist;
8. present the proposed workflow before execution;
9. optionally execute the workflow step by step.

Example:

```text
Task
  ↓
Classification
  ↓
Required phases
  ↓
Skill selection
  ↓
Minimal workflow
  ↓
Execution
```

---

## 3. Core Principle

The project must **not overwrite or modify user-installed skills**.

It must not automatically write into directories such as:

```text
~/.agents/skills
~/.claude/skills
~/.codex/
~/.cursor/
```

or equivalent user-level agent configuration directories.

External skill collections remain isolated inside this repository.

---

## 4. Repository Name

```text
engineering-skills-router
```

Main router skill:

```text
engineering-router
```

The repository name describes the overall project.

The skill name identifies the meta-skill responsible for task analysis and routing.

---

## 5. Proposed Repository Structure

```text
engineering-skills-router/
│
├── README.md
├── AGENTS.md
│
├── router/
│   └── engineering-router/
│       └── SKILL.md
│
├── catalog/
│   ├── skills.yaml
│   ├── categories.yaml
│   ├── rankings.yaml
│   └── sources.yaml
│
├── vendors/
│   ├── pstack/
│   ├── mattpocock/
│   └── addyosmani/
│
├── scripts/
│   ├── setup
│   ├── update
│   ├── validate-catalog
│   └── list-skills
│
└── docs/
    ├── architecture.md
    ├── workflow.md
    └── adding-a-source.md
```

---

## 6. External Skill Sources

The original repositories should be kept separate from project-owned files.

The preferred implementation is to use Git submodules.

Example:

```bash
git submodule add https://github.com/backnotprop/pstack.git vendors/pstack

git submodule add https://github.com/mattpocock/skills.git vendors/mattpocock

git submodule add https://github.com/addyosmani/agent-skills.git vendors/addyosmani
```

Clone:

```bash
git clone --recurse-submodules <repository-url>
```

For an existing clone:

```bash
git submodule update --init --recursive
```

Update external repositories:

```bash
git submodule update --remote --merge
```

External repositories must not be modified locally.

All project-specific metadata belongs in `catalog/`.

---

## 7. Skill Catalog

The router should not need to load every `SKILL.md` just to decide what to use.

Instead, it should consult a lightweight catalog containing metadata about each skill.

Example:

```yaml
skills:

  mattpocock/grill-me:
    source: mattpocock
    path: vendors/mattpocock/skills/productivity/grill-me/SKILL.md

    categories:
      - requirements
      - clarification

    use_when:
      - task is vague
      - requirements are unclear
      - important decisions are unresolved

    complexity:
      - medium
      - high

  pstack/how:
    source: pstack
    path: vendors/pstack/skills/how/SKILL.md

    categories:
      - discovery
      - code-understanding

    use_when:
      - existing code must be understood

  addyosmani/code-review-and-quality:
    source: addyosmani
    path: vendors/addyosmani/skills/code-review-and-quality/SKILL.md

    categories:
      - review
      - quality

    use_when:
      - implementation is complete
      - code needs pre-merge review
```

The catalog is project-owned.

The original `SKILL.md` files remain untouched.

---

## 8. Initial Categories

The first version should support at least these categories:

```text
requirements
clarification
discovery
code-understanding
specification
planning
architecture
implementation
testing
debugging
review
security
performance
refactoring
documentation
release
```

A skill may belong to more than one category.

---

## 9. Source Catalog

Example `catalog/sources.yaml`:

```yaml
sources:

  pstack:
    repository: https://github.com/backnotprop/pstack
    local_path: vendors/pstack

  mattpocock:
    repository: https://github.com/mattpocock/skills
    local_path: vendors/mattpocock

  addyosmani:
    repository: https://github.com/addyosmani/agent-skills
    local_path: vendors/addyosmani
```

The source registry must make it possible to add new repositories later without changing the router architecture.

---

## 10. Skill Ranking

More than one skill may solve the same kind of problem.

The router should therefore support preferred skills and fallback alternatives.

Example:

```yaml
review:

  preferred:
    - addyosmani/code-review-and-quality

  fallback:
    - mattpocock/code-review
    - pstack/interrogate
```

Ranking does not mean that one skill is objectively better.

It means that one skill is the default choice for a particular type of work.

The router may override the default ranking when the task context suggests a better match.

---

## 11. Router Responsibilities

The main skill lives in:

```text
skills/engineering-router/SKILL.md
```

Its responsibilities are:

1. read the task;
2. classify the task;
3. estimate complexity;
4. estimate risk;
5. identify required phases;
6. inspect the skill catalog;
7. select one skill per required phase where possible;
8. remove redundant phases;
9. verify selected skill paths;
10. show the resulting workflow;
11. execute the workflow only when appropriate.

---

## 12. Task Classification

Initial task types:

```text
bug
feature
refactor
architecture
performance
security
documentation
investigation
prototype
review
maintenance
```

The router should also estimate risk:

```text
low
medium
high
```

Possible additional properties:

```text
greenfield
brownfield
production-critical
user-facing
security-sensitive
data-sensitive
multi-session
```

---

## 13. Required Phase Detection

Example task:

```text
Add passwordless authentication
```

Possible classification:

```yaml
type: feature
risk: high

requires:
  - requirements
  - specification
  - implementation
  - testing
  - security
  - review
```

Possible selected workflow:

```text
Matt Pocock
grill-with-docs
      ↓
Addy Osmani
spec-driven-development
      ↓
Matt Pocock
implement
      ↓
Matt Pocock
tdd
      ↓
Addy Osmani
security-and-hardening
      ↓
Addy Osmani
code-review-and-quality
```

---

## 14. Minimal Workflow Principle

The router must not blindly execute every available skill.

It should select the minimum workflow that provides enough confidence.

Examples:

### Small change

```text
implement
   ↓
test
```

### Medium feature

```text
spec
   ↓
implement
   ↓
test
   ↓
review
```

### High-risk feature

```text
requirements
   ↓
specification
   ↓
planning
   ↓
implementation
   ↓
testing
   ↓
specialized review
   ↓
independent review
```

These are guidelines, not hard-coded workflows.

---

## 15. Avoiding Redundant Skills

Equivalent skills should not normally be executed one after another.

Avoid workflows such as:

```text
code-review
   ↓
code-review-and-quality
   ↓
interrogate
```

unless there is a concrete reason for multiple independent reviews.

Multiple reviews are justified when they have different purposes.

Example:

```text
security review
   ↓
general code review
```

or:

```text
implementation review
   ↓
independent architecture review
```

---

## 16. Skill Selection Rules

The router should prefer:

1. specialized skills over generic skills;
2. smaller workflows over larger workflows;
3. existing installed/vendor skills over invented behavior;
4. skills whose purpose clearly matches the current phase;
5. independent review for high-risk tasks when useful.

The router should avoid:

- loading unrelated skills;
- running duplicate reviews;
- creating unnecessary specifications for trivial changes;
- running heavyweight planning workflows for small fixes;
- assuming a skill exists without verification.

---

## 17. Skill Availability

Before selecting a skill, the router must verify that the referenced file exists.

Selection logic:

```text
preferred
   ↓
available?
 ┌───────┐
 yes     no
  ↓       ↓
 use    fallback
```

Example:

```yaml
code_review:

  preferred:
    - addyosmani/code-review-and-quality

  fallback:
    - mattpocock/code-review
    - pstack/interrogate
```

If no mapped skill is available, the router should report the missing capability instead of silently inventing a replacement.

---

## 18. Initial Mapping Examples

### Requirements / Clarification

Possible candidates:

```text
Matt Pocock:
- grill-me
- grill-with-docs

Addy Osmani:
- interview-me
- idea-refine
```

### Code Understanding

Possible candidates:

```text
pstack:
- how
- why
```

### Specification

Possible candidates:

```text
Matt Pocock:
- to-spec

Addy Osmani:
- spec-driven-development
```

### Planning

Possible candidates:

```text
Addy Osmani:
- planning-and-task-breakdown

pstack:
- architect
- arena
```

### Implementation

Possible candidates:

```text
Matt Pocock:
- implement

pstack:
- tdd

Addy Osmani:
- incremental-implementation
- test-driven-development
```

### Review

Possible candidates:

```text
Matt Pocock:
- code-review

pstack:
- interrogate

Addy Osmani:
- code-review-and-quality
```

### Architecture / Refactoring

Possible candidates:

```text
Matt Pocock:
- improve-codebase-architecture

pstack:
- architect
- arena

Addy Osmani:
- code-simplification
```

### Security

Possible candidates:

```text
Addy Osmani:
- security-and-hardening
```

### Release

Possible candidates:

```text
Addy Osmani:
- shipping-and-launch
```

This initial mapping should be reviewed during implementation against the current upstream repositories.

---


## 19. User Preferences

The router should support user-specific preferences without modifying the shared catalog.

The base catalog defines the default ranking:

```yaml
review:

  preferred:
    - addyosmani/code-review-and-quality

  fallback:
    - mattpocock/code-review
    - pstack/interrogate
```

A user may prefer a different skill.

Example:

```yaml
preferences:

  requirements:
    prefer:
      - mattpocock/grill-me

  review:
    prefer:
      - mattpocock/code-review

  testing:
    prefer:
      - pstack/tdd
```

These preferences should override the default ranking when the preferred skill is available and appropriate for the task.

---

## 30. Preference Scope

Preferences should be kept separate from the shared catalog.

Possible structure:

```text
config/
├── preferences.example.yaml
└── preferences.yaml
```

`preferences.example.yaml` may be committed to the repository.

`preferences.yaml` should normally be user-owned and ignored by Git.

Example `.gitignore` entry:

```text
config/preferences.yaml
```

This allows each developer to customize routing without changing project defaults.

---

## 31. Preference Rules

User preferences should be treated as routing hints, not absolute commands.

The router should follow this order:

```text
user preference
      ↓
is it available?
      ↓
is it suitable for this task?
      ↓
yes → use it

no
 ↓
default ranking
 ↓
fallback
```

A user preference should not force an obviously inappropriate skill.

For example, if the user prefers:

```yaml
requirements:
  prefer:
    - mattpocock/grill-me
```

the router should use `grill-me` when requirements clarification is actually needed.

It should not add a requirements phase to a trivial task only because the user prefers that skill.

---

## 32. Preference Examples

Example configuration:

```yaml
preferences:

  requirements:
    prefer:
      - mattpocock/grill-me

  code_understanding:
    prefer:
      - pstack/how

  implementation:
    prefer:
      - mattpocock/implement

  testing:
    prefer:
      - pstack/tdd

  review:
    prefer:
      - addyosmani/code-review-and-quality

  security:
    prefer:
      - addyosmani/security-and-hardening
```

Users may also exclude skills they do not want to use:

```yaml
preferences:

  exclude:
    - pstack/interrogate
```

Optional future syntax:

```yaml
preferences:

  sources:
    prefer:
      - mattpocock
      - pstack
      - addyosmani
```

This would allow users to express a general source preference while still letting the router choose the best specialized skill when necessary.

---

## 33. Preference Priority

Suggested priority order:

```text
1. Task requirements
2. User exclusions
3. User explicit skill preference
4. Project-specific preference
5. Default catalog ranking
6. Fallback skill
```

Task correctness always has priority over preference.

Preferences influence **which suitable skill is selected**, not **which engineering phases are required**.

---

## 29. Router Output

Before execution, the router should present a concise workflow.

Example:

```text
Task: Add password reset throttling
Type: security-sensitive feature
Risk: high

Selected workflow:

1. pstack/how
   Understand the current authentication flow.

2. mattpocock/to-spec
   Record the expected behavior and boundaries.

3. mattpocock/implement
   Implement the change.

4. addyosmani/security-and-hardening
   Review security implications.

5. addyosmani/code-review-and-quality
   Perform final general review.
```

The router should also explain why a phase was skipped when that decision is important.

---

## 30. Compatibility

The project should aim to remain agent-neutral.

Initial target tools:

```text
Codex
Claude Code
Pi
Cursor
OpenCode
```

The core router should not depend on one vendor-specific runtime.

Original skills remain Markdown files.

Agent-specific integration can be added later through adapters.

---

## 31. Updating External Repositories

A script such as:

```text
scripts/update
```

should:

1. update submodules;
2. detect added skills;
3. detect removed skills;
4. compare upstream contents with the local catalog;
5. print changes;
6. never rewrite the catalog automatically.

Example output:

```text
pstack
+ new-skill

mattpocock
- deprecated-skill
+ new-review-skill

addyosmani
no changes

Catalog review required.
```

---

## 32. Catalog Validation

A script such as:

```text
scripts/validate-catalog
```

should validate:

- referenced source exists;
- referenced path exists;
- duplicate IDs;
- invalid categories;
- preferred skills exist;
- fallback skills exist;
- missing vendor repositories;
- catalog entries pointing to removed upstream skills.

Optionally, it may also report:

```text
upstream skills not yet cataloged
```

without treating them as fatal errors.

---

## 33. V1 Scope

The first version should focus only on routing.

Required:

```text
Task
  ↓
Classification
  ↓
Required phases
  ↓
Skill selection
  ↓
Workflow
```

Not required in V1:

- graphical UI;
- web application;
- database;
- remote registry;
- automatic global skill installation;
- automatic modification of user configuration;
- telemetry;
- workflow history;
- scoring based on historical outcomes.

---

## 29. Possible Future Features

### Dynamic Scoring

Future versions may assign a score to candidate skills.

Example:

```text
score =
  task match
+ specialization
+ risk suitability
+ workflow compatibility
- redundancy
- unnecessary complexity
```

### Feedback Loop

Record which workflows produced good results and use that data to improve future selection.

### Automatic Discovery

Scan new vendor `SKILL.md` files and propose catalog entries.

### Additional Sources

The architecture must allow new collections to be added without changing the router core.

### Agent Adapters

Possible future directories:

```text
adapters/
├── codex/
├── claude-code/
├── pi/
├── cursor/
└── opencode/
```

These adapters may expose the router using each agent's preferred installation mechanism.

---

## 30. Security and Isolation

External repositories must be treated as third-party content.

The project should:

- never modify vendor repositories automatically;
- never execute arbitrary vendor scripts during catalog discovery;
- inspect skill metadata before use;
- avoid automatically installing vendor code globally;
- clearly identify the source of every selected skill.

---

## 31. Definition of Done — V1

V1 is complete when:

- [ ] repository structure exists;
- [ ] pstack is available under `vendors/`;
- [ ] Matt Pocock Skills is available under `vendors/`;
- [ ] Addy Osmani Agent Skills is available under `vendors/`;
- [ ] external repositories are isolated from personal skills;
- [ ] `sources.yaml` exists;
- [ ] `categories.yaml` exists;
- [ ] initial `skills.yaml` exists;
- [ ] initial ranking/fallback rules exist;
- [ ] `engineering-router/SKILL.md` exists;
- [ ] the router can classify a task;
- [ ] the router can determine required phases;
- [ ] the router can select mapped skills;
- [ ] the router verifies that selected skills exist;
- [ ] the router avoids obvious duplicate phases;
- [ ] the router outputs a readable workflow;
- [ ] the catalog can be validated;
- [ ] upstream repositories can be updated independently;
- [ ] no user-installed skill is overwritten.

---

## 32. Example End-to-End Flow

```text
User task
   ↓
engineering-router
   ↓
Classify task
   ↓
Estimate risk
   ↓
Determine required phases
   ↓
Read catalog
   ↓
Rank candidate skills
   ↓
Remove redundant steps
   ↓
Verify skill files
   ↓
Present workflow
   ↓
Execute selected skills
```

Example:

```text
"Refactor the authentication module without changing behavior"

        ↓

type: refactor
risk: medium

        ↓

required:
- discovery
- architecture
- implementation
- testing
- review

        ↓

possible workflow:

pstack/how
        ↓
pstack/architect
        ↓
mattpocock/implement
        ↓
mattpocock/tdd
        ↓
addyosmani/code-review-and-quality
```

---

## 33. Project Philosophy

The project should not answer:

> Which skill collection is best?

Instead, it should answer:

> Which skill is most useful for this particular step of this particular task?

The main idea behind **engineering-skills-router** is to treat skill collections as a shared toolbox rather than mutually exclusive frameworks.

The router exists to select the smallest useful combination.

---

## 34. V2 — Workflow Decisions

Decided in a grilling session after V1. Where this section conflicts with an earlier one, this section wins; the earlier sections it amends are named inline.

### 34.1 Scope of the router

The router is meant for non-trivial work. When a task classifies as low risk, the router stops, says so, and offers to proceed without a workflow (no vendor skills, no issue). Medium and high risk tasks get the full flow below.

### 34.2 Default flow

```text
[requirements] → specification + GitHub issue ⏸ → [tickets ⏸] → branch → ⏸ implementation
→ review 1 → review 2 (other model) → comparison → [security, suggested] → pull request ⏸ → stop
```

`⏸` = confirmation point, `[ ]` = conditional step.

| Phase | Rule |
|---|---|
| requirements | `mattpocock/grill-me`; `mattpocock/grill-with-docs` only when the target repo already has `GLOSSARY.md` or `docs/adr/`. Runs by default, after debugging or code-understanding when present. Skipped only when the task is an issue or spec that already settles the decisions. |
| specification + issue | `mattpocock/to-spec`, published to the tracker. Medium and high risk only. |
| tickets | `mattpocock/to-tickets`, only when the spec splits into more than one ticket. |
| branch | `<issue-number>-<slug>`, created right after the issue is published. With `implement-spec`, its integration branch is this branch. |
| implementation | `mattpocock/implement-spec` when there are 3+ tickets and at least 2 can run in parallel; otherwise `mattpocock/implement`. |
| review 1 | `mattpocock/code-review` (runs inside `implement` / `implement-spec`). Default for the `review` phase; `addyosmani/code-review-and-quality` becomes the first fallback (amends §10, §18). |
| review 2 | Always. A subagent on the model family opposite to review 1's (`models.claude` / `models.openai` in `config/preferences.yaml`) runs `addyosmani/code-review-and-quality` on the same diff and issue. Not a duplicate under §15: different model, different review axes. Needs a harness that can reach both families (subagents with an explicit model, both providers configured; e.g. Pi so set up). The workflow states whether that holds before it starts; when not, the user skips review 2 or runs it on the current model, where it counts as a second review, not an independent one. |
| comparison | The router merges both reviews: findings from both, findings from one only, disagreements. |
| security | Part of the workflow from the start when the task is security- or data-sensitive. Otherwise, after the reviews, the router inspects the diff (auth, user input, queries, secrets, new dependencies, config, permissions) and suggests `addyosmani/security-and-hardening` with the reason; the user decides. |
| independent review | `pstack/interrogate` added for high risk. |
| pull request | `mattpocock/pr` writes the body; the PR links the issue with `Closes #N`. The router stops at the open PR; the user merges. |

### 34.3 Confirmation points

Besides the initial approval of the workflow, the router asks before every outward-facing action (publishing an issue, tickets, a PR) and before implementation starts. Internal steps run without pausing, apart from the pauses vendor skills define themselves.

### 34.4 Initial skill selection

Before execution, each step shows its default skill and at most two alternatives, taken from the catalog ranking and filtered by availability and fit, each with a one-line reason. The user accepts with a single action or swaps a step. Without the Pi adapter, the same choice is offered as text in chat.

### 34.5 Vendor copies and updates

- The router always reads skills from `vendors/` at pinned commits, never from user-installed copies (confirms §6). The one exception is the `personal` source: the user's own skills, listed in `config/personal-skills.yaml` with paths under `preferences.personal_path`, read in place and never written. A personal skill never stands in for a vendor skill: one named like a cataloged vendor skill (`personal/tdd` next to `mattpocock/tdd`) is skipped with a warning. Personal skills are not pinned: editing one changes the workflow. They rank through `preferences.<phase>.prefer` or as `other` candidates; `catalog/rankings.yaml` stays vendor-only.
- At startup, the router checks the date of the last update check (git-ignored file under `config/`). After `update_check_days` (default 14, `0` = never) it asks whether to check for updates.
- After an update, the agent reads new or changed vendor `SKILL.md` files and **proposes** a diff to `catalog/skills.yaml` and `catalog/rankings.yaml`. It is applied only after the user confirms, then `scripts/validate-catalog` runs. The catalog is still never rewritten without confirmation (refines §31).

### 34.6 Scripts

Scripts are Node, with the `yaml` package as the only dependency (replaces the V1 Ruby scripts).

### 34.7 Architecture and the Pi adapter

- The skill (`skills/engineering-router/SKILL.md`) stays the agent-neutral core: it classifies, selects and executes.
- During a workflow it writes its state to `.router/state.json` in the target repo: steps, chosen skill, alternatives, status per step, handoff (issue, branch, base commit, PR). The format is defined in `skills/engineering-router/state.md`.
- `adapters/pi/` holds a Pi extension that reads that file and renders:
  - a compact widget above the editor: the steps with status (✓ done, ▶ running, ○ pending) and skill;
  - an overlay anchored right at 50% width, toggled by a shortcut, with details per step and the initial selection UI of §34.4.
- Pi has no true split view; the overlay is non-capturing and covers the right half of the chat while open.

### 34.8 Implementation Plan

One session per item, in this order:

1. **Scripts in Node.** Port `list-skills`, `validate-catalog`, `update`, `setup`, `selftest` to Node + `yaml`; same behaviour, existing selftest cases still pass. Add `update_check_days` and `second_review_model` to the preferences schema and validation.
2. **Catalog and router skill.** Apply §34.1–§34.5 to `catalog/` and `SKILL.md`, including the `.router/state.json` format (§34.7) and the text fallback for skill selection.
3. **Pi adapter.** `adapters/pi/` extension: widget, overlay, selection UI, all driven by `.router/state.json`.

Later work lives in `docs/backlog.md`.
