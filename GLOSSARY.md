# Engineering Skills Router

The router composes a workflow of skills for an engineering task, runs it step by step, and records what ran on which models.

## Language

**Standalone skill execution**:
The execution of one chosen primary skill for a task without composing a router workflow, including any calls to other skills required by its instructions. The primary skill can be named explicitly or chosen through a recommendation.
_Avoid_: direct work (which already means work without a vendor skill)

**Standalone skill recommendation**:
Advice on which skill best fits a task, with a reason and any useful alternatives. A recommendation leaves execution to the user's subsequent choice.
_Avoid_: workflow proposal (for a recommendation of one skill)

**Step model**:
The model a step actually ran on. Every step that ran has one; only a step that did not run has none.
_Avoid_: session model (for a step), default model

**Step boundary**:
The moment after one step has closed and before the next one starts. The step's note and the workflow state are written, so it is the only point where the workflow can pause and resume in a new session without losing work.
_Avoid_: checkpoint, mid-step pause

**Primary family**:
The model family (`claude` or `openai`) a run's steps run on unless their phase sets its own. Each run keeps its own in `.router/state.json`, starting from `primary` in `config/preferences.yaml`.
_Avoid_: default model, main model

**Primary question**:
The single-select question a new run asks before the workflow is shown, where subagents can run both families: keep the primary family or switch it for this run.
_Avoid_: model picker

**Agent record**:
A step's own statement of which agent ran it, on which harness, model and effort. When present, it is the authority on the step model.
_Avoid_: agent line, attribution
