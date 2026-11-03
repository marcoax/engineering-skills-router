# Vendor-neutral skill selection before workflow composition

Published as [spec #58](https://github.com/marcoax/engineering-skills-router/issues/58), with the `ready-for-agent` label. Public command/state tests and selector evaluations were confirmed before publication.

## Problem Statement

Users expect the router to propose the skills that best fit their work across all supported vendor collections. Today, fixed preferred and fallback lists make the same skills dominate common phases. Skills from another vendor can remain invisible even when they are suitable, because only two alternatives are shown. Some phases where those skills are preferred are also rarely selected.

The router currently combines deciding which tools fit a task with assembling and executing the workflow. Each vendor already provides useful selection guidance, but those guides are mixed with executable skills in a workflow-selection category. The router does not systematically consult them before making its own selection.

Locally rewritten skill descriptions can also drift from the vendor's actual description. The candidate listing and human-readable index need the same authoritative descriptions as the checked-out vendor skills.

## Solution

Introduce a dedicated skill selector that the engineering router invokes before composing a new workflow or recomposing its remaining work. The selector consults the registered vendor guides, identifies the relevant activities, reads the candidate skills and returns a justified selection. All vendor skills start on equal terms; task fit determines the proposal.

The router consumes that selection, removes redundant work, builds the workflow and retains responsibility for state, user choices and execution. Explicit user preferences and project-specific constraints still apply when suitable.

Register guides separately from executable skills. The initial guide set is Matt Pocock's `ask-matt`, pstack's `poteto-help` and Addy Osmani's `using-agent-skills`. Read skill descriptions directly from the checked-out source repositories. Keep the public skill index linked from the README and organized by type and activity.

For a complex implementation that benefits from competing solutions, offer pstack's `arena` as an alternative with a visible high-cost explanation. The user chooses whether to spend the additional tokens.

## User Stories

1. As a router user, I want vendor skills evaluated on equal terms, so that a fixed vendor preference does not hide a better fit.
2. As a router user, I want the selector to consider the task's objective, risk, complexity and existing project context, so that its recommendations match the work.
3. As a router user, I want phases chosen because the task needs them, so that a useful discovery or architecture step can appear when justified.
4. As a router user, I want a reason for each selected phase and skill, so that I can assess the proposal.
5. As a router user, I want up to two useful alternatives per phase, so that I can choose another approach without reviewing the entire catalog.
6. As a router user, I want equivalent candidates identified as equivalent, so that their display order does not imply a quality advantage.
7. As a router user, I want my explicit skill preferences respected when they fit, so that the selector retains my working conventions.
8. As a router user, I want excluded, missing or unsuitable skills kept out of the executable proposal, so that every proposed step can run.
9. As a project maintainer, I want project skills and framework constraints preserved, so that vendor neutrality does not discard project knowledge.
10. As a router user, I want each vendor's guide consulted during selection, so that the selector uses the collection's own distinctions and recommended applications.
11. As a router user, I want guide consultation to return advice without starting a vendor workflow, so that selection itself remains read-only.
12. As a catalog maintainer, I want guides cataloged separately, so that navigation aids are distinguishable from executable skills and orchestrators.
13. As a router user, I want the actual candidate skill read before it is recommended, so that its full process and side effects are considered.
14. As a router user, I want missing guides or unmet prerequisites reported, so that limitations remain visible.
15. As a router user, I want a named required phase reported as missing when no usable skill fits, so that capability gaps are explicit.
16. As a router user, I want a skill selector that can also explain a selection on its own, so that I can inspect the decision before generating a workflow.
17. As a router user, I want an existing unfinished workflow resumed without silently replacing its selections, so that my previous decisions remain intact.
18. As a router user, I want recomposition to preserve completed work, the primary family and the handoff, so that changing the remaining selection does not restart the run.
19. As a router user, I want `arena` offered for a complex implementation with meaningful competing solutions, so that I can compare independent attempts and synthesize a stronger result.
20. As a router user, I want `arena` clearly marked as high cost before I choose it, so that I understand the extra implementation, judging, synthesis and verification work.
21. As a router user, I want an ordinary implementation retained as the default unless I explicitly choose `arena`, so that high token spending remains intentional.
22. As a router user, I want `arena` omitted when the harness cannot isolate and run candidates, so that the proposal matches available capabilities.
23. As a router user, I want testing and review coverage recalculated after a skill swap, so that selecting an alternative cannot silently remove required checks.
24. As a router user, I want descriptions taken directly from the source skill, so that I read the vendor's current description for the version in use.
25. As a catalog maintainer, I want router-specific metadata separated from source descriptions, so that upstream text has one owner.
26. As a reader, I want the README's skill index organized into guides, orchestrators, principles and workflow or supporting skills, so that I can browse by purpose.
27. As a reader, I want index descriptions and links tied to the same vendor revisions as selection, so that documentation and behavior refer to the same sources.
28. As a maintainer, I want catalog changes and upstream updates to remain reviewable, so that reading source descriptions does not silently rewrite routing metadata.
29. As a maintainer, I want behavioral evidence that each collection can be selected when it fits, so that removing rankings changes actual selection rather than only its presentation.

## Implementation Decisions

- Add a dedicated selector skill with a narrow, advisory interface. It receives the task, target repository context, task classification, explicit user choices and relevant harness capabilities. It returns the required phases, proposed defaults, up to two alternatives per phase, task-specific reasons, prerequisites, cost notes and missing capabilities. Each recommendation identifies a registered skill and its source evidence.
- Invoke selection after the router has resolved its checkout, checked for an unfinished run and gathered sufficient task context, but before it creates the workflow. Resume existing runs as they are; invoke selection again when recomposition is requested. Low-risk direct work retains its existing shortcut.
- Keep selection policy in the selector. The router owns workflow composition, redundancy removal, step models, confirmation points, state transitions and execution. Guide advice informs selection within the router's workflow contract rather than replacing that contract with a vendor's full process.
- Give all vendor candidates equal initial standing. Remove fixed vendor preferred and fallback priorities from the active selection path. Storage, alphabetical and display order must not decide fit. Evaluate objective, applicability, exclusions, complexity, prerequisites, project constraints and cost. Explain the choice; do not introduce opaque numeric scores, vendor quotas or random rotation.
- Preserve suitable explicit user preferences, personal skills and project skills. Framework review continues to use project skills. A preference cannot make an unavailable or unsuitable skill valid, or add a phase that the task does not need.
- Make phase choice responsive to the task, including discovery, clarification and architecture where useful. A normal inspection locating a file alone does not prove that understanding the relevant behavior or design is complete. Keep the smallest useful workflow and explain material additions or omissions.
- Add a distinct guide registry with vendor identity and source path. Its initial entries are `mattpocock/ask-matt`, `pstack/poteto-help` and `addyosmani/using-agent-skills`. Validate guide paths and source ownership, and keep guides out of executable phase candidates. An executable vendor orchestrator such as `pstack/poteto-mode` retains its own role.
- Consult each available registered guide for the current task. Treat it as source material for advisory selection. Follow relevant pointers and read nominated candidate skills in full before recommending them. Confirm candidates against the reviewed catalog and applicable project or personal registrations. A guide cannot make an unregistered skill executable.
- Report missing or unreadable guides and continue using the remaining guides plus the reviewed catalog, with the reduced evidence stated. A missing candidate or unmet hard prerequisite makes that candidate unavailable. If all candidates fail for a required phase, return a missing capability.
- Read each vendor skill's canonical description from the frontmatter of its source skill at the checked-out vendor revision. Use the same source-backed loader for candidate presentation and index generation. Preserve the description text, allowing only parsing, whitespace normalization and output escaping. Do not maintain a separately rewritten or translated canonical description.
- Keep router-owned classifications, applicability signals, exclusions, complexity, dependencies and prerequisites in the reviewed catalog. These are routing metadata and must remain distinguishable from the vendor's description. When a description is missing or malformed, report that condition and let the selector inspect the source; do not invent replacement vendor text.
- Reconcile the human-readable index with the guide registry and reviewed skill catalog. Its descriptions come from source skills, and its source links identify the matching pinned revisions. Preserve browsing by type and activity. Regeneration is an explicit, reviewable maintenance operation and must not rewrite vendor content or routing decisions.
- Offer `pstack/arena` among the available implementation alternatives when complexity is high, independent solutions would resolve a meaningful design uncertainty and the harness supports subagents with isolated outputs. Reserve an alternative slot for it when those conditions hold. Complexity alone is insufficient.
- Show a high-cost note wherever `arena` is proposed. Explain that runners repeat the same task, then incur judging, synthesis and verification work. State the benefit for this task. Keep a single-implementation default unless the user explicitly chooses `arena`. Provide a monetary estimate only when the relevant models, runner count and prices are known.
- Recalculate invoked-skill coverage and separate checks when a user swaps a skill, including a swap from an implementer with integrated testing and review to `arena`. The workflow must reflect what the newly selected skill actually invokes before it can start. Preserve the existing alternative-selection controls and the limit of two alternatives.
- Integrate the selector with supported installation and checkout-resolution paths. The current discovery checks intentionally allow only one router skill; revise those checks to recognize the intended selector without exposing the vendor collections as installed skills. Avoid adding provider-specific execution requirements to advisory selection.
- Keep vendor checkouts and user-level agent directories read-only. Preserve reviewed updates: the upstream update command reports changes, and routing metadata edits remain a human-reviewed change.

## Testing Decisions

The proposed test seams are the public catalog/candidate commands and the generated workflow state, complemented by a small selector evaluation suite. Command and state tests can verify eligibility, source ownership, descriptions and coverage. Evaluations are needed to verify the model's actual choice and reasoning.

- Extend the existing scratch-repository selftest approach. Exercise the public commands against small catalogs, source skills, guide registries and target repositories, rather than asserting private helper structure or exact instruction wording.
- Check that reordering equivalent vendor entries and legacy ranking data leaves the usable candidate set unchanged and never restores a preferred-vendor tier. Explicit suitable preferences and project constraints remain effective; missing and excluded candidates remain ineligible.
- Load descriptions from fixture source skills, including folded and multiline frontmatter, punctuation requiring output escaping, missing descriptions and malformed frontmatter. Change a source description without editing the router metadata and verify that the next candidate listing reflects the source change. Check that index generation uses the same description and source revision.
- Check guide registration, missing paths, invalid source ownership and the boundary between guides and executable candidates. A guide pointing to an uncataloged skill must not make it runnable.
- Feed selector results into workflow composition and validate the resulting state through the existing public state checker. Assert that defaults, alternatives, reasons and cost notes survive presentation and selection. Reject unknown or unusable references at this boundary.
- Exercise selecting `arena` from an implementation with integrated testing and review. Confirm that required independent checks remain in the composed workflow and are not marked complete when only implementation finishes. Repeat with the ordinary implementation selected to verify correct redundancy removal.
- Run task fixtures where each vendor has a clearly appropriate skill, plus tied candidates, a suitable explicit preference, no usable candidate, a missing guide, a simple implementation and a complex implementation with competing designs. Assert required behavior and reasons, not a vendor quota or exact prose. Document ambiguous cases rather than claiming a unique correct answer.
- For the complex implementation fixture, verify a visible high-cost `arena` alternative and an ordinary default. For the simple task, settled design and unavailable-subagent fixtures, verify that `arena` is not promoted automatically.
- Record model and effort for selector evaluations so that judgment evidence can be reproduced and distinguished from deterministic command tests. Evaluations stop at the proposal and must not execute candidate implementations or a paid multi-runner arena.
- Extend the existing discovery and installation checks for the intended additional skill. Run the catalog validator, selftest and relevant adapter tests. Existing widget and text selection controls must continue to present and apply alternatives correctly.

## Out of Scope

- Executing `arena`, implementing this spec, committing, pushing or opening a pull request as part of planning this work.
- Automatically switching to a vendor's full orchestrator, running guide side effects, or launching multiple vendor workflows during selection.
- Equal selection counts per vendor, random rotation, opaque scoring formulas or a learned recommendation system.
- Automatically fetching upstream descriptions over the network on every selection. The checked-out vendor revision is the source in use.
- Automatically applying upstream catalog changes or generating new source skills.
- Rewriting vendor skill descriptions, translating them into a separate canonical text, editing vendor files or installing into user-level agent directories.
- A general redesign of adapters, review models, the primary question, the issue tracker or release behavior.

## Further Notes

- The shared skill index and README link already exist. This work must align that index with source-backed descriptions and the distinct guide registry rather than create a second competing index.
- There are currently 110 cataloged vendor skills. Candidate and guide counts are observations, not hard-coded acceptance requirements.
- Existing changes already add `arena` to implementation candidates, document its cost and introduce a router selection rule. Review and reconcile them during implementation rather than assuming they satisfy this spec.
- The existing source catalog and candidate listing currently expose fixed preferred and fallback ordering. The selector change must retire that behavior coherently across command output, instructions, examples and tests.
- Published in `marcoax/engineering-skills-router` on GitHub, with the existing `ready-for-agent` label. The user approved the spec and test seams, and authorized the implementation sub-issues below. All four are linked as native sub-issues of #58, with native blocking relationships.

### Implementation slices

1. [#59: Source-backed descriptions, a distinct guide registry and a consistent browsable index](https://github.com/marcoax/engineering-skills-router/issues/59). No blockers.
2. [#60: A standalone, advisory selector preview with vendor-neutral recommendations and behavioral evaluations](https://github.com/marcoax/engineering-skills-router/issues/60). Blocked by #59.
3. [#61: Router integration, retirement of active vendor rankings, recomposition and correct coverage after swaps](https://github.com/marcoax/engineering-skills-router/issues/61). Blocked by #60.
4. [#62: A high-cost arena implementation alternative with capability checks and an end-to-end selection/swap scenario](https://github.com/marcoax/engineering-skills-router/issues/62). Blocked by #61.

Each slice includes its own user-visible behavior and regression evidence. The selector preview is inspectable independently before the router integration changes live composition. Existing workflows remain resumable throughout.
