# Skill index

Browse the vendor skills by type and activity. [Back to the README](../README.md).

The current [catalog](../catalog/skills.yaml) contains **110 vendor skills**. Each appears once below. Entries are alphabetical within each group; their order expresses no routing preference.

| Collection | Skills |
|---|---|
| addyosmani | 25 |
| mattpocock | 27 |
| pstack | 58 |

## Contents

- [Guides](#guides): 3 entry points for choosing skills and workflows.
- [Orchestrators](#orchestrators): 1 skill that selects and runs a vendor workflow.
- [Principles](#principles): 24 focused rules for engineering decisions.
- [Workflow and supporting skills](#workflow-and-supporting-skills): 82 skills grouped by activity.

## Reading the index

Descriptions summarize the catalog and help you find candidates. Read the linked `SKILL.md` before choosing or running one: it owns the complete process, prerequisites and side effects. Source links point to the vendor commits checked out when this index was updated, so they work on GitHub as well as from a local Markdown viewer.

The four types are a navigation aid for this document. Guides are shown separately from executable orchestrators. The runtime catalog currently tags both under `workflow-selection`; this index does not change routing or priorities.

The router itself is documented in [engineering-router](../skills/engineering-router/SKILL.md). Personal and project skills depend on local configuration and are not included in this shared vendor index. Inspect those with `scripts/list-skills --target <repo>`.

## Guides

Consult these to understand which skills or flows a collection offers for a task.

| Guide | Helps with |
|---|---|
| [addyosmani/using-agent-skills](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/using-agent-skills/SKILL.md) | Map a task to development phases and the matching Addy Osmani skills. |
| [mattpocock/ask-matt](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/ask-matt/SKILL.md) | Choose a Matt Pocock skill or flow for the current situation. |
| [pstack/poteto-help](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/poteto-help/SKILL.md) | Choose a pstack skill, playbook or principle, or find setup and recovery guidance. |

## Orchestrators

These execute a vendor workflow. Choose one when that workflow is explicitly requested.

| Orchestrator | Does |
|---|---|
| [pstack/poteto-mode](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/poteto-mode/SKILL.md) | Match a task to a playbook and run its steps, invoking skills as needed. |

## Principles

Focused decision rules that can support work in several phases.

| Principle | When useful | Activities |
|---|---|---|
| [pstack/principle-attack-the-premise](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-attack-the-premise/SKILL.md) | two or more fixes sharing one premise have failed the same check and the premise needs a direct test | Debugging |
| [pstack/principle-boundary-discipline](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-boundary-discipline/SKILL.md) | validation, error handling or framework wiring needs clear boundaries around pure business logic | Architecture, Refactoring |
| [pstack/principle-build-the-lever](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-build-the-lever/SKILL.md) | non-trivial edits, migrations or checks need a small rerunnable script or generator to perform or prove the work | Implementation |
| [pstack/principle-encode-lessons-in-structure](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-encode-lessons-in-structure/SKILL.md) | a recurring instruction or correction should become an enforceable structural guardrail | Retrospectives, Refactoring |
| [pstack/principle-exhaust-the-design-space](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-exhaust-the-design-space/SKILL.md) | a novel interaction or architectural decision lacks precedent and needs competing prototypes | Architecture, Prototyping |
| [pstack/principle-experience-first](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-experience-first/SKILL.md) | product scope or UX tradeoffs need to prioritize the consumer experience and polish over implementation convenience | Requirements, Prototyping |
| [pstack/principle-explain-the-number](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-explain-the-number/SKILL.md) | a benchmark or evaluation result needs a decision threshold, noise estimate and evidence of what limits it | Performance, Testing and verification |
| [pstack/principle-fix-root-causes](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-fix-root-causes/SKILL.md) | a reproduced failure needs tracing to the first incorrect decision rather than a symptom guard | Debugging |
| [pstack/principle-foundational-thinking](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-foundational-thinking/SKILL.md) | core types, access patterns or shared state must be designed before logic and scaffold work sequenced before features | Architecture, Planning |
| [pstack/principle-guard-the-context-window](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-guard-the-context-window/SKILL.md) | large outputs, repeated reads or planned fan-out risk filling the context window | Context management |
| [pstack/principle-laziness-protocol](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-laziness-protocol/SKILL.md) | a proposed abstraction or large diff should be reduced to the smallest change with one source of truth | Refactoring |
| [pstack/principle-make-operations-idempotent](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-make-operations-idempotent/SKILL.md) | commands, lifecycle steps or processing loops must converge after retries, restarts and partial runs | Architecture, Implementation |
| [pstack/principle-migrate-callers-then-delete-legacy-apis](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | an internal API is being replaced and callers can migrate together with removal of the old API | Refactoring |
| [pstack/principle-minimize-reader-load](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-minimize-reader-load/SKILL.md) | code is hard to trace because of pass-through layers or hidden mutable state | Refactoring |
| [pstack/principle-model-the-domain](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-model-the-domain/SKILL.md) | stateful logic repeats shape assumptions or grows conditionals that a domain data structure could eliminate | Architecture, Refactoring |
| [pstack/principle-never-block-on-the-human](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-never-block-on-the-human/SKILL.md) | authorized reversible work is stalled on a routine execution choice the agent can reasonably make | Implementation |
| [pstack/principle-outcome-oriented-execution](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-outcome-oriented-execution/SKILL.md) | a planned rewrite or migration has explicit verification boundaries and reversible intermediate breakage | Planning, Refactoring |
| [pstack/principle-prove-it-works](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-prove-it-works/SKILL.md) | completed work needs direct verification against the real artifact before it is reported as done | Testing and verification |
| [pstack/principle-redesign-from-first-principles](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-redesign-from-first-principles/SKILL.md) | a new requirement must be integrated coherently into an existing design rather than bolted on | Architecture, Refactoring |
| [pstack/principle-separate-before-serializing-shared-state](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-separate-before-serializing-shared-state/SKILL.md) | concurrent actors may write the same mutable object and ownership should be separated before adding locks | Architecture |
| [pstack/principle-sequence-verifiable-units](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-sequence-verifiable-units/SKILL.md) | a multi-step sweep, migration or commit stack needs small ordered units with a check after each | Planning |
| [pstack/principle-subtract-before-you-add](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-subtract-before-you-add/SKILL.md) | an addition, refactor or rewrite should first remove dead code, redundant validation and obsolete references | Refactoring, Planning |
| [pstack/principle-test-behavior-not-implementation](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-test-behavior-not-implementation/SKILL.md) | tests are being written, changed or assessed for whether they catch broken behavior and survive internal refactors | Testing and verification |
| [pstack/principle-type-system-discipline](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/principle-type-system-discipline/SKILL.md) | statically typed code needs semantic types, parsed boundaries and exhaustive variants that rule out invalid states | Implementation, Architecture |

## Workflow and supporting skills

Each skill is grouped under its first catalog category. The last column lists its additional activities, when present. This grouping is for navigation; all catalog categories remain available to the router.

- [Requirements](#requirements)
- [Clarification](#clarification)
- [Code understanding](#code-understanding)
- [Research](#research)
- [Prototyping](#prototyping)
- [Architecture](#architecture)
- [Specification](#specification)
- [Issue tracking](#issue-tracking)
- [Planning](#planning)
- [Work across sessions](#work-across-sessions)
- [Implementation](#implementation)
- [Testing and verification](#testing-and-verification)
- [Debugging](#debugging)
- [Refactoring](#refactoring)
- [Performance](#performance)
- [Security](#security)
- [Review](#review)
- [Independent review](#independent-review)
- [Documentation](#documentation)
- [Pull requests](#pull-requests)
- [Release](#release)
- [Setup](#setup)
- [Communication](#communication)
- [Learning](#learning)
- [Retrospectives](#retrospectives)
- [Context management](#context-management)
- [Skill authoring](#skill-authoring)

### Requirements

Clarify intent, scope and unresolved decisions with the user.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/idea-refine](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/idea-refine/SKILL.md) | raw idea needs divergent then convergent thinking before a plan | — |
| [addyosmani/interview-me](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/interview-me/SKILL.md) | ask is underspecified ("build me X" without for whom or why) | Clarification |
| [mattpocock/grill-me](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grill-me/SKILL.md) | task is vague or a plan needs stress-testing; important decisions are unresolved | Clarification |
| [mattpocock/grill-with-docs](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/grill-with-docs/SKILL.md) | requirements are unclear and the target repo already has GLOSSARY.md or docs/adr/ | Clarification, Documentation |
| [mattpocock/grilling](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grilling/SKILL.md) | called by grill-me or improve-codebase-architecture; a plan or decision needs stress-testing in rounds of questions | Clarification |
| [mattpocock/to-questionnaire](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/to-questionnaire/SKILL.md) | a decision depends on facts held by someone else and needs an asynchronous questionnaire | Clarification |

### Clarification

Resolve a single ambiguity without a full interview.

| Skill | When useful | Also applies to |
|---|---|---|
| [pstack/in-your-own-words](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/in-your-own-words/SKILL.md) | the user wants the agent to restate its understanding of their goal before acting | — |
| [pstack/sharpen](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/sharpen/SKILL.md) | task is roughly clear but the right level of specification is not | — |

### Code understanding

Explain how existing code works or why it is shaped that way.

| Skill | When useful | Also applies to |
|---|---|---|
| [pstack/how](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/how/SKILL.md) | existing code must be understood before changing it; placement or ownership question ("where should this live") | Discovery |
| [pstack/teach](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/teach/SKILL.md) | the user wants to understand what a change or subsystem does, how it works and why it was built that way | Learning |
| [pstack/why](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/why/SKILL.md) | design rationale, regression history or postmortem context is needed | Discovery |

### Research

Gather facts from external primary sources.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/source-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/source-driven-development/SKILL.md) | framework-specific implementation decisions need verification and citations from the official documentation for the installed versions | Implementation |
| [mattpocock/research](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/research/SKILL.md) | a decision waits on facts from external docs or APIs | Discovery |

### Prototyping

Build a throwaway artifact to answer a design question.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/prototype](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/prototype/SKILL.md) | a state model, logic or UI should be sanity-checked before committing to a design | — |

### Architecture

Decide module shape, interfaces and boundaries before code.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/api-and-interface-design](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/api-and-interface-design/SKILL.md) | designing a public API, endpoint or cross-module contract | — |
| [mattpocock/codebase-design](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/codebase-design/SKILL.md) | designing a single module interface or deciding where a seam goes | — |
| [mattpocock/improve-codebase-architecture](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/improve-codebase-architecture/SKILL.md) | looking for deepening opportunities across the codebase, no specific target yet | Refactoring |
| [pstack/architect](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/architect/SKILL.md) | types, signatures and module structure should be sketched before code | Planning |
| [pstack/arena](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/arena/SKILL.md) | **High cost.** Build competing solutions to a complex design or implementation, choose a base and integrate the strongest parts. Useful when comparison justifies repeated implementation, judging, synthesis and verification; requires subagents with isolated outputs. | Prototyping, Implementation |
| [pstack/statechart](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/statechart/SKILL.md) | a stateful system needs a TLA+ model check and a Mermaid chart showing paths to invariant violations | Testing and verification |

### Specification

Write down the expected behavior and boundaries.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/constraint-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/constraint-driven-development/SKILL.md) | the project needs explicit quality thresholds in CONSTRAINTS.md and checks that prevent silently weakening them | Setup |
| [addyosmani/spec-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/spec-driven-development/SKILL.md) | a spec document (PRD) is needed in the repo rather than on the issue tracker | — |
| [mattpocock/to-spec](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/to-spec/SKILL.md) | the conversation already contains the decisions and needs to become a spec issue; spec should be published to the issue tracker (GitHub by default) | Issue tracking |

### Issue tracking

Publish specs or tickets to the issue tracker (GitHub, GitLab, local).

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/triage](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/triage/SKILL.md) | incoming issues or external PRs must be categorised and turned into agent-ready briefs | — |

### Planning

Break work into ordered, implementable tasks.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/deprecation-and-migration](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/deprecation-and-migration/SKILL.md) | an old API, system or production schema needs a staged migration and eventual removal | Refactoring, Release |
| [addyosmani/planning-and-task-breakdown](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/planning-and-task-breakdown/SKILL.md) | spec exists and must be broken into ordered tasks without publishing tickets | — |
| [mattpocock/to-tickets](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/to-tickets/SKILL.md) | a spec exists and must be split into tracer-bullet tickets with blocking edges | Issue tracking |

### Work across sessions

Plan work too large for a single agent session.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/wayfinder](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/wayfinder/SKILL.md) | work is too large for one agent session and the route is still foggy | Planning, Issue tracking |
| [pstack/figure-it-out](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/figure-it-out/SKILL.md) | large migration or ambitious change that needs an auditable playbook | Planning |

### Implementation

Write the code.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/frontend-ui-engineering](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/frontend-ui-engineering/SKILL.md) | building or changing user-facing components, responsive layouts, interaction states or accessibility | — |
| [addyosmani/incremental-implementation](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/incremental-implementation/SKILL.md) | change touches many files and should land in thin verifiable slices | — |
| [addyosmani/observability-and-instrumentation](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/observability-and-instrumentation/SKILL.md) | production features need structured logs, metrics, traces and symptom-based alerts tied to operational questions | — |
| [mattpocock/implement](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/implement/SKILL.md) | a spec or a single ticket is ready to implement in this session | — |
| [mattpocock/implement-spec](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/implement-spec/SKILL.md) | 3+ tickets with at least 2 runnable in parallel, built on an integration branch | — |
| [pstack/make-bot-ui](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/make-bot-ui/SKILL.md) | the user explicitly wants a custom UI that wakes a Grok Bot through a webhook and is reachable over Tailscale | — |
| [pstack/swarm](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/swarm/SKILL.md) | the user explicitly requests parallel coverage, worker races or a swarm with one consolidated report | Discovery |
| [pstack/typescript-best-practices](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/typescript-best-practices/SKILL.md) | the change reads or edits TypeScript or TSX and needs guidance on types, narrowing and runtime boundaries | Review |

### Testing and verification

Drive or verify behavior with tests.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/browser-testing-with-devtools](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/browser-testing-with-devtools/SKILL.md) | browser behavior needs live DOM, console, network, screenshot or profiling evidence through Chrome DevTools MCP | Debugging, Performance |
| [addyosmani/test-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/test-driven-development/SKILL.md) | logic or behavior change needs red-green-refactor | — |
| [mattpocock/tdd](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/tdd/SKILL.md) | behavior can be driven test-first at an agreed seam; bug fix needs a regression test | Implementation |
| [pstack/maintain-formal-verification-skill](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/maintain-formal-verification-skill/SKILL.md) | verified code changed and its project-local formal verification must be checked for drift and rerun | — |
| [pstack/maintain-verification-skill](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/maintain-verification-skill/SKILL.md) | an existing verification skill and feature map need a source audit and live coverage of every feature | — |
| [pstack/tdd](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/tdd/SKILL.md) | bug has an obvious cheap local test target | — |

### Debugging

Find and fix the root cause of a failure.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/debugging-and-error-recovery](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/debugging-and-error-recovery/SKILL.md) | tests fail, build breaks, or behavior regressed | — |
| [mattpocock/diagnosing-bugs](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/diagnosing-bugs/SKILL.md) | something is broken, throwing, failing or slow and the cause is unknown | Performance |

### Refactoring

Restructure code without changing behavior.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/code-simplification](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/code-simplification/SKILL.md) | code works but is harder to read or maintain than it should be | — |
| [pstack/no-comments](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/no-comments/SKILL.md) | the user wants scoped comment cleanup with a fresh reviewer and root-cause fixes for accepted findings | — |

### Performance

Measure and improve speed or resource use.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/performance-optimization](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/performance-optimization/SKILL.md) | performance requirements exist or a regression is suspected | — |
| [pstack/benchmark-checklist](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/benchmark-checklist/SKILL.md) | a measured speedup or regression is about to be reported | — |

### Security

Audit and harden against vulnerabilities.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/security-and-hardening](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md) | change touches auth, user input, queries or data storage, secrets, new dependencies, config, permissions, or external integrations | — |

### Review

General review of a finished change.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/code-review-and-quality](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/code-review-and-quality/SKILL.md) | implementation is complete and needs multi-axis pre-merge review; second review of the same diff on a model from a different provider | — |
| [mattpocock/code-review](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/code-review/SKILL.md) | change should be checked against repo standards and the originating issue/spec; a fixed point (commit, branch, merge-base) is known | — |

### Independent review

Adversarial or blast-radius review with a different purpose than the general review.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/doubt-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/doubt-driven-development/SKILL.md) | non-trivial decisions need fresh-context adversarial checks while correction is still cheap | — |
| [pstack/blast-radius](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/blast-radius/SKILL.md) | small diff you don't trust; need to know what else it could break | — |
| [pstack/interrogate](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/interrogate/SKILL.md) | high-risk change needs adversarial multi-model review | Review |

### Documentation

Record decisions, ADRs and docs.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/documentation-and-adrs](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/documentation-and-adrs/SKILL.md) | architecture decision or public API change must be recorded | — |
| [mattpocock/domain-modeling](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/domain-modeling/SKILL.md) | terminology, GLOSSARY.md or ADRs need writing or editing | — |
| [pstack/show-me-your-work](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/show-me-your-work/SKILL.md) | long-running or unattended work needs a reviewable decision trail with evidence and results | Work across sessions |
| [pstack/technical-writing](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/technical-writing/SKILL.md) | writing or reviewing docs, READMEs, RFCs | — |
| [pstack/unslop](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/unslop/SKILL.md) | existing prose needs editing to remove AI writing patterns while preserving meaning and tone | — |

### Pull requests

Open or describe a pull request.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/git-workflow-and-versioning](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/git-workflow-and-versioning/SKILL.md) | messy working tree must become clean atomic commits before a PR | — |
| [mattpocock/pr](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/pr/SKILL.md) | a PR body must be written | — |

### Release

Prepare a production launch.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/shipping-and-launch](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md) | preparing a production deploy, staged rollout or rollback plan | — |

### Setup

One-time repo configuration a skill depends on.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/ci-cd-and-automation](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/ci-cd-and-automation/SKILL.md) | build or deployment pipelines need automated quality gates, CI test runners or deployment strategies | Release |
| [mattpocock/setup-matt-pocock-skills](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/setup-matt-pocock-skills/SKILL.md) | target repo has no docs/agents/issue-tracker.md and a tracker-config skill is selected | — |
| [mattpocock/wizard](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/wizard/SKILL.md) | a manual setup, credential configuration or cutover needs a guided bash wizard | — |
| [pstack/setup-pstack](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/setup-pstack/SKILL.md) | the user explicitly wants to configure pstack model roles and reasoning budgets | — |

### Communication

Explain a response or report progress and pending decisions plainly.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/wait-what](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/wait-what/SKILL.md) | the user did not understand the last response and wants it explained with context and project terminology | — |
| [pstack/bro](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/bro/SKILL.md) | the user asks for the last response to be restated simply and without jargon | — |
| [pstack/ketchup](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/ketchup/SKILL.md) | the user wants a read-only recap of changes in this chat since their last message and every pending decision | — |
| [pstack/ketchup-video](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/ketchup-video/SKILL.md) | the user explicitly requests a short subtitled video recap of work in this chat and pending decisions | — |

### Learning

Teach a concept or skill through lessons and practice.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/teach](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/teach/SKILL.md) | the user wants a teaching workspace with lessons, practice and a learning record across sessions | — |

### Retrospectives

Extract durable improvements from a completed session or repeated mistakes.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/retro](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/retro/SKILL.md) | a coding session needs a retrospective on navigation, guardrails and agent instructions | — |
| [pstack/correct](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/correct/SKILL.md) | the same classes of agent mistakes have recurred and need structural prevention backed by past examples | Refactoring |
| [pstack/reflect](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/reflect/SKILL.md) | the user explicitly asks to reflect on a non-trivial session and propose durable improvements to existing skills | Skill authoring |

### Context management

Recover, curate or hand off the context needed for agent work.

| Skill | When useful | Also applies to |
|---|---|---|
| [addyosmani/context-engineering](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/context-engineering/SKILL.md) | agent context or rules need curation at session startup, task switches or when output stops following project conventions | Setup |
| [mattpocock/handoff](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/handoff/SKILL.md) | the current conversation must become a compact handoff for a fresh agent | Work across sessions |
| [pstack/recall](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/recall/SKILL.md) | the user wants recent working context on a topic reconstructed from their own history, shared records and live state | Discovery |

### Skill authoring

Create or improve reusable instructions and verification skills.

| Skill | When useful | Also applies to |
|---|---|---|
| [mattpocock/writing-for-agents](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/writing-for-agents/SKILL.md) | writing or editing skills, AGENTS.md, CLAUDE.md or documents consumed by agents | Documentation |
| [pstack/automate-me](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/automate-me/SKILL.md) | the user explicitly wants to capture or refresh their working conventions in a personal mode skill | — |
| [pstack/create-formal-verification-skill](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/create-formal-verification-skill/SKILL.md) | the user wants a project-local skill that verifies a high-impact invariant beyond ordinary test cases | Testing and verification |
| [pstack/create-verification-skill](https://github.com/backnotprop/pstack/blob/ecec42adbe4f240e4ae19d296768445f0dfbd38e/skills/create-verification-skill/SKILL.md) | the project needs a reusable verification skill that drives its real UI, CLI or service and captures evidence | Testing and verification |

## Keeping the index current

Update this document when a reviewed catalog or vendor revision changes: reconcile every catalog ID, its type, activity, description and source link, then refresh the counts. The catalog remains the source of routing metadata. `scripts/update` only reports upstream changes; review those changes before editing the catalog and this index.
