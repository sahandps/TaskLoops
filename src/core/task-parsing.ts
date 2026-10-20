import type { ScannedTask } from "./types";
import { parseSchedule } from "./schedule";

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
	return (h >>> 0).toString(36).padStart(7, "0") + (g >>> 0).toString(36).padStart(7, "0");
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
	const tagRe = new RegExp("(^|\\s)#" + escapeRegex(bare) + "(\\/[^\\s#]+)?(?=$|\\s|[.,;:!?)\\]])", "gi");
	t = t.replace(tagRe, "$1");

	t = t.replace(/\s+/g, " ").trim();
	// Removing a mid-sentence tag can strand a space before punctuation.
	return t.replace(/\s+([.,;:!?])/g, "$1").trim();
}

/** True when `tag` is the configured tag or a child of it (`#task/work`). */
export function tagMatches(tag: string, configured: string): boolean {
	const a = tag.toLowerCase();
	const b = (configured.startsWith("#") ? configured : "#" + configured).toLowerCase();
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
export function taskIndent(raw: string): number {
	return indentOf(raw.replace(/^([ \t]*)(?:>[ \t]?)+/, "$1"));
}

/** Return a Markdown task's checked state, or null when the line is not a task. */
export function checkboxState(line: string): boolean | null {
	const match = line.match(/^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)\[(.)\]/);
	if (!match) return null;
	return match[1] !== " ";
}

/** Return a line with only its checkbox state character changed to `x`. */
export function markCheckboxDone(line: string): string {
	return line.replace(
		/^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+))\[(.)\]/,
		(_whole, prefix: string) => `${prefix}[x]`,
	);
}

export function taskId(path: string, text: string, occurrence: number): string {
	const key = path + "\u0000" + text.toLowerCase() + (occurrence > 0 ? "\u0000" + occurrence : "");
	return hash(key);
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
