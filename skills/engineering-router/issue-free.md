# Issue-free workflow

Read from SKILL.md §4 when the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file). Every rule below replaces the issue's part in the workflow.

- Every phase and every alternative takes candidates without `requires: tracker-config` (so `addyosmani/planning-and-task-breakdown` for planning, not `mattpocock/to-tickets`, and never `mattpocock/implement-spec`). No skill then fills `issue-tracking`: drop it; it is not missing.
- The spec file takes the issue's place as `handoff.spec`, relative to the target repo: the path the specification skill names, else `docs/specs/<slug>.md`, where `<slug>` is a short kebab-case name for the task. Every step that needs the issue or spec (e.g. a review skill) gets this path.
- **specification** has no ⏸, since nothing is published; the skill's own approval gates still apply.
- **branch** is `<slug>`, created once the spec is approved. Commit the spec file on it first, so the PR's link resolves.
- **review 2** checks the diff against the spec file.
- **pull request**: the body links the spec file on the branch (`<repo url>/blob/<branch>/<path>`; the bare path when there is no remote), with no `Closes`.
- A later run resumes the workflow when the task names its `handoff.branch` or `handoff.spec` ([resume.md](resume.md)).
