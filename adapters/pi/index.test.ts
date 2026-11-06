import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// Only host primitives are stubbed: run the real extension, overlay and file polling.
// Hooks are confined to this Node test process; no optional Pi runtime is installed here.
const sources: Record<string, string> = {
 "@earendil-works/pi-tui": `export const Key = {ctrlAlt: k => 'ctrl+alt+' + k};
 export const matchesKey = (data, key) => data === key;
 export const truncateToWidth = (s, width) => s.slice(0, width);
 export const wrapTextWithAnsi = s => [s];`,
 "typebox": `export const Type = {Object: v => v, String: v => v};`,
};
const hooks = registerHooks({
 resolve(specifier, context, next) {
  return sources[specifier] ? { url: `host:${specifier}`, shortCircuit: true } : next(specifier, context);
 },
 load(url, context, next) {
  return url.startsWith("host:") ? { format: "module", source: sources[url.slice(5)], shortCircuit: true } : next(url, context);
 },
});
const { default: adapter } = await import("./index.ts");
hooks.deregister();
const ROOT = path.resolve(import.meta.dirname, "../..");

test("Pi panel forwards personal tick/untick intents, displays only saved state and restores it on reopening", async (t) => {
 const target = fs.mkdtempSync(path.join(os.tmpdir(), "router-panel-"));
 const file = path.join(target, ".router/state.json");
 fs.mkdirSync(path.dirname(file));
 fs.mkdirSync(path.join(target, ".git"));
 const example = fs.readFileSync(path.join(ROOT, "skills/engineering-router/state.md"), "utf8").match(/```json\n([\s\S]*?)```/)![1];
 const state = { ...JSON.parse(example), status: "paused", manual_checklist: [
  { id: "export", action: "Open export as a reader", expected: "Only permitted rows", checked: false },
  { id: "layout", action: "Resize the page", expected: "Controls remain visible", checked: true },
 ] };
 fs.writeFileSync(file, JSON.stringify(state));
 const events = new Map<string, Function>();
 const commands = new Map<string, any>();
 const sent: any[] = [];
 let overlay: any;
 let idle = true;
 let focused = false;
 const ctx = {
  mode: "tui", cwd: target, sessionManager: { getSessionId: () => "session-example" }, isIdle: () => idle,
  ui: {
   setWidget() {}, notify() {},
   custom(factory: Function, options: any) {
    overlay = factory({ requestRender() {}, terminal: { rows: 13 } }, { fg: (_: string, s: string) => s }, {}, () => { overlay = undefined; });
    options.onHandle({ focus: () => { focused = true; }, unfocus: () => { focused = false; }, isFocused: () => focused });
   },
  },
 };
 adapter({
  on: (name: string, fn: Function) => events.set(name, fn),
  registerCommand: (name: string, command: any) => commands.set(name, command),
  registerShortcut() {}, registerTool() {},
  sendUserMessage: (text: string, options?: unknown) => sent.push({ text, options }),
 } as any);
 t.after(() => { events.get("session_shutdown")!(); fs.rmSync(target, { recursive: true, force: true }); });
 events.get("session_start")!({}, ctx);
 const open = () => commands.get("router-panel").handler("", ctx);
 await open();
 assert.equal(focused, true);
 overlay.handleInput("c");
 assert.match(overlay.render(100).join("\n"), /\[ \] 1\. Open export as a reader/);
 assert.match(overlay.render(100).join("\n"), /expected: Only permitted rows/);
 const before = fs.readFileSync(file, "utf8");
 overlay.handleInput("space");
 assert.deepEqual(sent.at(-1), { text: `checklist ${state.run} export on`, options: undefined });
 assert.equal(fs.readFileSync(file, "utf8"), before, "the adapter never writes");
 assert.match(overlay.render(100).join("\n"), /\[ \] 1\. Open export as a reader/, "no optimistic tick");
 const write = (...args: string[]) => spawnSync(path.join(ROOT, "scripts/state"), [target, "reply", sent.at(-1).text, ...args], {
  encoding: "utf8", env: { ...process.env, ENGINEERING_ROUTER_CONFIG: "", XDG_CONFIG_HOME: path.join(target, "config"), ROUTER_SESSION: "session-example" },
 });
 const rejected = write("--session", "intruder");
 assert.notEqual(rejected.status, 0);
 assert.equal(fs.readFileSync(file, "utf8"), before);
 assert.match(overlay.render(100).join("\n"), /\[ \] 1\. Open export as a reader/);
 const accepted = write();
 assert.equal(accepted.status, 0, accepted.stderr);
 await new Promise(resolve => setTimeout(resolve, 1300));
 assert.match(overlay.render(100).join("\n"), /\[x\] 1\. Open export as a reader/);
 idle = false;
 overlay.handleInput("space");
 assert.deepEqual(sent.at(-1), { text: `checklist ${state.run} export off`, options: { deliverAs: "followUp" } });
 overlay.handleInput("down");
 overlay.handleInput("space");
 assert.equal(sent.at(-1).text, `checklist ${state.run} layout off`);
 assert.match(overlay.render(100).join("\n"), /expected: Controls remain visible/);
 await open(); // close
 await open(); // persisted ticks, not transient panel state
 overlay.handleInput("c");
 assert.match(overlay.render(100).join("\n"), /\[x\] 1\. Open export as a reader/);
 // A restarted adapter session reads exactly the persisted run again.
 events.get("session_start")!({}, ctx);
 await open();
 overlay.handleInput("c");
 assert.match(overlay.render(100).join("\n"), /\[x\] 1\. Open export as a reader/);
 // Checklist keys remain available after completion, without enabling workflow actions.
 const completed = { ...state, status: "done", manual_checklist: Array.from({ length: 15 }, (_, i) => ({ id: `p-${i}`, action: `Try action ${i}`, expected: `Result ${i}`, checked: false })) };
 fs.writeFileSync(file, JSON.stringify(completed));
 events.get("session_start")!({}, ctx);
 focused = false;
 await open();
 assert.equal(focused, true);
 const count = sent.length;
 overlay.handleInput("p");
 assert.equal(sent.length, count, "completed workflow actions stay disabled");
 overlay.handleInput("c");
 for (let i = 0; i < 15; i++) {
  assert.match(overlay.render(100).join("\n"), new RegExp(`expected: Result ${i}[^0-9]`));
  overlay.handleInput("space");
  assert.equal(sent.at(-1).text, `checklist ${state.run} p-${i} on`);
  overlay.handleInput("down");
 }
 overlay.handleInput("up");
 overlay.handleInput("space");
 assert.equal(sent.at(-1).text, `checklist ${state.run} p-13 on`);
 overlay.handleInput("c");
 overlay.handleInput("escape");
 assert.equal(focused, false);
});
