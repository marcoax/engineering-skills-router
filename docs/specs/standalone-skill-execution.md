# Standalone skills and on-demand flow diagrams for Pi and Claude Code

Published as [spec #63](https://github.com/marcoax/engineering-skills-router/issues/63) with `ready-for-agent`. The user confirmed the feature design and test seams. No implementation has started.

## Problem Statement

Users sometimes need one skill for a specific task rather than a composed engineering workflow. They may already know which vendor, personal or project skill they want, or need advice on the best fit. The current router primarily selects and executes workflows; its low-risk direct-work shortcut does not mean running a chosen skill.

Bare skill names can be ambiguous across collections. The catalog currently suppresses personal skills with a vendor namesake, preventing qualified choices from distinguishing them. An unfinished workflow should not have to be resumed or discarded to perform a separate standalone task.

Users also need a graphical explanation of a skill's procedure or the actual workflow. They should be able to request it from Pi and Claude Code without starting execution, introducing another workflow interface or confusing a proposed design with implemented behavior.

## Solution

Add a dedicated `skill-runner` entry point on Pi and Claude Code for standalone skill execution and standalone skill recommendation. Users can name a skill for a task, or receive one justified recommendation with at most two useful alternatives. Advice waits for the user's choice; an explicit execution request already authorizes starting the named skill.

Consider registered vendor, personal and target-project skills. Qualified source/name identifiers are precise; bare names work when unambiguous. Run one primary skill in full, including its required nested calls, without adding router workflow phases. Use the current session model, report in the conversation and add no persistent execution state or automatic resume.

Offer "show me the flow" on request for both a standalone skill and a router workflow. Provide Mermaid source and a browser-viewable SVG. Preserve an existing workflow's state and step notes throughout standalone execution, advice and diagram requests.

## User Stories

1. As a Pi user, I want to run one named skill for a task, so that I can use it without composing a router workflow.
2. As a Claude Code user, I want the same standalone capability, so that changing harness does not change the feature's behavior.
3. As a user, I want a dedicated `skill-runner` entry point, so that I can distinguish standalone work from workflow orchestration.
4. As a user, I want to describe a task and ask which skill fits, so that I do not need to know the catalog beforehand.
5. As a user, I want one recommendation with a task-specific reason, so that I can assess the advice quickly.
6. As a user, I want at most two useful alternatives, so that I can choose without browsing the entire catalog.
7. As a user, I want advice to wait for my choice, so that asking for a recommendation does not start work.
8. As a user, I want an explicit named-skill execution request to start directly, so that I do not repeat authorization merely to begin.
9. As a user, I want qualified vendor skill identifiers, so that the source of the procedure is explicit.
10. As a user, I want unique bare names accepted, so that common invocations remain short.
11. As a user, I want ambiguous names to show eligible matches, so that I can choose the intended source.
12. As a user, I want personal and vendor namesakes independently addressable, so that one does not silently hide the other.
13. As a user, I want registered vendor skills considered, so that one entry point serves the supported collections.
14. As a user, I want registered personal skills considered, so that the runner retains my working conventions.
15. As a project maintainer, I want registered target-project skills considered, so that project knowledge remains available.
16. As a user, I want suitable explicit preferences respected, so that advice reflects my choices without making an unsuitable skill valid.
17. As a user, I want vendor candidates compared on task fit, so that fixed source priority does not hide a better option.
18. As a user, I want recommendations based on actual instructions and source evidence, so that advice reflects what execution entails.
19. As a user, I want the primary skill followed in full, so that its required process is not reduced to a label.
20. As a user, I want required nested calls made visible, so that I understand what the primary skill invokes.
21. As a user, I want suitable orchestrators available, so that standalone selection can use their complete procedures.
22. As a user, I want orchestrators identified in recommendations, so that I understand their broader activity before choosing.
23. As a user, I want the current session model used, so that a standalone task does not introduce workflow phase-model selection.
24. As a user, I want a skill's delegation requirements respected within harness capabilities, so that its execution process remains clear.
25. As a user, I want standalone work beside an unfinished workflow, so that I need not resume or discard unrelated work.
26. As a user, I want existing workflow state and step notes preserved, so that standalone activity does not advance or replace it.
27. As a user, I want standalone project changes considered on workflow resume, so that preserved state is not mistaken for unchanged files.
28. As a user, I want a conversational account of the skill, work and outcome, so that I can inspect the result without another history system.
29. As a user, I want the skill's required documents and artifacts produced, so that a stateless runner does not remove useful output.
30. As a user, I want missing or unusable skills explained, so that I understand why execution cannot start.
31. As a user, I want unmet prerequisites and unsuitable choices reported without silent substitution, so that my explicit choice remains meaningful.
32. As a user, I want alternatives or a workflow suggested when needed, so that I can choose the next action myself.
33. As a user, I want to request a skill's flow diagram, so that I can inspect its procedure before execution.
34. As a user, I want nested calls and conditional paths in the diagram, so that a primary-skill label does not hide its process.
35. As a user, I want diagram requests to remain advisory, so that viewing a procedure does not execute it or its nested skills.
36. As a workflow user, I want a diagram of my actual selected workflow, so that I see my plan rather than a generic backbone.
37. As a workflow user, I want applied swaps, skipped activities and relevant branches represented, so that the drawing matches the current workflow.
38. As a user, I want Mermaid source and a viewable SVG, so that the diagram is editable and graphical.
39. As a Pi or Claude Code user, I want instructions for opening the SVG, so that viewing it does not depend on terminal Mermaid support.
40. As a reader, I want designs distinguished from verified behavior and execution traces, so that a diagram does not overstate its evidence.
41. As a user, I want ordinary diagrams without formal model checking, so that visual explanations remain lightweight.
42. As a maintainer, I want the existing advisory selector reused, so that standalone and workflow advice share one policy.
43. As a maintainer, I want discovery and installation verified on both harnesses, so that the entry point is usable while vendors remain source material.
44. As a maintainer, I want vendor files and user-level agent directories kept read-only during this work, so that repository boundaries are respected.

## Implementation Decisions

- Add a dedicated `skill-runner` skill using native skill invocation and natural-language arguments. Distinguish explicit execution, advice and diagram requests by intent; a new command parser or mandatory keyword language is unnecessary. Ask only for information needed to resolve missing task context or intent.
- Support Pi and Claude Code throughout: discovery, installation guidance, invocation, execution, advice, artifacts and verification. Retain `engineering-router` as the workflow entry point.
- Resolve qualified identifiers against the reviewed vendor catalog, registered personal skills and target-project registrations. Accept a bare name only when exactly one eligible candidate matches. Show ambiguous matches for a user choice. Preserve source boundaries and availability checks.
- Remove the personal/vendor collision behavior that hides a registered personal skill. Reconcile catalog loading, validation and shared selection so both qualified references remain usable. This establishes explicit resolution rather than source override priority.
- Reuse the advisory selector from #60 and the selection principles of #58. Add single-skill output with one default, at most two alternatives, reasons, prerequisites, material cost notes and missing capabilities. Preserve its workflow-selection contract; do not create a second ranking system.
- Compare vendor candidates on task fit, availability, exclusions, project constraints, capabilities and suitable explicit preferences, without fixed vendor priority. Reuse source evidence and read candidate instructions before recommending. Guide references do not make unregistered candidates executable.
- Keep execution out of the advisory selector. The runner presents advice, handles the user's choice and executes the primary skill. An explicit execution request requires no extra approval merely to start; retain approvals and interaction required by the selected skill and the user's scope.
- Follow the primary skill in full, including relative references, required nested calls and orchestrated activities. Make nested calls visible. Allow suitable orchestrators, explaining scope and material cost in recommendations. Add no router workflow phases.
- Use the current session model instead of the workflow phase-model picker. Respect skill-defined delegation within harness capabilities and disclose limitations rather than claiming an unavailable delegation occurred.
- Coexist with an unfinished workflow without creating, replacing, resuming, discarding, recomposing or advancing it, or changing its step notes. If a chosen skill requires such a state change, explain the conflict before proceeding. Authorized execution may change project files; workflow recovery must consider those changes when resumed.
- Keep runner-owned reporting in the conversation: selected skill, work and outcome. Add no persistent standalone state, history or automatic resume. Preserve documents and outputs required by the chosen skill.
- Explain missing skills, unmet prerequisites, unsuitable choices and no-fit results without starting a replacement. Offer useful alternatives or suggest the router workflow and wait for a choice.
- Add on-demand flow requests to standalone and workflow entry points. Derive a known workflow's diagram from actual selected steps and state, reflecting applied swaps, skips and relevant branches. A skill diagram describes documented procedure, nested calls and conditional paths without executing them.
- Return Mermaid source and a browser-viewable SVG. Exercise rendering through generated artifacts; document opening them from both harnesses without requiring native terminal rendering or a new panel. Report unavailable rendering prerequisites or failures rather than claiming an SVG was produced.
- Distinguish proposed behavior, verified implemented behavior and execution traces. Use `pstack/how` when investigating existing code and `pstack/teach` for progressive explanation. Reserve `pstack/statechart` for requested formal checking rather than ordinary diagrams.
- Keep vendor checkouts and user-level agent directories read-only during implementation and verification. Revise repository-owned discovery checks and installation guidance for the intended skill set without exposing all vendor skills as installed entry points.

## Testing Decisions

The main behavioral seam is public invocation of the runner or a workflow flow request against scratch repositories and harmless fixture skills. Observe advice, choices, execution effects, workflow state and generated artifacts. Prefer existing public catalog/candidate commands, scratch-repository selftests, state validation and adapter test patterns to internal interfaces. Model judgment also requires recorded behavioral evaluations and live harness evidence.

- Test external behavior and observable effects, rather than private helper structure, exact instruction wording or exact generated prose. Reuse one scenario matrix across Pi and Claude Code.
- Through public catalog/candidate access, verify qualified IDs, unique names, ambiguity, a personal/vendor namesake, missing registrations, exclusions and unavailable skills. Confirm validation and resolution agree without modifying sources.
- Evaluate clear task fits, applicable preferences, ties, unmet prerequisites and no usable candidate. Extend existing selector cases for single-skill output instead of duplicating its entire suite. Record model and effort; do not assert equal vendor counts or exact prose.
- Use harmless fixture skills with observable task outputs to verify explicit execution, advice followed by user choice, nested calls and orchestrator disclosure. Advice before a choice and diagram-only requests must produce no skill execution effects.
- Snapshot existing workflow state and step notes before and after standalone actions, including paused or unfinished workflows. Confirm unchanged contents and validity through the public state checker. Repeat without existing state and confirm none is created by the runner. Distinguish authorized task artifacts from runner state.
- Request a diagram of a workflow with an applied skill swap, skipped activity and relevant branch, and of a skill with nested and conditional calls. Check meaningful labels and relationships and a valid, viewable SVG rather than full Mermaid or SVG snapshots.
- Verify rendering failure and missing prerequisites are reported without claiming successful SVG output, executing skills or changing workflow state.
- Perform live smoke checks on both harnesses for discovery, native invocation, advice-to-choice, harmless explicit execution and viewing the graphical artifact. Verify current-session execution without workflow model selection. Record delegation limitations. Static checks and adapter tests alone do not establish live acceptance.
- Extend discovery and packaging checks for the new entry point while retaining source-only vendors and the selector's installation contract. During implementation run catalog validation, scratch-repository selftests, Pi adapter tests, Claude Code adapter checks and whitespace validation.

## Out of Scope

- Implementing the feature, creating implementation sub-issues, committing, pushing, opening a PR or deploying as part of writing and publishing this specification.
- A separate selection policy, opaque scores, vendor quotas or automatic discovery of every installed personal skill.
- Runner-owned persistent execution state, history, automatic resume or phase-model selection.
- Redesigning unfinished-workflow recovery, running concurrent router workflows or automatically changing their state.
- Automatically executing advice, diagram requests, alternative skills or suggested workflows.
- Formal model checking for ordinary diagrams, a new workflow panel or a dedicated graphical application.
- Rewriting vendor skills, installing renderer dependencies into vendor checkouts, writing into user-level agent directories or silently applying upstream catalog changes.

## Further Notes

- The user confirmed the complete feature design, including both harnesses and flow diagrams, and explicitly approved the test seams and publication through `to-spec`.
- Published in `marcoax/engineering-skills-router` as [#63](https://github.com/marcoax/engineering-skills-router/issues/63) with `ready-for-agent`; the published body and label were verified. This spec is distinct from selector-only work and does not authorize implementation during publication.
- [#58](https://github.com/marcoax/engineering-skills-router/issues/58) defines vendor-neutral selection. [#60](https://github.com/marcoax/engineering-skills-router/issues/60) supplies the reused advisory selector; coordinate its single-skill contract and prerequisite discovery work rather than duplicating them.
- [#31](https://github.com/marcoax/engineering-skills-router/issues/31) covers context-boundary pause and resume handoff. [#61](https://github.com/marcoax/engineering-skills-router/issues/61) covers workflow selector integration and preservation on resume and recomposition. Preserve those contracts; standalone coexistence and flow artifacts are the additional scope.
- Pi's entry point is `/skill:skill-runner`; Claude Code's is `/skill-runner`. Example arguments are "usa mattpocock/code-review per verificare queste modifiche", "suggerisci una skill per questo refactor" and "mostrami il flusso di mattpocock/code-review". These are natural-language examples, not mandatory subcommands.
- Mermaid and SVG files are requested document artifacts, not an execution-history store. Workflow diagrams come from state; standalone skill diagrams come from instructions and do not prove execution occurred.
