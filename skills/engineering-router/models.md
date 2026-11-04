# Models

Read from SKILL.md before showing the workflow (§5). It holds the primary question, which model each step runs on, and how §6 records it.

## Which model a step runs on

The user's `preferences.yaml` (where `scripts/config` says) maps two families to models: `models.claude` (default `claude-bridge/claude-opus-5-5`) and `models.openai` (default `openai-codex/gpt-6-sol`). The provider prefix must match the harness's provider IDs: when the harness names them differently, tell the user to adjust it.

**The run's primary family** is `primary` in `.router/state.json`, the source for every model the run uses once the state exists. The first write takes it from `primary` in the user's `preferences.yaml` (default `claude`); the primary question, or the reply `primary <family>` before `go`, may change it; a recomposition (`scripts/state … compose` without `--new`) keeps it. The run keeps it to the end, resume included. The user's choice lives in the state alone: `preferences.yaml` stays as the user wrote it.

## The primary question

On a new run, once the state is written with status `selecting` and before the workflow is shown, settle which family is primary, where step subagents can run both families: a subagent tool that takes an explicit model, and a provider for each family. Claude Code's subagents run only Claude, so there the run goes straight to the workflow. Settle it once per run, on its first write: a recomposed or resumed run keeps its family.

`primary` in the user's `preferences.yaml` is the user's answer already. Both routes below then ask nothing and print a `primary:` line instead: go straight to the workflow and show, under its `Models:` line, that the family comes from `preferences.yaml` and that the reply `primary <other family>` changes it (SKILL.md §5). Without that setting, they ask:

- **Pi**: call the `router_primary` tool with the repo root and the target repo; it shows a select menu and stores the answer. When it returns a numbered question instead (no selector in this session), ask it as below.
- **Without a selector**: run `scripts/state <target repo> primary`; ask the question it prints, then set the answer with `scripts/state <target repo> primary <n|family>`; an empty answer is `1`, the current family.

The answer, or the preset family, becomes the run's `primary`; the workflow shown next, step models and the reviews' family included, follows it. A `primary <family>` reply before `go` goes through `scripts/state <target repo> reply primary <family>`.

A step subagent runs on the family set as `model` for its first phase in the user's `preferences.yaml`, else on the run's `primary`; `scripts/state <target repo> model <n|id>` prints that model for a step (for a review step, the family opposite to the step that wrote the code, whatever its phase's `model` says). Pass the model explicitly every time, since subagent defaults may point elsewhere: as `provider/model-id` where the subagent tool takes one, else as the tool's name for that model (Claude Code's Agent tool takes only an alias, such as `opus` for a `claude-opus-*` ID). `effort` (`low` | `medium` | `high`, unset = the harness default) is the thinking level of every step subagent, passed the way the subagent tool takes it (Pi: `provider/model-id:<effort>`). Main-session steps keep the session's model.

**A step's family is the one it actually runs on.** A harness whose subagents run only its own vendor's models (Claude Code: only Claude) runs every step on that family, whatever `primary` or a phase's `model` says: say so once in the workflow (`primary openai, not reachable here: steps run on claude`), and record the model those steps actually run on. The review steps' family: [cross-family-review.md](cross-family-review.md).

Show each step's step model (and effort when set) on its line in §5, as `scripts/state … show` does, and the `Models:` line with the run's `primary`, as `show` prints it last.

## Step model

Every step that ran records the model it actually ran on in its `model` field, and its effort in `effort`; a step that never ran (pending, or skipped without running) keeps `model` `null`. Sources, first that applies:

1. the step's **agent record**;
2. the model you passed to the step's subagent (as the user's `preferences.yaml` names it, also where the tool took only an alias), or the backend `review_other_family` reported;
3. for a main-session step, the session's model as the harness names it (the same ID `scripts/record --session-model` gets).

Effort takes 1, then 2; with neither it stays `null` (the harness default), never the session's. Record each ID verbatim, as its source names it, with no provider prefix added.

When a step starts, pass the model you already know (2 or 3) with `step <n> running --model <id> [--effort <level>]`, so a paused or interrupted step already has one. When it closes (`done` or `failed`), pass `--model` / `--effort` again only when the step printed an agent record for itself; it overwrites the model set at start.

A covered step takes its covering step's model and effort: the script copies them when the covering step starts (if the covered step has no model yet) and when it closes. A covered step with its own agent record is closed separately, after its covering step: `step <id> done --outcome "..." --model <id>`.

## Agent record

A step's own, optional statement of which agent ran it. Any skill may print one; skills without it (every vendor skill today) fall back to sources 2 and 3. Two forms, same fields:

- a line `Agent: <agent name> | <harness> | <model ID> | effort <level>` in the step's output: it belongs to the step that printed it;
- an `agent` field under a step id in the step's YAML handoff (`<step-id>.agent`, e.g. `implementation.agent`): it belongs to the named step, which may be a step it covers.

When a step prints several agent records for itself, the last one wins.
