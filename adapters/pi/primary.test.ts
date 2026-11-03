// Run: node --test adapters/pi/primary.test.ts (also run by the pre-commit hook).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import registerPrimaryQuestion from "./primary.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CLAUDE = "claude (claude-bridge/claude-opus-5-5)";
const OPENAI = "openai (openai-codex/gpt-6-sol)";

// A router checkout with its own preferences, and a target repo with a new run's state.
const fixture = (status = "selecting") => {
	const router = fs.mkdtempSync(path.join(os.tmpdir(), "router checkout-"));
	fs.cpSync(path.join(ROOT, "scripts"), path.join(router, "scripts"), { recursive: true });
	for (const dir of ["skills", "catalog", "node_modules"]) fs.symlinkSync(path.join(ROOT, dir), path.join(router, dir));
	fs.mkdirSync(path.join(router, "config"));
	fs.writeFileSync(path.join(router, "config/preferences.yaml"), "preferences:\n  primary: claude\n");
	const target = fs.mkdtempSync(path.join(os.tmpdir(), "router-primary-"));
	fs.mkdirSync(path.join(target, ".router"));
	const doc = fs.readFileSync(path.join(ROOT, "skills/engineering-router/state.md"), "utf8");
	const state = JSON.parse(doc.match(/```json\n([\s\S]*?)```/)![1]);
	state.status = status;
	state.primary = "claude";
	if (status === "selecting") for (const s of state.steps) Object.assign(s, { status: "pending", outcome: null, model: null, effort: null });
	fs.writeFileSync(path.join(target, ".router/state.json"), JSON.stringify(state));
	const primary = () => JSON.parse(fs.readFileSync(path.join(target, ".router/state.json"), "utf8")).primary;
	const cleanup = () => [router, target].forEach((d) => fs.rmSync(d, { recursive: true, force: true }));
	return { router, target, primary, cleanup };
};

// Pi lends the extension its TypeBox builder; this stand-in records the schema it is given.
const Type = {
	Object: (properties: object) => ({ type: "object", properties }),
	String: (options: object) => ({ type: "string", ...options }),
};

const tool = () => {
	const tools: any[] = [];
	registerPrimaryQuestion({ registerTool: (t: any) => tools.push(t) } as any, Type as any);
	assert.equal(tools.length, 1);
	return tools[0];
};

test("the tool takes the router checkout and the target repo, both strings", () => {
	const { parameters } = tool();
	assert.equal(parameters.type, "object");
	assert.deepEqual(Object.keys(parameters.properties), ["root", "target"]);
	for (const p of Object.values(parameters.properties) as any[]) assert.equal(p.type, "string");
});

const run = async (f: ReturnType<typeof fixture>, ctx: object) => {
	const result = await tool().execute("call-1", { root: f.router, target: f.target }, undefined, undefined, ctx);
	return result.content.map((c: any) => c.text).join("\n");
};

test("Pi asks the primary question with a select menu, the current family preselected", async () => {
	const f = fixture();
	try {
		const asked: string[][] = [];
		const text = await run(f, { hasUI: true, ui: { select: async (_title: string, options: string[]) => (asked.push(options), OPENAI) } });
		assert.deepEqual(asked, [[CLAUDE, OPENAI]]);
		assert.equal(f.primary(), "openai");
		assert.match(text, /state: primary openai/);
	} finally {
		f.cleanup();
	}
});

test("Pi keeps the current family when the menu is dismissed", async () => {
	const f = fixture();
	try {
		await run(f, { hasUI: true, ui: { select: async () => undefined } });
		assert.equal(f.primary(), "claude");
	} finally {
		f.cleanup();
	}
});

test("without a selector Pi hands the numbered question back to the router", async () => {
	const f = fixture();
	try {
		const text = await run(f, { hasUI: false, ui: { select: async () => assert.fail("no selector without UI") } });
		assert.match(text, new RegExp(`1\\. ${CLAUDE.replace(/[()]/g, "\\$&")}  current\\n2\\. ${OPENAI.replace(/[()]/g, "\\$&")}`));
		assert.match(text, /primary <n>/);
		assert.equal(f.primary(), "claude");
	} finally {
		f.cleanup();
	}
});

test("Pi does not ask once the workflow has started", async () => {
	const f = fixture("running");
	try {
		await assert.rejects(run(f, { hasUI: true, ui: { select: async () => assert.fail("asked on a started run") } }), /before the workflow starts/);
		assert.equal(f.primary(), "claude");
	} finally {
		f.cleanup();
	}
});
