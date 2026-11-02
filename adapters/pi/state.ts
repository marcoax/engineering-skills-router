// File side of the Pi adapter: finds and reads `.router/state.json`. The UI-independent
// logic (parsing, lines, chat replies) lives in the Claude Code mod's state-core.ts, the
// one copy both adapters use: a mod can import only from its own folder, Pi from anywhere.
// No Pi imports, so it runs under plain Node for the tests.
import * as fs from "node:fs";
import * as path from "node:path";
import { parseState, STATE_FILE, type Parsed } from "../claude-code/hooks/state-core.ts";

export * from "../claude-code/hooks/state-core.ts";

// The router writes into the target repo root: walk up to the nearest `.git`, else use cwd.
export function findRepoRoot(cwd: string): string {
	for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, ".git"))) return dir;
		if (path.dirname(dir) === dir) return path.resolve(cwd);
	}
}

export function readState(root: string): Parsed {
	try {
		return parseState(fs.readFileSync(path.join(root, ...STATE_FILE.split("/")), "utf8"));
	} catch {
		return { kind: "invalid" };
	}
}
