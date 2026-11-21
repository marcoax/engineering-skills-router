# Catalog accuracy audit — 2026-11-21

Scope: every entry in `catalog/skills.yaml` (109) checked against its vendor `SKILL.md`, read in full: `categories`, `use_when`, `avoid_when`, `complexity`, `invokes`, `requires`, `cost`. Read-only: no catalog edit was made. Paths and descriptions were correct in every entry.

Method: four parallel read-only agents (mattpocock, pstack ×2, addyosmani + modern-web-guidance). These findings were spot-checked against the vendor files: `pstack/architect` :43, `pstack/reflect` :61, `mattpocock/implement-spec` requires, `addyosmani/interview-me` :36, `pstack/make-bot-ui` :89. All confirmed.

Vendor revisions: those in `catalog/reviewed.yaml` at the time of the audit.

Machine-checked `requires` values are only `tracker-config`, `subagents` and `isolated-outputs` (`scripts/lib/catalog.js`); anything else is prose.

Summary: 67 entries with findings, 42 entries with none. Recurring patterns:

1. **Side effects missing from `avoid_when`**: implementation without a checkpoint, commits, pushes, PRs, tracker writes, writes to user-level directories, `sudo` installs.
2. **`requires: [subagents]` missing** on skills built on subagents, so `check-selection` cannot enforce it. `cost: high` is also missing where work is repeated.
3. **Incomplete `invokes`**, so internally covered phases are not counted.
4. **Imprecise `categories` / `use_when`.**

Finding format: `field` · severity · problem · evidence · suggested fix.

## mattpocock

- **grill-with-docs** · invokes · medium · only hands off to grilling and domain-modeling · SKILL.md:7 "Call the Skill tool twice, for "grilling" and "domain-modeling"" · `invokes: [mattpocock/grilling, mattpocock/domain-modeling]`
- **grill-with-docs** · use_when/avoid_when · medium · avoid case is backwards: domain-modeling creates GLOSSARY.md and docs/adr/ when they are missing · domain-modeling/SKILL.md:40 "Create files lazily…" · use_when "requirements are unclear and terms/decisions should be recorded in GLOSSARY.md/ADRs"; avoid_when "the user does not want glossary or ADR files written (use grill-me)"
- **grilling** · use_when · low · incomplete list of callers · wayfinder:111,124; triage:76; grill-with-docs:7 · "called by grill-me, grill-with-docs, wayfinder, triage or improve-codebase-architecture"
- **to-tickets** · use_when · low · too narrow: also works from a plan or the conversation · SKILL.md:9 · "a plan, spec or decided conversation must be split into tracer-bullet tickets with blocking edges"
- **wayfinder** · invokes · medium · calls grilling, domain-modeling, research and prototype · SKILL.md:78,111,115 · `invokes: [mattpocock/grilling, mattpocock/domain-modeling, mattpocock/research, mattpocock/prototype]`
- **wayfinder** · requires · medium · starts research subagents; tracker-config is soft (falls back to a local tracker) · SKILL.md:25,115 · `requires: [subagents]` (tracker-config soft)
- **wayfinder** · avoid_when · low · pushes `research/<name>` branches · SKILL.md:115 · avoid_when "pushing research branches to the remote is not allowed"
- **implement-spec** · requires · high · built on subagents and worktrees; `subagents` is only mentioned in avoid_when prose · SKILL.md:15,29 · `requires: [tracker-config, subagents]` (consider isolated-outputs)
- **implement-spec** · categories/avoid_when · low · opens a draft PR, marks it ready, closes tickets · SKILL.md:27,40 · avoid_when "must not open PRs or close tickets", or add issue-tracking
- **code-review** · requires · medium · the two axes run as parallel subagents by design · SKILL.md:11,60 · `requires: [subagents]`
- **implement** · avoid_when · low · commits to the current branch; inherits code-review's subagents · SKILL.md:15,17 · avoid_when "commits on the current branch are not wanted"
- **tdd** · invokes · low · calls codebase-design · SKILL.md:26 · `invokes: [mattpocock/codebase-design]`
- **triage** · invokes · medium · calls grilling and domain-modeling · SKILL.md:76 · `invokes: [mattpocock/grilling, mattpocock/domain-modeling]`
- **triage** · avoid_when · medium · comments, label changes and closures on the tracker; writes `.out-of-scope/`; checks out and runs PR code · SKILL.md:74,82,85 · avoid_when "comments, label changes or closures must not be posted to the tracker"
- **improve-codebase-architecture** · invokes · medium · calls codebase-design, grilling, domain-modeling · SKILL.md:13,64,66 · add all three
- **improve-codebase-architecture** · requires · medium · exploration subagent · SKILL.md:27 · `requires: [subagents]`
- **improve-codebase-architecture** · categories · low · does no refactoring: writes a candidates report and runs a grilling · SKILL.md:60,68 · `[architecture, discovery]`
- **codebase-design** · note · low · optional Design It Twice: 3+ parallel subagents · DESIGN-IT-TWICE.md · prose note only, no `cost: high`
- **research** · requires/avoid_when · medium · always uses a background agent, needs network, writes a Markdown file to the repo · SKILL.md:6,12 · `requires: [subagents, network access]`; avoid_when "findings must not be written to the repo"
- **domain-modeling** · categories · low · challenges the user's terms (clarification work) · SKILL.md:50 · `[documentation, clarification]`
- **setup-matt-pocock-skills** · avoid_when · low · may run `git init`, add a remote, create labels · SKILL.md:51,106 · avoid_when "remotes or tracker labels must not be created"
- **handoff** · categories · low · not multi-session planning: only writes a summary of the current conversation · SKILL.md:8 · `[context-management]`

No findings: grill-me, to-spec, diagnosing-bugs, prototype, pr, retro, wizard, teach, to-questionnaire, wait-what, writing-for-agents.

## pstack

- **architect** · categories · high · implements by default with no checkpoint, yet implementation is not listed; does not break work into tasks · SKILL.md:43 "Default: proceed directly to implementation… No human checkpoint." · `[architecture, implementation]`, drop planning
- **architect** · avoid_when · high · no case for "design only" · SKILL.md:43,51-53 · avoid_when "only a design sketch is wanted, unless a checkpoint is requested"
- **architect** · invokes/requires/cost · medium · calls how, why, arena and interrogate; worktrees, multiple models · SKILL.md:23,29,47 · `invokes: [pstack/how, pstack/why, pstack/arena, pstack/interrogate]`; `requires: [subagents, isolated-outputs]`; `cost: high`
- **why** · requires/cost · medium · gh, network, MCPs; full fan-out up to 7 investigators by default · SKILL.md:27,31,49 · `requires: [subagents, network, gh]`; `cost: high`
- **why** · categories · low · external evidence (tracker, chat, observability) · SKILL.md:37-46 · add research
- **how** · requires · low · explorer/explainer subagents, with a fallback · SKILL.md:11,22 · optional subagents note
- **figure-it-out** · categories · medium · carries out the plan and commits · SKILL.md:34,38 · `[multi-session, planning, implementation]`
- **figure-it-out** · invokes/avoid_when/cost · medium · calls architect (and so arena) and show-me-your-work; commits the trail · SKILL.md:30,46 · `invokes: [pstack/architect, pstack/show-me-your-work]`; avoid_when "a narrower playbook fits or the shape is concrete"; `cost: high`
- **tdd** · categories/use_when · medium · bug-fix workflow; first trigger is an explicit request for TDD or a regression test · SKILL.md:3,7,19 · `[testing, debugging]`; add that use_when
- **interrogate** · invokes/requires/cost/avoid_when · medium · runs arena phases in per-adversary worktrees, calls in-your-own-words, report-only · SKILL.md:13,17 · `invokes: [pstack/arena, pstack/in-your-own-words]`; `requires: [subagents, isolated-outputs]`; `cost: high`; avoid_when "fixes must be applied"
- **blast-radius** · invokes · low · reuses why, writes through unslop, can escalate to arena · SKILL.md:33,38,48 · `invokes: [pstack/why, pstack/unslop]`
- **automate-me** · requires/avoid_when · medium · subagents over transcripts, commit and PR, user-level skill folder · SKILL.md:11,39,77,91 · `requires: [subagents]`; avoid_when "commits, PRs or user-level skill writes not authorized"
- **make-bot-ui** · avoid_when/requires · high · `curl … | sudo sh`, `sudo tailscale up`, binds 0.0.0.0; Cursor-specific · SKILL.md:37,57,89 · avoid_when "system installs (sudo) or exposing a network listener not authorized"; requires "Cursor Grok Bot harness"
- **maintain-verification-skill** · requires/avoid_when · medium · opens a PR; one subagent per feature · SKILL.md:16,29,37 · `requires: [subagents]`; avoid_when "PR not authorized"
- **no-comments** · invokes/requires · medium · subagent, calls how, why, architect; edits code; waits for approval · SKILL.md:19-23 · `invokes: [pstack/how, pstack/why, pstack/architect]`; `requires: [subagents]`
- **poteto-mode** · avoid_when/cost/requires · medium · external actions without asking; every playbook ends in a PR · SKILL.md:84,162 · avoid_when "external posts, ticket updates or PRs not authorized"; `cost: high`; `requires: [subagents]`
- **ketchup-video** · requires · low · video renderer and frame extraction only appear in avoid_when · SKILL.md:27,29 · move to requires
- **create-formal-verification-skill** · requires/invokes · low · installable verifier; TLA+ → statechart · SKILL.md:19,35 · requires "installable model checker"; optional `invokes: [pstack/statechart]`
- **sharpen** · use_when · low · rewrites the prompt deeper, not bigger · SKILL.md:7 · "the user wants the task reframed to what a top professional would do, then the prompt rewritten"
- **recall** · invokes · medium · runs why's investigators by default · SKILL.md:26 · `invokes: [pstack/unslop, pstack/why]`
- **recall** · requires · medium · parallel subagents over history; gh for live state · SKILL.md:25,27 · `requires: [subagents]`
- **reflect** · requires/cost · high · 3 parallel reviewers + synthesizer in agent mode · SKILL.md:35,51 · `requires: [subagents]`; `cost: high`; `complexity: [high]`
- **reflect** · avoid_when · high · files backlog items without approval; after approval writes copies to user-level skill directories (forbidden by this repo's AGENTS.md) · SKILL.md:61,63 · avoid_when "filing to a tracker or writing user-level skill directories is not allowed"
- **reflect** · invokes · low · hands substantive edits to an external skill-authoring skill · SKILL.md:68 · note only (not cataloged)
- **swarm** · cost/complexity · medium · races N workers on identical briefs, like arena · SKILL.md:21 · `cost: high`; `complexity: [high]`
- **swarm** · categories · low · gauntlets, workers that verify commits · SKILL.md:3,23 · consider testing
- **teach** · invokes · low · every response goes through unslop · SKILL.md:19 · add pstack/unslop
- **show-me-your-work** · requires · medium · mandatory subagent on a different model family; always writes a TSV · SKILL.md:67 · `requires: [subagents]`; avoid_when "no other-family subagent available"
- **show-me-your-work** · invokes · low · log through unslop · SKILL.md:36 · `invokes: [pstack/unslop]`
- **show-me-your-work** · categories · low · not multi-session planning · SKILL.md:42 · `[documentation]` or `[documentation, context-management]`
- **setup-pstack** · invokes · low · offers to run the create-verification skills · SKILL.md:80,84 · `invokes: [pstack/create-verification-skill, pstack/create-formal-verification-skill]`
- **statechart** · requires · low · mise and Pele are not mentioned · SKILL.md:21,76 · add both to the prose
- **principle-explain-the-number** · invokes · medium · runs benchmark-checklist's full procedure · SKILL.md:14 · `invokes: [pstack/benchmark-checklist]`
- **typescript-best-practices** · invokes · low · applies principle-type-system-discipline first · SKILL.md:10 · add it
- **principle-experience-first** · categories · low · a principle for choosing what to build, not an interview · SKILL.md:9,13 · `[architecture, prototype]` or `[specification, prototype]`
- **principle-fix-root-causes** · use_when · low · assumes the failure is reproduced, but reproducing is its first step · SKILL.md:14 · "a failure needs tracing to the first incorrect decision rather than a symptom guard"
- **principle-minimize-reader-load** · categories · low · the description also covers review · SKILL.md:3 · `[refactoring, review]`
- **unslop** · use_when · low · applies to any writing, including new text · SKILL.md:3 · "prose being written or edited needs AI patterns removed…"

No findings: arena, benchmark-checklist, technical-writing, bro, correct, create-verification-skill, in-your-own-words, ketchup, maintain-formal-verification-skill, every other principle-* (attack-the-premise, boundary-discipline, build-the-lever, encode-lessons-in-structure, exhaust-the-design-space, foundational-thinking, guard-the-context-window, laziness-protocol, make-operations-idempotent, migrate-callers-then-delete-legacy-apis, model-the-domain, never-block-on-the-human, outcome-oriented-execution, prove-it-works, redesign-from-first-principles, separate-before-serializing-shared-state, sequence-verifiable-units, subtract-before-you-add, test-behavior-not-implementation, type-system-discipline). Several principle bodies are only 1–3 lines; their metadata still matches the description.

## addyosmani

- **interview-me** · categories · medium · a full interview to ~95% confidence, not a single ambiguity · SKILL.md:3,40-62 · `[requirements]`
- **interview-me** · avoid_when/requires · medium · forbids non-interactive contexts · SKILL.md:36 · avoid_when "CI, scheduled run, /loop, autonomous loop"; requires "a live, responsive user"
- **idea-refine** · avoid_when/requires · low · AskUserQuestion; its own "Not for" cases are not reflected · SKILL.md:18,76 · add those cases; requires "interactive user"
- **planning-and-task-breakdown** · use_when/avoid_when · medium · creates tracker items when a tracker is named; otherwise writes tasks/plan.md and tasks/todo.md · SKILL.md:33,145,162 · drop "without publishing tickets"; avoid_when "tickets must not be created"
- **incremental-implementation** · avoid_when · medium · commits after every slice · SKILL.md:41,245 · avoid_when "commits not authorized"
- **git-workflow-and-versioning** · categories · medium · does not open PRs, but has a full release/versioning section · SKILL.md:270-311 · add release; use_when for semver, tags and changelog
- **git-workflow-and-versioning** · avoid_when · medium · `git reset --hard`, push of tags · SKILL.md:189,292 · avoid_when "pushes, tags or history resets not authorized"
- **constraint-driven-development** · avoid_when/requires · medium · no non-interactive runs; edits AGENTS.md/CLAUDE.md; installs tools (brew, pipx) · SKILL.md:38,140,153-155 · avoid_when accordingly; requires "interactive user"
- **constraint-driven-development** · categories · low · 4-question intake · SKILL.md:57-91 · add requirements
- **source-driven-development** · requires · low · fetches official docs · SKILL.md:63-65 · requires "network access or a docs-fetching tool"
- **spec-driven-development** · categories · low · clarifying-question loop and a capability map · SKILL.md:34-69 · add requirements

No findings: test-driven-development, debugging-and-error-recovery, api-and-interface-design, code-simplification, security-and-hardening, performance-optimization, code-review-and-quality, documentation-and-adrs, shipping-and-launch, browser-testing-with-devtools, ci-cd-and-automation, context-engineering, deprecation-and-migration, doubt-driven-development, frontend-ui-engineering, observability-and-instrumentation.

## modern-web-guidance

- **modern-web-guidance** · categories · medium · main use is at the start of implementation ("MANDATORY: Execute FIRST"), but implementation is missing · SKILL.md:4,11,41-45 · `[implementation, research, refactoring, review, performance]`
- **chrome-extensions** · categories · medium · Part 2 is a Chrome Web Store launch workflow; use_when also covers debugging · SKILL.md:5,380-464 · `[implementation, release, debugging]`
- **chrome-extensions** · avoid_when · low · creates or updates CHROMEWEBSTORE.md on its own · SKILL.md:388-399 · avoid_when "CHROMEWEBSTORE.md must not be created (internal extensions)"
