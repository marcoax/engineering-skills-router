# Engineering Skills Router

The router composes a workflow of skills for an engineering task, runs it step by step, and records what ran on which models.

## Language

**Classification fact**:
A property of the change itself, recorded with evidence from the task or an inspected file, that sets a minimum risk under the classification policy (an authorization, payment or destructive change, sensitive data, a public contract). A word in the task is not a fact.
_Avoid_: keyword, trigger, risk signal

**Classification policy**:
The versioned criteria for type, risk and complexity and the minimum risk each fact sets ([classification.md](skills/engineering-router/classification.md)). A run keeps the revision it was classified under.
_Avoid_: rules, risk score

**Standalone skill execution**:
The execution of one chosen primary skill for a task without composing a router workflow, including any calls to other skills required by its instructions. The primary skill can be named explicitly or chosen through a recommendation.
_Avoid_: direct work (which already means work without a vendor skill)

**Standalone skill recommendation**:
Advice on which skill best fits a task, with a reason and any useful alternatives. A recommendation leaves execution to the user's subsequent choice.
_Avoid_: workflow proposal (for a recommendation of one skill)

**Step model**:
The model a step actually ran on. Every step that ran has one; only a step that did not run has none.
_Avoid_: session model (for a step), default model

**Step result**:
What a delegated step delivers: a JSON object naming the step and its attempt, a verdict (`done`, `fixes` or `blocked`) and the artifacts the step declared. Only an accepted step result lets the step close or the workflow move past it; a skill step that ran in the main session says so with `--main-session`.
_Avoid_: ready marker, completion phrase

**Step boundary**:
The moment after one step has closed and before the next one starts. The step's note and the workflow state are written, so it is the only point where the workflow can pause on purpose and resume in a new session. An interrupted step resumes from its progress record instead.
_Avoid_: checkpoint, mid-step pause

**Run**:
One execution of a workflow, from `compose --new` to its end, identified by `run` in `.router/state.json`. Its step notes start with `run: <run>`; a note of another run is never this run's evidence. A finished or discarded run is archived with its notes in `.router/runs/<run>/`.
_Avoid_: session (a run can outlive one)

**Owner**:
The one session that may change a run's state (`owner.session`), enforced by `scripts/state`. It changes only through `claim` (no owner yet) or an explicit `takeover --previous-closed` ([ADR 0002](docs/adr/0002-workflow-ownership.md)).
_Avoid_: lock holder (the lock lasts one command)

**Progress record**:
What a running step has saved so far: work done, next work, limits, the checkout it saw and the checks it ran, each tied to the content of its scope ([ADR 0003](docs/adr/0003-progress-records.md)). `recover --env` reads it back after an interruption. A step interrupted and not yet resumed is a **recoverable error**: neither active work, nor waiting for a decision, nor done.
_Avoid_: checkpoint (an explicit user checkpoint is a pause), snapshot

**Interrupted step**:
A step whose agent stopped before handing back (timeout, quota, unavailable model). It stays `running`: neither done nor waiting for a decision.
_Avoid_: failed step, crashed step

**Primary family**:
The model family (`claude` or `openai`) a run's steps run on unless their phase sets its own. Each run keeps its own in `.router/state.json`, starting from `primary` in the user's `preferences.yaml`.
_Avoid_: default model, main model

**Primary question**:
The single-select question a new run asks before the workflow is shown, where subagents can run both families: keep the primary family or switch it for this run.
_Avoid_: model picker

**Agent record**:
A step's own statement of which agent ran it, on which harness, model and effort. When present, it is the authority on the step model.
_Avoid_: agent line, attribution

**Cross-family review**:
A code review run by a model of the family opposite to the one that wrote the code under review (the implementation or its fixes). A review on the same family, where the other is unreachable, is a **same-family review** and is never called cross-family.
_Avoid_: review 1, review 2, second review, covered review

**Manual checklist**:
The run's points to try after implementation, each a **checklist point**: an action and its expected result. A tick on a checklist point is the user's personal reminder, not verification evidence.
_Avoid_: personal checklist, manual point, verification checklist
