# Backlog

Ideas deliberately left out of the current work, each a candidate for its own issue.

## Claude Code adapter for workflow progress

Claude Code has no Pi-style widgets or overlays. Give it an equivalent view of the router workflow: an adapter (`adapters/claude-code/`) that renders `.router/state.json` as a Markdown file (steps, chosen skill, status, alternatives, handoff: issue, branch, PR) that the user can keep open beside the terminal.

Depends on: the `.router/state.json` format defined for the Pi adapter.

## `review_other_family` fails with `invalid_union`

In eraCms #945 the panel tool failed four times in a row, instantly: `tool.call step resolved ... with a result that does not match its output shape: invalid_union`. Review 2 then fell back to a Claude subagent. Under [ADR 0001](adr/0001-single-cross-family-review.md) every review step depends on this tool, so this comes first.

## Run records missing from PRs

Only 5 of the last 10 eraCms router PRs carry an `engineering-router:run` record (945, 949, 951, 954, 961). #959 has a findings table but no record. `scripts/stats` undercounts as a result.

## Step models recorded as null or unknown

The #945 record has `model: null` for most steps that ran, and #961 records the implementation model as "unknown". This breaks the rule that every step that ran has a step model.

## Inconsistent model IDs in records

#954 records the same model as both `gpt-6.1-sol` and `openai-codex/gpt-6.1-sol`. Stats that group by model split one model in two.
