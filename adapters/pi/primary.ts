// The primary question as Pi's select menu: a tool the router calls on a new run before it shows
// the workflow (SKILL.md §5). Options and answer go through `scripts/state <target> primary`,
// the same command as the numbered text question, so the state has one writer.
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import type { Type as TypeBuilder } from "typebox";

const TOOL = "router_primary";

// One option of `scripts/state <target> primary --json`.
type Option = { family: string; label: string; current: boolean };

async function state(root: string, target: string, ...args: string[]): Promise<string> {
	try {
		const { stdout } = await promisify(execFile)("node", [path.join(root, "scripts/state"), target, "primary", ...args], { timeout: 15000 });
		return stdout.trim();
	} catch (e: any) {
		throw new Error((e.stderr || e.message).trim());
	}
}

// `Type` is Pi's TypeBox builder, passed in by index.ts so this module loads without Pi installed.
export default function registerPrimaryQuestion(pi: ExtensionAPI, Type: typeof TypeBuilder) {
	pi.registerTool({
		name: TOOL,
		label: "Router primary family",
		description:
			"Engineering router: ask the user which model family is primary for a new run, before the workflow is shown, and store the answer in .router/state.json. Pi shows a select menu, the current family preselected; without a selector it returns the numbered question for the router to ask.",
		promptGuidelines: [`Use ${TOOL} only when the engineering-router skill says to ask the primary question.`],
		parameters: Type.Object({
			root: Type.String({ description: "The router checkout (repo root) the run works from" }),
			target: Type.String({ description: "The target repo holding .router/state.json" }),
		}),
		async execute(_id, { root, target }, _signal, _update, ctx: Pick<ExtensionToolContext, "hasUI" | "ui">) {
			const reply = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
			if (!ctx.hasUI) {
				const question = await state(root, target);
				return reply(`${question}\nNo selector in this session: ask this numbered question, then run scripts/state ${target} primary <n>.`);
			}
			const options: Option[] = JSON.parse(await state(root, target, "--json"));
			const labels = options.map((o) => o.label);
			const picked = await ctx.ui.select("Primary model family for this run", labels);
			// Dismissing the menu keeps the preselected, current family (listed first).
			const choice = options.find((o) => o.label === picked) ?? options[0];
			return reply(await state(root, target, choice.family));
		},
	});
}
