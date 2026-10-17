# AGENTS.md

- `vendors/` holds third-party git submodules: read them, never edit them. Project metadata about vendor skills lives in `catalog/`.
- Never write into user-level agent directories (`~/.agents/skills`, `~/.claude/skills`, `~/.codex/`, `~/.cursor/`, `~/.pi/`).
- After any change to `catalog/` or `scripts/`, run `scripts/validate-catalog` and `scripts/selftest`; both must pass.
- `scripts/update` only reports upstream changes; catalog edits after an update are a human-reviewed change.
