// UI-independent logic of the Pi adapter: reads `.router/state.json` (format in
// skills/engineering-router/state.md) and turns it into lines and chat replies.
// No Pi imports, so it runs under plain Node for the tests.
import * as fs from "node:fs";
import * as path from "node:path";

export type Ref = { number: number; url: string };
export type Alternative = { skill: string; reason: string };
export type Step = {
	id: string;
	phases: string[];
	skill: string | null;
	reason: string;
	summary: string;
	alternatives: Alternative[];
	confirm: boolean;
	covered_by: string | null;
	model: string | null;
	status: string;
	outcome: string | null;
};
export type State = {
	task: string;
	type: string;
	risk: string;
	properties: string[];
	status: string;
	steps: Step[];
	handoff: {
		issue: Ref | null;
		spec: string | null;
		tickets: Ref[];
		branch: string | null;
		base_commit: string | null;
		pr: Ref | null;
	};
};
export type Parsed = { kind: "ok"; state: State } | { kind: "version"; version: unknown } | { kind: "invalid" };

// Theme colors the lines use; the Pi side maps them to `theme.fg`.
export type Style = "accent" | "muted" | "dim" | "success" | "warning" | "error";
export type Paint = (style: Style, text: string) => string;
const plain: Paint = (_style, text) => text;

export const STATE_FILE = path.join(".router", "state.json");

const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);
const ref = (v: unknown): Ref | null =>
	isObj(v) && typeof v.number === "number" ? { number: v.number, url: str(v.url) } : null;

// Required: version, status, steps[].id, steps[].status. Everything else falls back
// to an empty value; unknown fields are ignored.
export function parseState(text: string): Parsed {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { kind: "invalid" };
	}
	if (!isObj(raw) || !("version" in raw)) return { kind: "invalid" };
	if (raw.version !== 1) return { kind: "version", version: raw.version };
	if (typeof raw.status !== "string" || !Array.isArray(raw.steps)) return { kind: "invalid" };
	const steps: Step[] = [];
	for (const s of raw.steps) {
		if (!isObj(s) || typeof s.id !== "string" || typeof s.status !== "string") return { kind: "invalid" };
		steps.push({
			id: s.id,
			phases: strings(s.phases),
			skill: strOrNull(s.skill),
			reason: str(s.reason),
			summary: str(s.summary),
			alternatives: Array.isArray(s.alternatives)
				? s.alternatives.filter(isObj).map((a) => ({ skill: str(a.skill), reason: str(a.reason) }))
				: [],
			confirm: s.confirm === true,
			covered_by: strOrNull(s.covered_by),
			model: strOrNull(s.model),
			status: s.status,
			outcome: strOrNull(s.outcome),
		});
	}
	const h = isObj(raw.handoff) ? raw.handoff : {};
	return {
		kind: "ok",
		state: {
			task: str(raw.task),
			type: str(raw.type),
			risk: str(raw.risk),
			properties: strings(raw.properties),
			status: raw.status,
			steps,
			handoff: {
				issue: ref(h.issue),
				spec: strOrNull(h.spec),
				tickets: Array.isArray(h.tickets) ? h.tickets.map(ref).filter((r): r is Ref => r !== null) : [],
				branch: strOrNull(h.branch),
				base_commit: strOrNull(h.base_commit),
				pr: ref(h.pr),
			},
		},
	};
}

// The router writes into the target repo root: walk up to the nearest `.git`, else use cwd.
export function findRepoRoot(cwd: string): string {
	for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
		if (fs.existsSync(path.join(dir, ".git"))) return dir;
		if (path.dirname(dir) === dir) return path.resolve(cwd);
	}
}

export function readState(root: string): Parsed {
	try {
		return parseState(fs.readFileSync(path.join(root, STATE_FILE), "utf8"));
	} catch {
		return { kind: "invalid" };
	}
}

const SYMBOLS: Record<string, [string, Style]> = {
	done: ["✓", "success"],
	running: ["▶", "accent"],
	pending: ["○", "muted"],
	waiting: ["⏸", "warning"],
	paused: ["⏸", "warning"],
	skipped: ["–", "dim"],
	failed: ["✗", "error"],
	stopped: ["–", "dim"],
};
export function symbol(status: string, paint: Paint = plain): string {
	const [sym, style] = SYMBOLS[status] ?? ["?", "warning"];
	return paint(style, sym);
}

const skillLabel = (step: Step) => step.skill ?? "(router)";
const inside = (step: Step) => (step.covered_by ? `  inside ${step.covered_by}` : "");
export const isClosed = (state: State) => state.status === "done" || state.status === "stopped";

// Whether a workflow found at session start belongs to the past: stopped, or done with no PR
// or with a merged/closed one. `prState` is gh's PR state; undefined (unknown) keeps it shown.
export function hiddenAtStart(state: State, prState?: string): boolean {
	if (state.status === "stopped") return true;
	if (state.status !== "done") return false;
	return !state.handoff.pr || prState === "MERGED" || prState === "CLOSED";
}

export function widgetLines(state: State, paint: Paint = plain): string[] {
	const doneCount = state.steps.filter((s) => s.status === "done").length;
	if (isClosed(state)) {
		const tail = state.handoff.pr ? `PR #${state.handoff.pr.number}` : `${doneCount}/${state.steps.length} done`;
		return [`${symbol(state.status, paint)} router ${state.status} · ${tail}`];
	}
	return [
		paint("accent", `router · ${state.status}`) + paint("muted", ` · ${state.task}`),
		...state.steps.map(
			(s, i) => `${symbol(s.status, paint)} ${i + 1}. ${s.id}  ${paint("muted", skillLabel(s) + inside(s))}`,
		),
	];
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
export type Choice =
	| { kind: "go" | "edit" | "stop" | "pause" | "resume" }
	| { kind: "swap"; step: number; alt: number };

// Panel keys per workflow status; a status without keys leaves the keyboard to the editor.
export const KEYS: Record<string, string> = {
	selecting: "enter go · ↑↓ step · a/b swap · e edit · p pause · x stop · esc editor",
	running: "p pause after this step · esc editor",
	waiting: "p pause · esc editor",
	paused: "r resume · x stop · esc editor",
};

// Chat reply in the router's selection syntax. `step` and `alt` are 0-based indexes
// into `steps` and that step's `alternatives`; undefined when the swap does not exist.
export function replyFor(state: State, choice: Choice): string | undefined {
	if (choice.kind !== "swap") return choice.kind;
	if (!state.steps[choice.step]?.alternatives[choice.alt]) return undefined;
	return `${choice.step + 1}${LETTERS[choice.alt]}`;
}

export type Detail = { lines: string[]; stepStart: number[] };

// Overlay body: header, handoff (short, so it stays in view), every step with its details. `stepStart[i]` is the
// line where step i begins, for scrolling. `marked` gets a selection marker.
export function detailLines(state: State, marked = -1, paint: Paint = plain): Detail {
	const lines = [
		paint("accent", state.task || "(no task)"),
		paint("muted", [state.type, state.risk, state.properties.join(", "), state.status].filter(Boolean).join(" · ")),
		"",
	];
	const h = state.handoff;
	const refText = (r: Ref | null) => (r ? `#${r.number} ${r.url}`.trim() : "—");
	// An issue-free workflow shows its spec file instead of an empty issue line.
	const issueFree = h.issue === null && h.spec !== null;
	lines.push(
		paint("accent", "Handoff"),
		...(issueFree ? [] : [`  issue    ${refText(h.issue)}`]),
		...(h.spec === null ? [] : [`  spec     ${h.spec}`]),
		`  tickets  ${h.tickets.length ? h.tickets.map((t) => `#${t.number}`).join(", ") : "—"}`,
		`  branch   ${h.branch ?? "—"}`,
		`  base     ${h.base_commit ?? "—"}`,
		`  PR       ${refText(h.pr)}`,
		"",
	);
	const stepStart: number[] = [];
	state.steps.forEach((s, i) => {
		stepStart.push(lines.length);
		const mark = i === marked ? paint("accent", "▸") : " ";
		const head = `${mark} ${symbol(s.status, paint)} ${i + 1}. ${s.id}  ${skillLabel(s)}${inside(s)}`;
		lines.push(i === marked ? paint("accent", head) : head);
		if (s.summary) lines.push(`     ${s.summary}`);
		if (s.reason) lines.push(paint("muted", `     why: ${s.reason}`));
		s.alternatives.forEach((a, j) => lines.push(paint("dim", `     ${LETTERS[j]}) ${a.skill}: ${a.reason}`)));
		if (s.confirm) lines.push(paint("muted", "     asks before starting"));
		if (s.model) lines.push(paint("muted", `     model: ${s.model}`));
		if (s.outcome) lines.push(`     → ${s.outcome}`);
	});
	return { lines, stepStart };
}

// Step the overlay follows when nobody is choosing: the active one, else the first not finished.
export function currentStep(state: State): number {
	const active = state.steps.findIndex((s) => s.status === "running" || s.status === "waiting");
	if (active >= 0) return active;
	const next = state.steps.findIndex((s) => s.status === "pending");
	return next >= 0 ? next : 0;
}
