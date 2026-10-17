// Pi adapter for the engineering router: renders `.router/state.json` of the session's
// repo as a widget above the editor and a right-hand overlay with the skill selection.
// It never writes the state file; choices go to the agent as chat messages.
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Key, matchesKey, type OverlayHandle, type TUI, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import {
	type Choice,
	currentStep,
	detailLines,
	findRepoRoot,
	hiddenAtStart,
	isClosed,
	KEYS,
	type Paint,
	readState,
	replyFor,
	STATE_FILE,
	type State,
	widgetLines,
} from "./state.ts";

const SHORTCUT = Key.ctrlAlt("w");
const WIDGET = "engineering-router";

const paintWith = (theme: Theme): Paint => (style, text) => theme.fg(style, text);

class RouterOverlay implements Component {
	handle: OverlayHandle | undefined;
	private selected = 0;
	private top = 0;
	private confirmStop = false;
	private status: string | undefined;
	private tui: TUI;
	private theme: Theme;
	private getState: () => State | undefined;
	private send: (choice: Choice) => void;
	close: () => void;

	constructor(tui: TUI, theme: Theme, getState: () => State | undefined, send: (choice: Choice) => void, close: () => void) {
		this.tui = tui;
		this.theme = theme;
		this.getState = getState;
		this.status = getState()?.status;
		this.send = send;
		this.close = close;
	}

	private choosing(state: State): boolean {
		return state.status === "selecting" && this.handle?.isFocused() === true;
	}

	// Called on every state file change; a new status hands the keyboard back to the editor.
	update(state: State): void {
		this.selected = Math.min(this.selected, Math.max(0, state.steps.length - 1));
		if (state.status !== this.status) {
			this.confirmStop = false;
			if (this.handle?.isFocused()) this.handle.unfocus();
		}
		this.status = state.status;
		this.tui.requestRender();
	}

	// Only reached while the overlay has focus, i.e. in a status with KEYS.
	handleInput(data: string): void {
		const state = this.getState();
		if (matchesKey(data, SHORTCUT)) return this.close();
		const status = state?.status ?? "";
		if (matchesKey(data, "escape")) {
			this.confirmStop = false;
			this.handle?.unfocus();
		} else if (!state || !KEYS[status]) {
			return;
		} else if (this.confirmStop) {
			this.confirmStop = false;
			if (matchesKey(data, "x")) this.send({ kind: "stop" });
		} else if (matchesKey(data, "p") && status !== "paused") {
			this.send({ kind: "pause" });
			this.handle?.unfocus();
		} else if (matchesKey(data, "r") && status === "paused") {
			this.send({ kind: "resume" });
			this.handle?.unfocus();
		} else if (matchesKey(data, "x") && (status === "selecting" || status === "paused")) {
			this.confirmStop = true;
		} else if (status !== "selecting") {
			return;
		} else if (matchesKey(data, "up")) {
			this.selected = Math.max(0, this.selected - 1);
		} else if (matchesKey(data, "down")) {
			this.selected = Math.min(state.steps.length - 1, this.selected + 1);
		} else if (matchesKey(data, "enter")) {
			this.send({ kind: "go" });
		} else if (matchesKey(data, "a") || matchesKey(data, "b")) {
			this.send({ kind: "swap", step: this.selected, alt: matchesKey(data, "a") ? 0 : 1 });
		} else if (matchesKey(data, "o")) {
			this.send({ kind: "switch", step: this.selected });
		} else if (matchesKey(data, "e")) {
			this.send({ kind: "edit" });
		}
		this.tui.requestRender();
	}

	render(width: number): string[] {
		const state = this.getState();
		if (!state) return [];
		const th = this.theme;
		const paint = paintWith(th);
		const inner = Math.max(10, width - 2);
		const choosing = this.choosing(state);
		const { lines, stepStart } = detailLines(state, choosing ? this.selected : -1, paint);

		// Header and handoff stay pinned; only the steps scroll.
		const wrap = (line: string) => wrapTextWithAnsi(line, inner - 1).map((l) => ` ${l}`);
		const split = stepStart[0] ?? lines.length;
		const pinned = lines.slice(0, split).flatMap(wrap);
		const body: string[] = [];
		const lineAt: number[] = [];
		for (const line of lines.slice(split)) {
			lineAt.push(body.length);
			body.push(...wrap(line));
		}
		const keys = this.handle?.isFocused() ? KEYS[state.status] : undefined;
		const footer = keys
			? this.confirmStop
				? paint("warning", " press x again to stop · any other key cancels")
				: paint("dim", ` ${keys}`)
			: paint("dim", ` ${SHORTCUT} close`);

		// Keep the selected (or active) step in view: 2 border rows and the footer take 3.
		const view = Math.max(3, this.tui.terminal.rows - 3 - pinned.length);
		const anchor = lineAt[(stepStart[choosing ? this.selected : currentStep(state)] ?? split) - split] ?? 0;
		if (anchor < this.top || anchor >= this.top + view) this.top = Math.max(0, anchor - 1);
		this.top = Math.min(this.top, Math.max(0, body.length - view));

		const border = (s: string) => th.fg("border", s);
		const title = " router ";
		return [
			border("╭─") + th.fg("accent", title) + border(`${"─".repeat(Math.max(0, inner - title.length - 1))}╮`),
			...[...pinned, ...body.slice(this.top, this.top + view), footer].map(
				(l) => border("│") + truncateToWidth(l, inner, "…", true) + border("│"),
			),
			border(`╰${"─".repeat(inner)}╯`),
		];
	}

	invalidate(): void {}
}

export default function (pi: ExtensionAPI) {
	let file: string | undefined;
	let root = "";
	let state: State | undefined;
	let warnedVersion: string | undefined;
	let overlay: RouterOverlay | undefined;
	let ui: ExtensionContext["ui"] | undefined;
	// A finished workflow found at session start (hiddenAtStart) stays hidden until a new one begins.
	let hideClosed = false;

	const reload = () => {
		if (!ui) return;
		const parsed = readState(root);
		if (parsed.kind === "version") {
			const v = JSON.stringify(parsed.version);
			if (v !== warnedVersion) ui.notify(`engineering-router: ${STATE_FILE} has version ${v}; this adapter reads version 1`, "warning");
			warnedVersion = v;
		} else {
			warnedVersion = undefined;
		}
		state = parsed.kind === "ok" ? parsed.state : undefined;
		if (state && !isClosed(state)) hideClosed = false;
		const shown = state && !(hideClosed && isClosed(state)) ? state : undefined;
		ui.setWidget(
			WIDGET,
			shown
				? (_tui, theme) => ({
						render: (width: number) =>
							[
								...widgetLines(shown, paintWith(theme)),
								...(shown.status === "selecting" ? [theme.fg("warning", `${SHORTCUT} or /router-panel: choose skills`)] : []),
								...(shown.status === "paused" ? [theme.fg("warning", `${SHORTCUT} or /router-panel: r resume · x stop`)] : []),
							].map((l) => truncateToWidth(l, width)),
						invalidate() {},
					})
				: undefined,
		);
		if (state) overlay?.update(state);
		else overlay?.close();
	};

	const stop = () => {
		if (file) fs.unwatchFile(file);
		overlay?.close();
		ui?.setWidget(WIDGET, undefined);
		file = undefined;
		state = undefined;
		ui = undefined;
	};

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		stop();
		ui = ctx.ui;
		root = findRepoRoot(ctx.cwd);
		file = path.join(root, STATE_FILE);
		const initial = readState(root);
		hideClosed = initial.kind === "ok" && hiddenAtStart(initial.state);
		const pr = initial.kind === "ok" && initial.state.status === "done" ? initial.state.handoff.pr : null;
		if (pr) {
			// Shown while gh answers; hidden only once gh says merged/closed and the same workflow is still there.
			const session = ctx.ui;
			execFile("gh", ["pr", "view", pr.url || String(pr.number), "--json", "state", "-q", ".state"], { cwd: root, timeout: 15000 }, (err, out) => {
				if (err || ui !== session || state?.status !== "done" || state.handoff.pr?.number !== pr.number) return;
				if (!hiddenAtStart(state, out.trim())) return;
				hideClosed = true;
				reload();
			});
		}
		// Polling stat works before `.router/` exists and across whole-file rewrites.
		fs.watchFile(file, { interval: 1000 }, reload);
		reload();
	});
	pi.on("session_shutdown", stop);

	const toggle = (ctx: ExtensionContext) => {
		// With the overlay focused, its handleInput gets the shortcut instead.
		if (overlay) return overlay.close();
		if (!state) return ctx.ui.notify(`engineering-router: no workflow in ${root || ctx.cwd}`, "info");
		const send = (choice: Choice) => {
			const text = state && replyFor(state, choice);
			if (!text) return;
			if (ctx.isIdle()) pi.sendUserMessage(text);
			else pi.sendUserMessage(text, { deliverAs: "followUp" });
		};
		void ctx.ui.custom<void>(
			(tui, theme, _keybindings, done) => {
				const mine: RouterOverlay = new RouterOverlay(tui, theme, () => state, send, () => {
					if (overlay === mine) overlay = undefined;
					done();
				});
				overlay = mine;
				return mine;
			},
			{
				overlay: true,
				overlayOptions: { anchor: "right-center", width: "50%", maxHeight: "100%", nonCapturing: true },
				onHandle: (handle) => {
					if (!overlay) return;
					overlay.handle = handle;
					if (state && KEYS[state.status]) handle.focus();
				},
			},
		);
	};

	pi.registerShortcut(SHORTCUT, { description: "Toggle the engineering router overlay", handler: toggle });
	// Some keyboard layouts (e.g. macOS Terminal with Italian - Pro) send ctrl+alt+z for ctrl+option+w.
	pi.registerCommand("router-panel", { description: "Toggle the engineering router overlay", handler: async (_args, ctx) => toggle(ctx) });
}
