import { resolveDeferral, deferBlock, deferralPrefix } from "./task-deferral";
import { locateNoteTask, noteTaskRows } from "./inline-task-data";
import { todayISO } from "./dates";
import type { DateFormat, ScannedTask, Schedule } from "./types";
import { appendTask, parseSchedule, writeSchedule } from "./schedule";
import {
	checkboxState,
	indentOf,
	markCheckboxDone,
	markTaggedTaskDone,
	matchingTaskTags,
	stripHandledMarker,
} from "./task-parsing";
import { nextRepeatSchedule } from "./repeat";

const TASK_PREFIX = /^([ \t]*(?:>[ \t]*)*)(?:[-*+]|\d+[.)])[ \t]+\[.\][ \t]*/;
const TAGGED_PREFIX = /^[ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d+[.)]|#{1,6})[ \t]+)?/;

/** Editable wording retains inline Markdown and tags; block ids stay protected. */
export function taskWording(raw: string): string {
	return stripHandledMarker(parseSchedule(raw).body).replace(
		checkboxState(raw) === null ? TAGGED_PREFIX : TASK_PREFIX,
		"",
	);
}

export function locateTask(content: string, task: ScannedTask, lines = content.split("\n")): number {
	if (lines[task.line] === task.raw) return task.line;
	const matches = lines.flatMap((line, index) => (line === task.raw ? [index] : []));
	if (matches.length === 1) return matches[0];
	throw new Error("The task changed or moved ambiguously. Refresh and try again.");
}

/** Remove exactly the selected task row, retaining children and prose. */
export function removeTaskLine(content: string, task: ScannedTask): string {
	const match = locateNoteTask(
		noteTaskRows(content, task.path, task.taskTags, task.checkbox ? "checkboxes" : "tagged"),
		task.line,
		task.raw,
	);
	if (!match) throw new Error("The task changed or moved ambiguously. Refresh and try again.");
	const lines = content.split("\n");
	lines.splice(match.line, 1);
	return lines.join("\n");
}

function depth(raw: string): { quote: number; indent: number } {
	const prefix = raw.match(/^[ \t]*(?:>[ \t]*)*/)?.[0] ?? "";
	return { quote: (prefix.match(/>/g) ?? []).length, indent: indentOf(raw.replace(/>/g, "")) };
}

/** A task and its indented descendants/continuations, excluding trailing blanks. */
export function taskBlock(
	content: string,
	task: ScannedTask,
	lines = content.split("\n"),
): { start: number; end: number; lines: string[] } {
	const start = locateTask(content, task, lines);
	let end = start + 1;
	if (!task.checkbox) {
		const prefix = deferralPrefix(lines[start]);
		while (lines[end]?.startsWith(prefix)) end++;
		return { start, end, lines: lines.slice(start, end) };
	}
	const parent = depth(lines[start]);
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

/** Add a discovery tag before any schedule metadata or block ID if needed. */
export function ensureTaskTag(raw: string, tags: readonly string[], fallback = tags[0]): string {
	if (!fallback || matchingTaskTags(raw, tags).length) return raw;
	const end = parseSchedule(raw).body.trimEnd().length;
	return raw.slice(0, end) + " " + fallback + raw.slice(end);
}

export function editedBlock(
	content: string,
	task: ScannedTask,
	text: string,
	schedule: Schedule,
	format: DateFormat,
	subtasks: string[],
	reason?: string,
	configuredTags: readonly string[] = [],
	requiredSubtaskTags: readonly string[] = [],
): string[] {
	validateWording(text);
	subtasks.forEach(validateWording);
	if (reason !== undefined) schedule = { priority: schedule.priority, color: schedule.color };
	const block = taskBlock(content, task).lines;
	const raw = block[0];
	const prefix = raw.match(task.checkbox ? TASK_PREFIX : TAGGED_PREFIX)?.[0];
	if (prefix === undefined) throw new Error("This line is no longer a Markdown task.");
	if (subtasks.length && !task.checkbox) throw new Error("Add subtasks under a Markdown checkbox task.");
	const parsed = parseSchedule(raw);
	const sameSchedule =
		parsed.schedule.due === schedule.due &&
		parsed.schedule.deadline === schedule.deadline &&
		parsed.schedule.time === schedule.time &&
		parsed.schedule.duration === schedule.duration &&
		(schedule.priority === undefined || (parsed.schedule.priority ?? "") === schedule.priority) &&
		(schedule.color === undefined || (parsed.schedule.color ?? "") === schedule.color) &&
		(schedule.repeat === undefined || (parsed.schedule.repeat ?? "") === schedule.repeat);
	if (text !== taskWording(raw) || !sameSchedule) {
		let wording = prefix + text.trim();
		if (task.taskTags?.length)
			wording = ensureTaskTag(wording, [...configuredTags, ...task.taskTags], task.taskTags[0]);
		if (task.handled) wording = markTaggedTaskDone(wording);
		block[0] = writeSchedule(
			wording + parsed.block,
			{
				...schedule,
				priority: schedule.priority ?? parsed.schedule.priority,
				color: schedule.color ?? parsed.schedule.color,
				repeat: schedule.repeat ?? parsed.schedule.repeat,
			},
			format,
		);
	}
	const container = raw.match(TASK_PREFIX)?.[1] ?? "";
	const cr = raw.endsWith("\r") ? "\r" : "";
	for (const subtask of subtasks)
		block.push(ensureTaskTag(container + "    - [ ] " + subtask.trim() + cr, requiredSubtaskTags));
	return reason !== undefined
		? deferBlock(block, reason)
		: resolveDeferral(block, schedule.due, todayISO());
}

export function replaceTaskBlock(
	content: string,
	task: ScannedTask,
	replacement: string[],
	expected?: string[],
): string {
	const block = taskBlock(content, task);
	if (expected && block.lines.join("\n") !== expected.join("\n"))
		throw new Error("The task or a subtask changed during the move. Refresh and try again.");
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

/** Rebase an existing task subtree into the parent's list/quote container. */
export function nestTaskBlock(parent: string, block: string[]): string[] {
	const parentContainer = parent.match(TASK_PREFIX)?.[1];
	const sourceContainer = block[0].match(TASK_PREFIX)?.[1];
	if (parentContainer === undefined || sourceContainer === undefined)
		throw new Error("Select Markdown checkbox tasks.");
	const quoteDepth = (sourceContainer.match(/>/g) ?? []).length;
	const stripQuotes = (line: string) => {
		let rest = line;
		for (let n = 0; n < quoteDepth; n++) rest = rest.replace(/^[ \t]*>[ \t]?/, "");
		return rest;
	};
	const indent = indentOf(stripQuotes(block[0]));
	return block.map((raw) => {
		const line = stripQuotes(raw).replace(/\r$/, "");
		let removed = 0;
		let i = 0;
		while (i < line.length && removed < indent && (line[i] === " " || line[i] === "\t"))
			removed += line[i++] === "\t" ? 4 : 1;
		return (
			parentContainer +
			"    " +
			" ".repeat(Math.max(0, removed - indent)) +
			line.slice(i) +
			(parent.endsWith("\r") ? "\r" : "")
		);
	});
}

/**
 * The next occurrence of a repeating task, as a fresh block placed after the
 * completed one. Subtasks come back unchecked; block ids, handled markers and
 * "Can't schedule now" notes stay with the finished occurrence.
 */
export function repeatBlock(block: string[], today: string, format: DateFormat): string[] | undefined {
	const parsed = parseSchedule(block[0]);
	const next = nextRepeatSchedule(parsed.schedule, today);
	if (!next) return;
	const cr = block[0].endsWith("\r") ? "\r" : "";
	const reasons = deferralPrefix(block[0]);
	const first = stripHandledMarker(parsed.body.trimEnd()).replace(
		/^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+))\[.\]/,
		"$1[ ]",
	);
	const lines = [writeSchedule(first + cr, next, format)];
	for (const line of block.slice(1)) {
		if (line.startsWith(reasons)) continue;
		lines.push(
			line
				.replace(/\s+\^[\w-]+(\r?)$/, "$1")
				.replace(/^(\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+))\[[xX]\]/, "$1[ ]"),
		);
	}
	return lines;
}

/** Mark a block's first line done and add the next occurrence, if the rule continues. */
export function completeTaskBlock(
	content: string,
	task: ScannedTask,
	today: string,
	format: DateFormat,
): string {
	const located = taskBlock(content, task);
	const lines = content.split("\n");
	const next = repeatBlock(located.lines, today, format);
	lines[located.start] = task.checkbox
		? markCheckboxDone(lines[located.start])
		: markTaggedTaskDone(lines[located.start]);
	if (next) lines.splice(located.end, 0, ...next);
	return lines.join("\n");
}
