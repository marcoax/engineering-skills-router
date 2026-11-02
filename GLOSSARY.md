# Engineering Skills Router

The router composes a workflow of skills for an engineering task, runs it step by step, and records what ran on which models.

## Language

**Step model**:
The model a step actually ran on. Every step that ran has one; only a step that did not run has none.
_Avoid_: session model (for a step), default model

**Step boundary**:
The moment after one step has closed and before the next one starts. The step's note and the workflow state are written, so it is the only point where the workflow can pause and resume in a new session without losing work.
_Avoid_: checkpoint, mid-step pause

**Agent record**:
A step's own statement of which agent ran it, on which harness, model and effort. When present, it is the authority on the step model.
_Avoid_: agent line, attribution
