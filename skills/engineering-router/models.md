# Models

Read from SKILL.md before showing the workflow (§5). It holds which model each step runs on, and how §6 records it.

## Which model a step runs on

`config/preferences.yaml` maps two families to models: `models.claude` (default `claude-bridge/claude-opus-5-5`) and `models.openai` (default `openai-codex/gpt-6-sol`). The provider prefix must match the harness's provider IDs: when the harness names them differently, tell the user to adjust it.

A step subagent runs on the family set as `model` for its first phase, else on `primary` (default `claude`). Pass the model explicitly every time, since subagent defaults may point elsewhere: as `provider/model-id` where the subagent tool takes one, else as the tool's name for that model (Claude Code's Agent tool takes only an alias, such as `opus` for a `claude-opus-*` ID). `effort` (`low` | `medium` | `high`, unset = the harness default) is the thinking level of every step subagent, passed the way the subagent tool takes it (Pi: `provider/model-id:<effort>`). Main-session steps keep the session's model.

**A step's family is the one it actually runs on.** A harness whose subagents run only its own vendor's models (Claude Code: only Claude) runs every step on that family, whatever `primary` or a phase's `model` says: say so once in the workflow (`primary openai, not reachable here: steps run on claude`), and record the model those steps actually run on. Review 2's family: [review-2.md](review-2.md).

Show each step's step model (and effort when set) on its line in §5, as `scripts/state … show` does.

## Step model

Every step that ran records the model it actually ran on in its `model` field, and its effort in `effort`; a step that never ran (pending, or skipped without running) keeps `model` `null`. Sources, first that applies:

1. the step's **agent record**;
2. the model you passed to the step's subagent (as `config/preferences.yaml` names it, also where the tool took only an alias), or the backend `review_other_family` reported;
3. for a main-session step, the session's model as the harness names it (the same ID `scripts/record --session-model` gets).

Effort takes 1, then 2; with neither it stays `null` (the harness default), never the session's. Record each ID verbatim, as its source names it, with no provider prefix added.

When a step starts, pass the model you already know (2 or 3) with `step <n> running --model <id> [--effort <level>]`, so a paused or interrupted step already has one. When it closes (`done` or `failed`), pass `--model` / `--effort` again only when the step printed an agent record for itself; it overwrites the model set at start.

A covered step takes its covering step's model and effort: the script copies them when the covering step starts (if the covered step has no model yet) and when it closes. A covered step with its own agent record is closed separately, after its covering step: `step <id> done --outcome "..." --model <id>`.

## Agent record

A step's own, optional statement of which agent ran it. Any skill may print one; skills without it (every vendor skill today) fall back to sources 2 and 3. Two forms, same fields:

- a line `Agent: <agent name> | <harness> | <model ID> | effort <level>` in the step's output: it belongs to the step that printed it;
- an `agent` field under a step id in the step's YAML handoff (`<step-id>.agent`, e.g. `implementation.agent`): it belongs to the named step, which may be a step it covers.

When a step prints several agent records for itself, the last one wins.
