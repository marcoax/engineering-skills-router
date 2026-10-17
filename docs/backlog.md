# Backlog

Ideas deliberately left out of the current work, each a candidate for its own issue.

## Claude Code adapter for workflow progress

Claude Code has no Pi-style widgets or overlays. Give it an equivalent view of the router workflow: an adapter (`adapters/claude-code/`) that renders `.router/state.json` as a Markdown file (steps, chosen skill, status, alternatives, handoff: issue, branch, PR) that the user can keep open beside the terminal.

Depends on: the `.router/state.json` format defined for the Pi adapter.
