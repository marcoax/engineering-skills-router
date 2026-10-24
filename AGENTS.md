# AGENTS.md

- `vendors/` holds third-party git submodules: read them, never edit them. Project metadata about vendor skills lives in `catalog/`.
- Never write into user-level agent directories (`~/.agents/skills`, `~/.claude/skills`, `~/.codex/`, `~/.cursor/`, `~/.pi/`).
- The pre-commit hook (`.githooks/pre-commit`, installed by `scripts/setup`) runs `scripts/validate-catalog`, `scripts/selftest` and the adapter tests; all must pass.
- `scripts/update` only reports upstream changes; catalog edits after an update are a human-reviewed change.
