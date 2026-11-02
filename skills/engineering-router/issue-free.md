# Issue-free workflow

Read from SKILL.md when the task is an existing spec file (§2), or when the task is not an issue and the specification skill does not fill `issue-tracking` (it writes the spec as a file, §4). Every rule below replaces the issue's part in the workflow.

- Every phase and every alternative takes candidates without `requires: tracker-config`, except **planning** and, after it, **implementation**:
  - **planning**: `mattpocock/to-tickets` breaks the spec file into tickets and publishes them to the configured tracker (GitHub issues, or local files). It is the default when the target repo has `docs/agents/issue-tracker.md`; otherwise `addyosmani/planning-and-task-breakdown` (ordered tasks, nothing published) is the default and `to-tickets` its first alternative, with the reason "publish the tickets; adds the setup step". When the user swaps to it, recompose §2–§4 so the setup step is prepended (SKILL.md §4).
  - **implementation**: `mattpocock/implement-spec` is a candidate only when `to-tickets` is the planning skill, since it builds from published tickets.
  - `to-tickets` fills planning and issue-tracking. When the planning skill publishes nothing, or planning is skipped, nothing fills `issue-tracking`: drop it; it is not missing.
- The spec file takes the issue's place as `handoff.spec`, relative to the target repo: the file given as the task, else the path the specification skill names, else `docs/specs/<slug>.md`, where `<slug>` is a short kebab-case name for the task. Every step that needs the issue or spec (e.g. a review skill) gets this path, together with the published tickets when there are any.
- **specification** has no ⏸, since nothing is published; the skill's own approval gates still apply. With a spec file given as the task there is no specification step: requirements runs only when the file leaves decisions open (SKILL.md §2).
- **branch** is `<slug>`, created once the spec is approved (a spec file given as the task: at the start). Commit the spec file on it first when it is not already committed, so the PR's link resolves.
- **planning** with `to-tickets`: pass it the spec file's path as its reference. There is no parent issue, so the tickets are standalone (no sub-issues), each naming the spec file. Its ⏸ comes before publishing (SKILL.md §6). Record each published ticket with `handoff ticket <n> <url>` (local tickets: the file path as `<url>`).
- **review 2** checks the diff against the spec file.
- **pull request**: the body links the spec file on the branch (`<repo url>/blob/<branch>/<path>`; the bare path when there is no remote), with no `Closes` for the spec. Tickets published on a tracker that closes work through PRs get one `Closes #<n>` each; local tickets get none.
- A later run resumes the workflow when the task names its `handoff.branch` or `handoff.spec` ([resume.md](resume.md)).
