import type { ScannedTask } from "./types";
import { assignParents, checkboxState, cleanTaskText, indentOf, taskId } from "./task-parsing";
import { parseSchedule } from "./schedule";

/** Locate checkbox rows without touching Markdown. Skip frontmatter and fenced
 * examples; indented code is excluded unless it is inside a list container. */
export function noteTaskRows(content: string, path: string): ScannedTask[] {
	const lines = content.split("\n"),
		tasks: ScannedTask[] = [],
		occurrences = new Map<string, number>();
	let frontmatter = lines[0]?.replace(/\r$/, "") === "---";
	let fence: { char: string; length: number } | undefined;
	let listDepth: number | undefined;
	let htmlEnd: RegExp | undefined;
	for (let line = 0; line < lines.length; line++) {
		const raw = lines[line],
			plain = raw.replace(/\r$/, "").replace(/^(?:\s*> ?)+/, "");
		if (frontmatter) {
			if (line && /^(---|\.\.\.)\s*$/.test(plain)) frontmatter = false;
			continue;
		}
		if (htmlEnd) {
			if (htmlEnd.test(plain)) htmlEnd = undefined;
			continue;
		}
		const html = plain.match(/^\s*<(pre|code|script|style|textarea)\b/i);
		if (html) {
			const end = new RegExp("</" + html[1] + "\\s*>", "i");
			if (!end.test(plain)) htmlEnd = end;
			listDepth = undefined;
			continue;
		}
		if (/^\s*<!--/.test(plain)) {
			if (!/-->/.test(plain)) htmlEnd = /-->/;
			listDepth = undefined;
			continue;
		}
		const marker = plain.match(/^\s*(`{3,}|~{3,})(.*)$/);
		if (marker) {
			if (listDepth !== undefined && indentOf(plain) <= listDepth) listDepth = undefined;
			if (!fence) fence = { char: marker[1][0], length: marker[1].length };
			else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim())
				fence = undefined;
			continue;
		}
		if (fence) continue;
		if (!plain.trim()) continue;
		const depth = indentOf(plain);
		if (listDepth !== undefined && depth <= listDepth) listDepth = undefined;
		const list = /^\s*(?:[-*+]|\d+[.)])\s+/.test(plain);
		if (depth >= 4 && listDepth === undefined) continue;
		if (list && listDepth === undefined) listDepth = depth;
		const checked = checkboxState(raw);
		if (checked === null) continue;
		const text = cleanTaskText(raw, "#task");
		if (!text) continue;
		const key = text.toLowerCase(),
			occurrence = occurrences.get(key) ?? 0;
		occurrences.set(key, occurrence + 1);
		const parsed = parseSchedule(raw);
		tasks.push({
			...parsed.schedule,
			id: taskId(path, text, occurrence),
			path,
			line,
			raw,
			text,
			indent: depth,
			checked,
			checkbox: true,
			handled: false,
			hasSchedule: !!parsed.suffix,
		});
	}
	assignParents(tasks, lines);
	return tasks;
}

/** Require exact source text; never guess between moved duplicate rows. */
export function locateNoteTask(tasks: ScannedTask[], line: number, raw: string): ScannedTask | undefined {
	const atLine = tasks.find((task) => task.line === line && task.raw === raw);
	if (atLine) return atLine;
	const matches = tasks.filter((task) => task.raw === raw);
	return matches.length === 1 ? matches[0] : undefined;
}
