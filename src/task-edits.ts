import type { DateFormat, ScannedTask, Schedule } from "./types";
import { appendTask, parseSchedule, writeSchedule } from "./schedule";
import { indentOf } from "./scanner";

const TASK_PREFIX = /^([ \t]*(?:>[ \t]*)*)(?:[-*+]|\d+[.)])[ \t]+\[.\][ \t]*/;

/** Editable wording retains inline Markdown and tags; block ids stay protected. */
export function taskWording(raw: string): string {
	return parseSchedule(raw).body.replace(TASK_PREFIX, "");
}

export function locateTask(content: string, task: ScannedTask): number {
	const lines = content.split("\n");
	if (lines[task.line] === task.raw) return task.line;
	const matches = lines.flatMap((line, index) => line === task.raw ? [index] : []);
	if (matches.length === 1) return matches[0];
	throw new Error("The task changed or moved ambiguously. Refresh and try again.");
}

function depth(raw: string): { quote: number; indent: number } {
	const prefix = raw.match(/^[ \t]*(?:>[ \t]*)*/)?.[0] ?? "";
	return { quote: (prefix.match(/>/g) ?? []).length, indent: indentOf(raw.replace(/>/g, "")) };
}

/** A task and its indented descendants/continuations, excluding trailing blanks. */
export function taskBlock(content: string, task: ScannedTask): { start: number; end: number; lines: string[] } {
	const lines = content.split("\n");
	const start = locateTask(content, task);
	const parent = depth(lines[start]);
	let end = start + 1;
	for (let i = end; i < lines.length; i++) {
		if (!lines[i].trim() || /^\s*(?:>\s*)+$/.test(lines[i])) continue;
		const child = depth(lines[i]);
		if (child.quote !== parent.quote || child.indent <= parent.indent) break;
		end = i + 1;
	}
	return { start, end, lines: lines.slice(start, end) };
}

export function validateWording(text: string): void {
	if (!text.trim() || /[\r\n]/.test(text)) throw new Error("Enter each task on one non-empty line.");
}

export function editedBlock(content: string, task: ScannedTask, text: string, schedule: Schedule, format: DateFormat, subtasks: string[]): string[] {
	validateWording(text);
	subtasks.forEach(validateWording);
	const block = taskBlock(content, task).lines;
	const raw = block[0];
	const prefix = raw.match(TASK_PREFIX)?.[0];
	if (!prefix) throw new Error("This line is no longer a Markdown task.");
	const parsed = parseSchedule(raw);
	const sameSchedule = parsed.schedule.due === schedule.due && parsed.schedule.time === schedule.time && parsed.schedule.duration === schedule.duration;
	if (text !== taskWording(raw) || !sameSchedule) block[0] = writeSchedule(prefix + text.trim() + parsed.block, schedule, format);
	const container = raw.match(TASK_PREFIX)?.[1] ?? "";
	const cr = raw.endsWith("\r") ? "\r" : "";
	for (const subtask of subtasks) block.push(container + "    - [ ] " + subtask.trim() + cr);
	return block;
}

export function replaceTaskBlock(content: string, task: ScannedTask, replacement: string[], expected?: string[]): string {
	const block = taskBlock(content, task);
	if (expected && block.lines.join("\n") !== expected.join("\n")) throw new Error("The task or a subtask changed during the move. Refresh and try again.");
	const lines = content.split("\n");
	lines.splice(block.start, block.end - block.start, ...replacement);
	return lines.join("\n");
}

/** Normalize root indentation and line endings when moving to another note. */
export function appendTaskBlock(content: string, block: string[]): string {
	const indent = indentOf(block[0]);
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const normalized = block.map((line) => {
		let removed = 0;
		let i = 0;
		while (i < line.length && removed < indent && (line[i] === " " || line[i] === "\t")) {
			removed += line[i++] === "\t" ? 4 : 1;
		}
		return " ".repeat(Math.max(0, removed - indent)) + line.slice(i).replace(/\r$/, "");
	});
	return appendTask(content, normalized.join(eol));
}
