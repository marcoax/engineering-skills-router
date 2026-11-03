// Context output is available in TUI, print and RPC sessions, independently of the panel.
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { completedStep, configLine, contextLine } from "../claude-code/hooks/context-boundary.ts";

export default function registerContextBoundary(pi: ExtensionAPI) {
	// Independent of the panel: print/RPC sessions get the same boundary output.
	pi.on("tool_result", async (event, ctx) => {
		if (event.toolName !== "bash" || event.isError || typeof event.input.command !== "string") return;
		const output = event.content.filter(c => c.type === "text").map(c => c.text).join("\n");
		const bridge = completedStep(event.input.command, output);
		if (!bridge) return;
		const append = (line: string | undefined) =>
			line ? {content: [...event.content, {type: "text" as const, text: line}], structuredContent: event.structuredContent} : undefined;
		let stdout: string;
		try {
			({ stdout } = await promisify(execFile)("node", [path.resolve(ctx.cwd, bridge)], {timeout: 5000}));
		} catch (e: any) {
			// An unreadable configuration is reported; the state change stands either way.
			return append(configLine(e?.stderr));
		}
		try {
			const usage = ctx.getContextUsage();
			return append(contextLine(usage?.tokens, usage?.contextWindow ?? 0, Number(stdout.trim())));
		} catch {
			// Context reporting must never turn a successful state change into an error.
		}
	});
}
