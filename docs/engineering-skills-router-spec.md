# Engineering Skills Router — Design Rationale

Why the router is shaped the way it is. What it does lives elsewhere, and wins wherever this file disagrees:

- behaviour: [`skills/engineering-router/SKILL.md`](../skills/engineering-router/SKILL.md);
- the state format: [`skills/engineering-router/state.md`](../skills/engineering-router/state.md);
- skills, phases and rankings: [`catalog/`](../catalog/);
- install and use: the [README](../README.md); open ideas: [`backlog.md`](backlog.md).

The 1240-line V1 spec and its V2 decisions this file replaces are in git history (`git log -- docs/engineering-skills-router-spec.md`).

## The question

Skill collections (pstack, Matt Pocock, Addy Osmani) overlap and none covers every phase well. The router never asks "which collection is best?" but "which skill fits this step of this task?". Collections are a shared toolbox, not rival frameworks.

## Smallest useful workflow

Running every fitting skill costs time, tokens and user attention for little extra confidence. So the router picks one skill per required phase and drops what the task does not need.

- **Low risk stops.** A small task gets no workflow: the router says so and offers to do it directly. The flow is for medium and high risk, where a spec, an issue and reviews pay for themselves.
- **One default flow, trimmed by type.** Requirements → spec + issue → tickets → implementation → reviews → PR. Task type changes only the front (debugging, code-understanding); the part from branch to PR stays the same, so every workflow ends the same way.
- **Requirements runs after code-understanding**, so its questions build on what the code shows.
- **Task correctness decides the phases.** Preferences only rank skills; they never add or remove a phase, so a favourite skill cannot inflate a small task.

## Isolation

The router must never change what the user installed.

- Vendor collections are git submodules in `vendors/`, pinned and never edited. Project metadata about them lives in `catalog/`, so an upstream change cannot silently change routing.
- Nothing is written to user-level agent folders (`~/.claude/skills`, `~/.agents/skills`, …). The router reads vendor skills from `vendors/`, never from installed copies, which may be outdated or edited.
- **Two exceptions, both explicit.** Project skills (`docs/agents/skills.yaml` in the target repo) are the project's own conventions; in v1 they fill only `framework-review`. Personal skills (`config/personal-skills.yaml`) are the user's own: read in place, never written, not pinned, since editing one is the user's choice. Neither may stand in for a vendor skill: a personal skill named like a cataloged vendor skill is skipped.
- Vendor and project skills are third-party or repository content: any script they ship is shown before it runs.

## The catalog is the interface

The router reads only the catalog, never the vendor folders' layout. Adding a source is a catalog change with no router change ([adding-a-source.md](adding-a-source.md)).

- `use_when`, `avoid_when` and `complexity` let the agent judge fit; `invokes` records which skills a skill runs itself.
- A **ranking** names the default and fallbacks per phase. It is not a quality verdict: the router may pick a lower candidate when the task clearly fits it better, and says why.
- Candidate order is user preference → preferred → fallback → other. A preference wins only when it fits.
- **Verify, don't invent.** A candidate is usable only when its `SKILL.md` exists. With no usable candidate the phase is reported missing; the router never improvises a replacement. `validate-catalog` also checks that every skill a vendor skill calls is cataloged, so a default step never depends on what happens to be installed.
- **Updates are proposals.** `scripts/update` only reports upstream changes. The agent proposes a catalog diff and applies it after the user confirms.

## No duplicate work

- A phase covered by a skill that `invokes` another (e.g. `implement` runs `tdd` and `code-review`) is not run again.
- A skill that fills two phases (e.g. spec + issue) is one step.
- **Two reviews are not a duplicate** when they differ in model and axes: review 2 runs a different review skill on the other model family, and a comparison step merges both into found by both, by one only, and disagreements. Framework-review and the independent review at high risk add different purposes, not repeats.
- **Cross-family review depends on the harness.** Reaching the other family needs subagents that take an explicit model and a provider configured for it (Pi so set up is one example), which the router cannot provide. So it states before the workflow starts whether review 2 can run there, and when not the user skips it or runs it on the current model, where it counts as a second review, not an independent one.

## Pauses only where they matter

The user approves the workflow once, then is asked again only before outward-facing actions (issue, tickets, PR) and before implementation starts. Everything else runs, apart from pauses the vendor skills define themselves. After implementation the user may check the result before the reviews. The router stops at the open PR: merging stays with the user.

## Issues are optional

GitHub issues are the default handoff, but a spec skill that writes a file makes the workflow issue-free. Then every step takes skills that need no tracker, and the spec file takes the issue's place. Choosing that spec skill in preferences is the whole switch, so no second flow has to be kept in sync.

## Fresh context per step

Each skill step runs in its own subagent when the harness has them, so the main session holds the workflow, not every step's working detail. Steps that talk with the user (requirements, specification, setup) stay in the main session, because they draw on the conversation. Step notes in `.router/steps/` carry what later steps and a resumed session need.

## State as the seam

The router writes `.router/state.json` in the target repo, a versioned format with one writer. Adapters only read it and send user choices back as chat messages in the router's own syntax. So the skill stays agent-neutral, any UI is optional, and a workflow can resume in a new session. `scripts/check-state` validates the file against `state.md`, because a model-written file drifts.

## Agent-neutral core

The router is one Markdown skill plus Node scripts (the `yaml` package is the only dependency). It installs through the skills CLI, as a Pi package, or from a clone. An installed copy is only a bootstrap: it finds a full checkout and follows that checkout's `SKILL.md`, so instructions, catalog and scripts always match. Agent-specific UI lives in `adapters/` (Pi today).

## Gates

After any change to `catalog/` or `scripts/`, `scripts/validate-catalog` and `scripts/selftest` must pass ([AGENTS.md](../AGENTS.md)). The selftest works on a scratch copy, so it never touches the real catalog or config.

## Left out on purpose

- **Scoring formulas** for candidates: fit is judged from `use_when`, `avoid_when` and the task.
- **Stack detection**: a project that wants framework-review lists its own skill.
- **Learning from past workflows**, and adapters for other agents: candidates for [`backlog.md`](backlog.md) when there is a concrete need.
