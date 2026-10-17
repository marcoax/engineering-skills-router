// Run: node --test adapters/pi/state.test.ts (also run by scripts/selftest).
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { currentStep, detailLines, findRepoRoot, hiddenAtStart, parseState, readState, replyFor, symbol, widgetLines, type State } from "./state.ts";

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
	assert.deepEqual(s.steps.map((x) => x.id), ["specification", "branch", "implementation", "review-1"]);
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
	assert.equal(lines.length, 5);
	assert.equal(lines[1], "✓ 1. specification  mattpocock/to-spec");
	assert.equal(lines[2], "✓ 2. branch  (router)");
	assert.equal(lines[3], "▶ 3. implementation  mattpocock/implement");
	assert.equal(lines[4], "○ 4. review-1  mattpocock/code-review  inside implementation");
});

test("widget: one line once the workflow is closed", () => {
	const done = example();
	done.status = "done";
	done.handoff.pr = { number: 57, url: "u" };
	assert.deepEqual(widgetLines(parsed(done)), ["✓ router done · PR #57"]);
	const stopped = example();
	stopped.status = "stopped";
	assert.deepEqual(widgetLines(parsed(stopped)), ["– router stopped · 2/4 done"]);
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

test("details include every step field and the handoff", () => {
	const { lines, stepStart } = detailLines(parsed(example()), 0);
	const text = lines.join("\n");
	for (const part of ["▸ ✓ 1. specification", "why: decisions already settled", "a) addyosmani/spec-driven-development", "→ Published #42", "asks before starting", "branch   42-csv-export", "#42 https://github.com/acme/app/issues/42"]) {
		assert.ok(text.includes(part), part);
	}
	assert.equal(stepStart.length, 4);
	assert.ok(lines[stepStart[3]].includes("review-1"));
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
