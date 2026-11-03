import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import adapter from "./context.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Never the maintainer's configuration: no explicit location, an empty XDG config root.
delete process.env.ENGINEERING_ROUTER_CONFIG;
process.env.XDG_CONFIG_HOME = path.join(os.tmpdir(), `router-no-user-config-${process.pid}`);
const fixture = () => {
 const target = fs.mkdtempSync(path.join(os.tmpdir(), "router-boundary-"));
 fs.mkdirSync(path.join(target, ".router"));
 const doc = fs.readFileSync(path.join(ROOT, "skills/engineering-router/state.md"), "utf8");
 fs.writeFileSync(path.join(target, ".router/state.json"), doc.match(/```json\n([\s\S]*?)```/)![1]);
 return target;
};
const hook = () => {
 const handlers = new Map<string, Function>();
 adapter({on: (name: string, fn: Function) => handlers.set(name, fn), registerShortcut() {}, registerCommand() {}} as any);
 return handlers.get("tool_result");
};

test("Pi appends current context to a successful completed router step", async () => {
 const target = fixture();
 try {
  const command = `"${ROOT}/scripts/state" "${target}" step 2 done --outcome "branch ready"`;
  const run = spawnSync(`${ROOT}/scripts/state`, [target, "step", "2", "done", "--outcome", "branch ready"], {encoding: "utf8"});
  assert.equal(run.status, 0, run.stderr);
  const result = await hook()?.({toolName: "bash", input: {command}, isError: false, content: [{type: "text", text: run.stdout}], structuredContent: {kept: true}}, {cwd: target, getContextUsage: () => ({tokens: 162000, contextWindow: 200000, percent: 81})});
  assert.match(result?.content.at(-1).text ?? "", /context: 162000 of 200000 window, threshold 150000/);
  assert.deepEqual(result.structuredContent, {kept: true});
 } finally {fs.rmSync(target, {recursive: true, force: true});}
});

// Each fixture has its own router preferences: target-repo preferences must not win.
for (const [label, preference, tokens, window, expected] of [
 ["inclusive threshold", 162000, 162000, 200000, "context: 162000 of 200000 window, threshold 162000"],
 ["below threshold", 170000, 162000, 200000, undefined],
 ["disabled", 0, 190000, 200000, undefined],
 ["unknown tokens after compaction", 150000, null, 200000, undefined],
 ["unknown usage", 150000, undefined, undefined, undefined],
] as const) {
 test(`Pi boundary: ${label}`, async () => {
  const target = fixture();
  const router = fs.mkdtempSync(path.join(os.tmpdir(), "router checkout-"));
  try {
   fs.cpSync(path.join(ROOT, "scripts"), path.join(router, "scripts"), {recursive: true});
   fs.symlinkSync(path.join(ROOT, "skills"), path.join(router, "skills"));
   fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(router, "node_modules"));
   fs.mkdirSync(path.join(router, "config"));
   fs.writeFileSync(path.join(router, "config/preferences.yaml"), `preferences:\n  context_threshold: ${preference}\n`);
   fs.mkdirSync(path.join(target, "config"));
   fs.writeFileSync(path.join(target, "config/preferences.yaml"), 'preferences:\n  context_threshold: 1\n');
   const command = `node "${router}/scripts/state" "${target}" step --outcome "branch ready" branch done`;
   const run = spawnSync(process.execPath, [path.join(router, "scripts/state"), target, "step", "--outcome", "branch ready", "branch", "done"], {encoding: "utf8"});
   assert.equal(run.status, 0, run.stderr);
   const content = [{type: "text", text: run.stdout}, {type: "image", data: "kept", mimeType: "image/png"}];
   const result = await hook()!({toolName: "bash", input: {command}, isError: false, content}, {cwd: target, getContextUsage: () => window === undefined ? undefined : {tokens, contextWindow: window}});
   assert.deepEqual(result?.content ?? content, expected ? [...content, {type: "text", text: expected}] : content);
  } finally {
   fs.rmSync(target, {recursive: true, force: true});
   fs.rmSync(router, {recursive: true, force: true});
  }
 });
}

// User configuration outside the checkout (docs/configuration.md) reaches the adapter through the bridge.
test("Pi boundary: threshold from an explicit configuration directory", async () => {
 const target = fixture();
 const router = fs.mkdtempSync(path.join(os.tmpdir(), "router checkout-"));
 const config = fs.mkdtempSync(path.join(os.tmpdir(), "router user config-"));
 const saved = process.env.ENGINEERING_ROUTER_CONFIG;
 try {
  fs.cpSync(path.join(ROOT, "scripts"), path.join(router, "scripts"), {recursive: true});
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(router, "node_modules"));
  fs.writeFileSync(path.join(config, "preferences.yaml"), "preferences:\n  context_threshold: 162000\n");
  process.env.ENGINEERING_ROUTER_CONFIG = config;
  const command = `node "${router}/scripts/state" "${target}" step 2 done`;
  const content = [{type: "text", text: "state: step 2 done → workflow running\n"}];
  const result = await hook()!({toolName: "bash", input: {command}, isError: false, content}, {cwd: target, getContextUsage: () => ({tokens: 162000, contextWindow: 200000})});
  assert.equal(result?.content.at(-1).text, "context: 162000 of 200000 window, threshold 162000");
 } finally {
  if (saved === undefined) delete process.env.ENGINEERING_ROUTER_CONFIG; else process.env.ENGINEERING_ROUTER_CONFIG = saved;
  for (const dir of [target, router, config]) fs.rmSync(dir, {recursive: true, force: true});
 }
});

for (const [label, command, output, isError] of [
 ["quoted echo", `echo '${ROOT}/scripts/state /target step 2 done'`, 'state: step 2 done → workflow running\n', false],
 ["failed state call", `${ROOT}/scripts/state /target step 2 done`, 'error: invalid state\n', true],
 ["running step", `${ROOT}/scripts/state /target step 2 running`, 'state: step 2 running → workflow running\n', false],
 ["unrelated state script", '/other/state /target step 2 done', 'state: step 2 done → workflow running\n', false],
] as const) {
 test(`Pi leaves ${label} alone`, async () => {
  const result = await hook()!({toolName: "bash", input: {command}, isError, content: [{type: "text", text: output}]}, {cwd: ROOT, getContextUsage: () => {throw new Error('not a boundary');}});
  assert.equal(result, undefined);
 });
}
