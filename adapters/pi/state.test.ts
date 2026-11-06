// Run: node --test adapters/pi/state.test.ts (also run by scripts/selftest).
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { currentStep, detailLines, findRepoRoot, foreignLine, hiddenAtStart, invokesRouter, isForeignAtStart, runsStateScript, keysFor, parseState, readState, replyFor, symbol, widgetLines, type State } from "./state.ts";

// The documented example is the fixture, so the test follows the contract.
const ROOT = path.resolve(import.meta.dirname, "../..");
const doc = fs.readFileSync(path.join(ROOT, "skills/engineering-router/state.md"), "utf8");
const exampleText = doc.match(/```json\n([\s\S]*?)```/)![1];
const example = () => JSON.parse(exampleText);

const parsed = (obj: unknown): State => {
	const p = parseState(JSON.stringify(obj));
	assert.equal(p.kind, "ok");
	return (p as { state: State }).state;
};

test("parses the state.md example", () => {
	const s = parsed(example());
	assert.equal(s.status, "running");
	assert.deepEqual(s.steps.map((x) => x.id), ["specification", "branch", "implementation", "testing", "review"]);
	assert.equal(s.steps[1].skill, null);
	assert.equal(s.steps[3].covered_by, "implementation");
	assert.equal(s.handoff.issue?.number, 42);
});

test("ignores unknown fields and fills optional ones", () => {
	const s = parsed({ version: 1, status: "running", extra: 1, steps: [{ id: "x", status: "pending", new: true }] });
	assert.deepEqual(s.steps[0].alternatives, []);
	assert.equal(s.steps[0].skill, null);
	assert.equal(s.handoff.pr, null);
});

// An issue-free workflow: the spec is a file in the target repo instead of an issue.
const specFile = () => {
	const s = example();
	return { ...s, handoff: { ...s.handoff, issue: null, spec: "docs/specs/csv-export.md", branch: "csv-export" } };
};

test("keeps the spec file of an issue-free workflow", () => {
	assert.equal(parsed(specFile()).handoff.spec, "docs/specs/csv-export.md");
	assert.equal(parsed({ version: 1, status: "running", steps: [] }).handoff.spec, null);
});

test("rejects invalid files without throwing", () => {
	for (const text of ["", "{", "null", "[]", '{"status":"running","steps":[]}', '{"version":1,"steps":[]}', '{"version":1,"status":"running","steps":[{"id":1,"status":"done"}]}']) {
		assert.equal(parseState(text).kind, "invalid", text);
	}
	assert.equal(readState(path.join(os.tmpdir(), "no-such-router-dir")).kind, "invalid");
});

test("other versions are reported, not rendered", () => {
	assert.deepEqual(parseState('{"version":2,"status":"running","steps":[]}'), { kind: "version", version: 2 });
});

test("symbols per status", () => {
	assert.deepEqual(
		["done", "running", "pending", "waiting", "skipped", "failed", "weird"].map((s) => symbol(s)),
		["✓", "▶", "○", "⏸", "–", "✗", "?"],
	);
});

test("widget: one line per step, router and covered labels", () => {
	const lines = widgetLines(parsed(example()));
	assert.equal(lines.length, 6);
	assert.equal(lines[1], "✓ 1. specification  mattpocock/to-spec");
	assert.equal(lines[2], "✓ 2. branch  (router)");
	assert.equal(lines[3], "▶ 3. implementation  mattpocock/implement");
	assert.equal(lines[4], "○ 4. testing  mattpocock/tdd  inside implementation");
	assert.equal(lines[5], "○ 5. review  addyosmani/code-review-and-quality");
});

// A running step stopped by a timeout or quota (state.md Progress) is a recoverable error, not
// active work: its record says so until the step saves progress again.
const interrupted = () => {
	const s = example();
	s.steps[2].progress = { ...(s.steps[2].progress ?? {}), interrupted: { reason: "quota", at: "2026-10-17T09:30:00Z" } };
	return s;
};

test("an interrupted step shows as a recoverable error, not active work", () => {
	const s = parsed(interrupted());
	assert.deepEqual(s.steps[2].interrupted, { reason: "quota", at: "2026-10-17T09:30:00Z" });
	assert.equal(parsed(example()).steps[2].interrupted, null);
	const lines = widgetLines(s);
	assert.equal(lines[0], "router · recoverable error · step 3 implementation interrupted (quota) · Add CSV export to the reports page");
	assert.equal(lines[3], "↻ 3. implementation  mattpocock/implement");
	const details = detailLines(s).lines.join("\n");
	assert.ok(details.includes("recoverable error"), details);
	assert.ok(details.includes("     interrupted (quota): recoverable error, resumes from its progress record"), details);
	assert.ok(!detailLines(parsed(example())).lines.join("\n").includes("interrupted"));
});

test("widget: one line once the workflow is closed", () => {
	const done = example();
	done.status = "done";
	done.handoff.pr = { number: 57, url: "u" };
	assert.deepEqual(widgetLines(parsed(done)), ["✓ router done · PR #57"]);
	const stopped = example();
	stopped.status = "stopped";
	assert.deepEqual(widgetLines(parsed(stopped)), ["– router stopped · 2/5 done"]);
});

test("at session start only finished workflows are hidden", () => {
	const withStatus = (status: string, pr: unknown = null) => parsed({ ...example(), status, handoff: { pr } });
	for (const status of ["selecting", "running", "waiting", "paused"]) assert.equal(hiddenAtStart(withStatus(status)), false, status);
	assert.equal(hiddenAtStart(withStatus("stopped")), true);
	assert.equal(hiddenAtStart(withStatus("done")), true, "done without PR");
	const done = withStatus("done", { number: 57, url: "u" });
	assert.equal(hiddenAtStart(done), false, "PR state unknown");
	assert.equal(hiddenAtStart(done, "OPEN"), false);
	assert.equal(hiddenAtStart(done, "MERGED"), true);
	assert.equal(hiddenAtStart(done, "CLOSED"), true);
	assert.equal(symbol("paused"), "⏸");
});

test("an unfinished workflow at session start is another session's until taken up", () => {
	const withStatus = (status: string) => parsed({ ...example(), status, task: "#956 Admin SEO" });
	for (const status of ["selecting", "running", "waiting", "paused"]) assert.equal(isForeignAtStart(withStatus(status)), true, status);
	for (const status of ["done", "stopped"]) assert.equal(isForeignAtStart(withStatus(status)), false, status);
	assert.equal(
		foreignLine(withStatus("running"), "/skill:engineering-router"),
		"router · running elsewhere · #956 Admin SEO — /skill:engineering-router to resume",
	);
	for (const text of ["/engineering-router", "/skill:engineering-router", "/skill:engineering-router #956", " /engineering-skills-router:engineering-router go"])
		assert.equal(invokesRouter(text), true, text);
	for (const text of ["engineering-router", "/engineering-router-panel", "/router-panel", "resume /engineering-router"]) assert.equal(invokesRouter(text), false, text);
	for (const command of ["scripts/state . show", "node scripts/state /repo reply resume", "/opt/router/scripts/state /repo step 3 done", '"$ROUTER/scripts/state" .'])
		assert.equal(runsStateScript(command), true, command);
	for (const command of ["cat .router/state.json", "scripts/statefile", "git status", "scripts/state-ops.js"]) assert.equal(runsStateScript(command), false, command);
});

test("an unfinished workflow this session owns is its own at session start", () => {
	const s = parsed({ ...example(), owner: { session: "pi-1", since: "2026-10-17T09:30:00Z", previous: null } });
	assert.deepEqual(s.owner, { session: "pi-1", since: "2026-10-17T09:30:00Z" });
	assert.equal(isForeignAtStart(s, "pi-1"), false);
	assert.equal(isForeignAtStart(s, "pi-2"), true);
	assert.equal(isForeignAtStart(s), true);
	const unowned = parsed({ ...example(), owner: null });
	assert.equal(unowned.owner, null);
	assert.equal(isForeignAtStart(unowned, "pi-1"), true);
});

test("replies use the selection syntax with positions in steps", () => {
	const s = parsed(example());
	assert.equal(replyFor(s, { kind: "go" }), "go");
	assert.equal(replyFor(s, { kind: "edit" }), "edit");
	assert.equal(replyFor(s, { kind: "stop" }), "stop");
	assert.equal(replyFor(s, { kind: "pause" }), "pause");
	assert.equal(replyFor(s, { kind: "resume" }), "resume");
	assert.equal(replyFor(s, { kind: "swap", step: 0, alt: 0 }), "1a");
	assert.equal(replyFor(s, { kind: "swap", step: 0, alt: 1 }), undefined);
	assert.equal(replyFor(s, { kind: "swap", step: 1, alt: 0 }), undefined);
	assert.equal(replyFor(s, { kind: "swap", step: 9, alt: 0 }), undefined);
});

// A workflow below high risk: independent-review and verification are optional and start off.
const withOptional = () => {
	const s = example();
	const off = (id: string) => ({ ...s.steps[4], id, covered_by: null, optional: true, status: "skipped", outcome: "off (optional)" });
	return { ...s, status: "selecting", steps: [...s.steps, off("independent-review"), off("verification")] };
};

test("optional steps: read, drawn as skipped, switched on and off", () => {
	const s = parsed(withOptional());
	assert.deepEqual(s.steps.map((x) => x.optional), [false, false, false, false, false, true, true]);
	assert.equal(widgetLines(s)[6], "– 6. independent-review  addyosmani/code-review-and-quality");
	assert.equal(replyFor(s, { kind: "switch", step: 5 }), "6on");
	s.steps[5].status = "pending";
	assert.equal(replyFor(s, { kind: "switch", step: 5 }), "6off");
	assert.equal(replyFor(s, { kind: "switch", step: 0 }), undefined, "not optional");
	assert.equal(replyFor(s, { kind: "switch", step: 9 }), undefined);
	assert.ok(detailLines(s).lines.join("\n").includes("     optional · → off (optional)"));
});

test("details include every step field and the handoff", () => {
	const { lines, stepStart } = detailLines(parsed(example()), 0);
	const text = lines.join("\n");
	for (const part of ["▸ ✓ 1. specification", "why: decisions already settled", "a) addyosmani/spec-driven-development", "→ Published #42", "branch   42-csv-export", "#42 https://github.com/acme/app/issues/42", "needs: gh logged in, to publish the issue", "tie: to-spec and spec-driven-development fit equally; publishing an issue separates them"]) {
		assert.ok(text.includes(part), part);
	}
	assert.ok(!text.includes("asks before starting"), "routine steps need no further confirmation");
	assert.equal(stepStart.length, 5);
	assert.ok(lines[stepStart[3]].includes("testing"));

	const checkpoint = example();
	checkpoint.steps[2].confirm = true;
	checkpoint.steps[2].reason = "user requested a check before implementation";
	const withCheckpoint = detailLines(parsed(checkpoint)).lines.join("\n");
	assert.equal(withCheckpoint.match(/asks before starting/g)?.length, 1, "explicit checkpoints remain visible");
	assert.ok(withCheckpoint.includes(checkpoint.steps[2].reason));
});

test("details show the spec file in place of a missing issue", () => {
	const text = detailLines(parsed(specFile())).lines.join("\n");
	assert.ok(text.includes("  spec     docs/specs/csv-export.md"), text);
	assert.ok(!text.includes("  issue "), "no issue line");
	assert.ok(!detailLines(parsed(example())).lines.join("\n").includes("  spec "), "no spec line with an issue and no spec");
});

test("current step follows the active one", () => {
	const s = parsed(example());
	assert.equal(currentStep(s), 2);
	s.steps[1].status = "running";
	assert.equal(currentStep(s), 1);
});

test("repo root is the nearest .git, else cwd", () => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "router-adapter-"));
	try {
		const sub = path.join(tmp, "repo", "src", "deep");
		fs.mkdirSync(sub, { recursive: true });
		assert.equal(findRepoRoot(sub), sub);
		fs.mkdirSync(path.join(tmp, "repo", ".git"));
		assert.equal(findRepoRoot(sub), path.join(tmp, "repo"));
	} finally {
		fs.rmSync(tmp, { recursive: true, force: true });
	}
});

test("light path: shown in the widget, and only a light workflow can switch to full", () => {
	const light = example();
	light.path = "light";
	light.status = "selecting";
	const s = parsed(light);
	assert.equal(widgetLines(s)[0], "router · selecting · light · Add CSV export to the reports page");
	assert.equal(replyFor(s, { kind: "full" }), "full");
	assert.ok(keysFor(s)?.includes("f full path"));
	const full = parsed({ ...example(), status: "selecting" });
	assert.equal(replyFor(full, { kind: "full" }), undefined);
	assert.ok(!keysFor(full)?.includes("f full path"));
	assert.equal(parsed({ ...example(), path: undefined }).path, null);
});

test("detailLines wraps at a width and keeps each step's indentation", () => {
	const s = parsed(example());
	s.steps[2].skill = "addyosmani/incremental-implementation";
	s.steps[2].summary = "Single sort parser returning a list, multi-form query for list and export, sortRank in payload";
	const width = 45;
	const { lines, stepStart } = detailLines(s, 2, undefined, width);
	for (const line of lines) assert.ok(line.length <= width, `wider than ${width}: ${JSON.stringify(line)}`);
	// Lines inside a step after its head are indented; nothing restarts at column 0 mid-step.
	const body = lines.slice(stepStart[2] + 1, stepStart[3]);
	assert.ok(body.length > 2, "the long summary wraps");
	for (const line of body) assert.match(line, /^ {5}\S/, `continuation not indented: ${JSON.stringify(line)}`);
	assert.ok(lines[stepStart[2]].startsWith("▸"), "the marked head keeps its marker");
	// Words are not cut while they fit the room left after the indent.
	assert.ok(lines.join("\n").includes("multi-form"));
});

test("detailLines without a width leaves lines whole", () => {
	const s = parsed(example());
	s.steps[0].summary = "x ".repeat(80).trim();
	assert.ok(detailLines(s).lines.includes(`     ${s.steps[0].summary}`));
});

test("manual reminders render saved personal ticks and forward run-bound intent without optimistic changes", () => {
 const raw = { ...example(), manual_checklist: [
  { id: "export", action: "Open export as a reader", expected: "Only permitted rows", checked: false },
  { id: "layout", action: "Resize the page", expected: "Controls remain visible", checked: true },
 ] };
 const s = parsed(raw);
 assert.equal(s.run, raw.run);
 assert.deepEqual(s.manual_checklist, raw.manual_checklist);
 assert.deepEqual(parsed(example()).manual_checklist, []);
 const lines = detailLines(s).lines.join("\n");
 assert.match(lines, /Manual checklist · personal reminders, not verification/);
 assert.match(lines, /\[ \] 1\. Open export as a reader/);
 assert.match(lines, /expected: Only permitted rows/);
 assert.match(lines, /\[x\] 2\. Resize the page/);
 assert.equal(replyFor(s, { kind: "checklist", id: "export", checked: true }), `checklist ${raw.run} export on`);
 assert.equal(replyFor(s, { kind: "checklist", id: "layout", checked: false }), `checklist ${raw.run} layout off`);
 assert.equal(s.manual_checklist[0].checked, false);
 assert.equal(replyFor(s, { kind: "checklist", id: "gone", checked: true }), undefined);
 assert.equal(replyFor(parsed({ ...raw, run: undefined }), { kind: "checklist", id: "export", checked: true }), undefined);
 assert.match(keysFor({ ...s, status: "done" }) ?? "", /c checklist/);
 // Malformed optional reminders do not break legacy workflow display or offer wrong actions.
 for (const manual_checklist of [null, {}, [{ id: "bad", action: "Action" }]]) {
  assert.deepEqual(parsed({ ...raw, manual_checklist }).manual_checklist, []);
 }
});
