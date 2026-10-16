import { App, TFile } from "obsidian";
import { DateFormat, ScannedTask, Schedule, TaskSource } from "./types";
import { parseSchedule, writeSchedule } from "./schedule";
import { inScanFolder } from "./note-grid";
export * from "./schedule";

export function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches the handled marker in any of its plausible spellings, so a marker
 * written by an older setting (or by hand) is still recognised.
 */
export const HANDLED_RE = /\s*(?:\*|_)\(Handled\)(?:\*|_)/gi;

export function hasHandledMarker(line: string): boolean {
	HANDLED_RE.lastIndex = 0;
	return HANDLED_RE.test(line);
}

export function stripHandledMarker(line: string): string {
	return line.replace(HANDLED_RE, "");
}

/** Stable, order-independent string hash. */
function hash(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) + h) ^ s.charCodeAt(i);
	}
	// A second pass over the reversed string cuts collisions on similar text.
	let g = 52711;
	for (let i = s.length - 1; i >= 0; i--) {
		g = ((g << 5) + g) ^ s.charCodeAt(i);
	}
	return (
		(h >>> 0).toString(36).padStart(7, "0") +
		(g >>> 0).toString(36).padStart(7, "0")
	);
}

/**
 * Reduce a raw line to the sentence a human would call "the task": no list
 * bullet, no checkbox, no heading hashes, no blockquote arrow, no tag, no
 * handled marker, no block id.
 */
export function cleanTaskText(raw: string, tag: string): string {
	let t = stripHandledMarker(parseSchedule(raw).body);
	t = t.replace(/^\s*(?:>\s*)+/, "");
	t = t.replace(/^\s*#{1,6}\s+/, "");
	t = t.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "");
	t = t.replace(/^\s*\[[ xX/-]\]\s*/, "");
	t = t.replace(/\s+\^[\w-]+\s*$/, "");

	const bare = tag.startsWith("#") ? tag.slice(1) : tag;
	const tagRe = new RegExp(
		"(^|\\s)#" + escapeRegex(bare) + "(\\/[^\\s#]+)?(?=$|\\s|[.,;:!?)\\]])",
		"gi"
	);
	t = t.replace(tagRe, "$1");

	t = t.replace(/\s+/g, " ").trim();
	// Removing a mid-sentence tag can strand a space before punctuation.
	return t.replace(/\s+([.,;:!?])/g, "$1").trim();
}

/** True when `tag` is the configured tag or a child of it (`#task/work`). */
function tagMatches(tag: string, configured: string): boolean {
	const a = tag.toLowerCase();
	const b = (
		configured.startsWith("#") ? configured : "#" + configured
	).toLowerCase();
	return a === b || a.startsWith(b + "/");
}

/** Leading whitespace as a column count; a tab counts as four columns. */
export function indentOf(line: string): number {
	let n = 0;
	for (const ch of line) {
		if (ch === " ") n += 1;
		else if (ch === "\t") n += 4;
		else break;
	}
	return n;
}

/** Indentation within the Markdown blockquote container, if present. */
function taskIndent(raw: string): number {
	return indentOf(raw.replace(/^([ \t]*)(?:>[ \t]?)+/, "$1"));
}

/** Return a Markdown task's checked state, or null when the line is not a task. */
export function checkboxState(line: string): boolean | null {
	const match = line.match(
		/^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)\[(.)\]/
	);
	if (!match) return null;
	return match[1] !== " ";
}

/** Return a line with only its checkbox state character changed to `x`. */
export function markCheckboxDone(line: string): string {
	return line.replace(
		/^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+))\[(.)\]/,
		(_whole, prefix: string) => `${prefix}[x]`
	);
}

export function taskId(path: string, text: string, occurrence: number): string {
	const key =
		path + "\u0000" + text.toLowerCase() + (occurrence > 0 ? "\u0000" + occurrence : "");
	return hash(key);
}

/**
 * Find Markdown checkbox tasks, tagged lines, or both in one file.
 *
 * Positions come from Obsidian's own metadata cache rather than a raw text
 * search, which excludes fenced code blocks, inline code, and frontmatter.
 */
export async function scanFile(
	app: App,
	file: TFile,
	tag: string,
	source: TaskSource = "checkboxes"
): Promise<ScannedTask[]> {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return [];

	const lines = new Set<number>();
	if (source !== "tagged") {
		for (const item of cache.listItems ?? []) {
			if (item.task !== undefined) lines.add(item.position.start.line);
		}
	}
	if (source !== "checkboxes") {
		for (const t of cache.tags ?? []) {
			if (tagMatches(t.tag, tag)) lines.add(t.position.start.line);
		}
	}
	if (lines.size === 0) return [];

	const content = await app.vault.cachedRead(file);
	const split = content.split("\n");
	const seen = new Map<string, number>();
	const out: ScannedTask[] = [];

	for (const line of Array.from(lines).sort((a, b) => a - b)) {
		const raw = split[line];
		if (raw === undefined) continue;

		const text = cleanTaskText(raw, tag);
		if (!text) continue; // a bare tag on its own line is not a task

		const key = text.toLowerCase();
		const occurrence = seen.get(key) ?? 0;
		seen.set(key, occurrence + 1);

		const checkbox = checkboxState(raw);
		const parsed = parseSchedule(raw);
		out.push({
			...parsed.schedule,
			hasSchedule: !!parsed.suffix,
			id: taskId(file.path, text, occurrence),
			path: file.path,
			line,
			raw,
			text,
			indent: taskIndent(raw),
			handled: hasHandledMarker(raw),
			checkbox: checkbox !== null,
			checked: checkbox ?? false,
		});
	}

	assignParents(out, split);
	return out;
}

/**
 * Derive parent/child links from indentation, so an outline you already write
 * needs no extra input to become a project and its steps.
 *
 * A task is the child of the nearest preceding task with a smaller indent.
 * Blank lines are transparent, but any non-blank line at column zero that is
 * not itself a task ends the block — otherwise an indented task far below
 * unrelated prose would attach itself to whatever came before.
 */
export function assignParents(tasks: ScannedTask[], lines: string[]): void {
	const stack: Array<{ indent: number; id: string }> = [];
	let prev = -1;

	for (const task of tasks) {
		for (let i = prev + 1; i < task.line; i++) {
			const line = lines[i];
			if (line === undefined || line.replace(/>/g, "").trim() === "") continue;
			if (taskIndent(line) === 0) {
				stack.length = 0;
				break;
			}
		}

		while (stack.length && stack[stack.length - 1].indent >= task.indent) {
			stack.pop();
		}
		task.parentId = stack.length ? stack[stack.length - 1].id : undefined;
		stack.push({ indent: task.indent, id: task.id });
		prev = task.line;
	}
}

export async function scanVault(
	app: App,
	tag: string,
	source: TaskSource = "checkboxes",
	folder = ""
): Promise<Map<string, ScannedTask[]>> {
	const result = new Map<string, ScannedTask[]>();
	for (const file of app.vault.getMarkdownFiles()) {
		if (!inScanFolder(file.path, folder)) continue;
		const tasks = await scanFile(app, file, tag, source);
		if (tasks.length) result.set(file.path, tasks);
	}
	return result;
}

/**
 * Change only the state character inside a Markdown task checkbox. No text,
 * indentation, metadata, or surrounding syntax is rewritten.
 */
export async function setCheckboxDone(
	app: App,
	task: ScannedTask
): Promise<boolean> {
	if (!task.checkbox) return false;
	return rewriteLine(app, task, markCheckboxDone);
}

/**
 * Safely transform one exact task line.
 *
 * The line is re-located by its exact prior text before writing, so an edit
 * that happened between the scan and the click can never cause the marker to
 * land on the wrong line. Nothing else in the file is touched.
 */
export async function rewriteLine(
	app: App,
	task: ScannedTask,
	next: (current: string) => string
): Promise<boolean> {
	const file = app.vault.getAbstractFileByPath(task.path);
	if (!(file instanceof TFile)) return false;

	let changed = false;

	const transform = (data: string): string => {
		const lines = data.split("\n");

		let idx = -1;
		if (lines[task.line] === task.raw) {
			idx = task.line;
		} else {
			// The line moved. Fall back to a unique exact-text match.
			const matches: number[] = [];
			for (let i = 0; i < lines.length; i++) {
				if (lines[i] === task.raw) matches.push(i);
			}
			if (matches.length === 1) idx = matches[0];
		}
		if (idx === -1) return data;

		const current = lines[idx];
		const replacement = next(current);
		if (replacement === current) return data;

		lines[idx] = replacement;
		changed = true;
		return lines.join("\n");
	};

	await app.vault.process(file, transform);
	return changed;
}

export async function setTaskSchedule(app: App, task: ScannedTask, schedule: Schedule, format: DateFormat): Promise<boolean> {
	return rewriteLine(app, task, (raw) => writeSchedule(raw, schedule, format));
}
