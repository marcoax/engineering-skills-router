// The primary question as Pi's select menu: a tool the router calls on a new run before it shows
// the workflow (SKILL.md §5). Options and answer go through `scripts/state <target> primary`,
// the same command as the numbered text question, so the state has one writer.
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TOOL = "router_primary";

async function state(root: string, target: string, ...args: string[]): Promise<string> {
	try {
		const { stdout } = await promisify(execFile)("node", [path.join(root, "scripts/state"), target, "primary", ...args], { timeout: 15000 });
		return stdout.trim();
	} catch (e: any) {
		throw new Error((e.stderr || e.message).trim());
	}
}

// `parameters` is the TypeBox schema built by index.ts, which loads `typebox` from Pi.
export default function registerPrimaryQuestion(pi: ExtensionAPI, parameters: any) {
	pi.registerTool({
		name: TOOL,
		label: "Router primary family",
		description:
			"Engineering router: ask the user which model family is primary for a new run, before the workflow is shown, and store the answer in .router/state.json. Pi shows a select menu, the current family preselected; without a selector it returns the numbered question for the router to ask.",
		promptGuidelines: [`Use ${TOOL} only when the engineering-router skill says to ask the primary question.`],
		parameters,
		async execute(_id: string, params: { root: string; target: string }, _signal: unknown, _update: unknown, ctx: { hasUI: boolean; ui: { select(title: string, options: string[]): Promise<string | undefined> } }) {
			const question = await state(params.root, params.target);
			const reply = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
			if (!ctx.hasUI) {
				return reply(`${question}\nNo selector in this session: ask this numbered question, then run scripts/state ${params.target} primary <n>.`);
			}
			const [title, ...lines] = question.split("\n");
			const labels = lines.map((l) => l.replace(/^\d+\. /, "").replace(/  current$/, ""));
			// Dismissing the menu keeps the preselected, current family.
			const choice = (await ctx.ui.select(title, labels)) ?? labels[0];
			return reply(await state(params.root, params.target, choice.split(" ")[0]));
		},
	} as any);
}
