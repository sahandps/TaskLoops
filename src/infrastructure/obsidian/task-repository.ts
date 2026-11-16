import { readDeferral } from "../../core/task-deferral";
import { App, TFile } from "obsidian";
import { DateFormat, ScannedTask, Schedule, TaskSource } from "../../core/types";
import { parseSchedule, writeSchedule } from "../../core/schedule";
import { inScanFolder } from "../../core/note-grid";
import {
	tagMatches,
	cleanTaskText,
	checkboxState,
	taskId,
	taskIndent,
	hasHandledMarker,
	assignParents,
	markCheckboxDone,
	markTaggedTaskDone,
	matchingTaskTags,
} from "../../core/task-parsing";
import { taskBlock } from "../../core/task-edits";

/**
 * Find Markdown checkbox tasks, tagged lines, or both in one file.
 *
 * Positions come from Obsidian's own metadata cache rather than a raw text
 * search, which excludes fenced code blocks, inline code, and frontmatter.
 */
export async function scanFile(
	app: App,
	file: TFile,
	tags: string | readonly string[] = "#task",
	source: TaskSource = "checkboxes",
): Promise<ScannedTask[]> {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return [];

	const lines = new Set<number>();
	const configured = typeof tags === "string" ? [tags] : tags;
	const checkboxLines = new Set(
		(cache.listItems ?? [])
			.filter((item) => item.task !== undefined)
			.map((item) => item.position.start.line),
	);
	if (source !== "tagged") for (const line of checkboxLines) lines.add(line);
	const taggedLines = new Map<number, string[]>();
	if (source !== "checkboxes") {
		for (const t of cache.tags ?? []) {
			if (!configured.some((tag) => tagMatches(t.tag, tag))) continue;
			const line = t.position.start.line;
			const matches = taggedLines.get(line);
			if (matches) matches.push(t.tag);
			else taggedLines.set(line, [t.tag]);
			lines.add(line);
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

		const checkbox = checkboxLines.has(line) ? checkboxState(raw) : null;
		const recognizedTags = taggedLines.get(line);
		const taskTags = recognizedTags
			? matchingTaskTags(raw, configured).filter((tag) =>
					recognizedTags.some((recognized) => recognized.toLowerCase() === tag.toLowerCase()),
				)
			: [];
		if ((source === "tagged" || checkbox === null) && !taskTags.length) continue;
		const text = cleanTaskText(raw, configured);
		if (!text || (checkbox === null && /^[\p{P}\s]+$/u.test(text))) continue;

		const key = text.toLowerCase();
		const occurrence = seen.get(key) ?? 0;
		seen.set(key, occurrence + 1);

		const parsed = parseSchedule(raw);
		const handled = hasHandledMarker(raw);
		out.push({
			...parsed.schedule,
			hasSchedule: !!parsed.suffix,
			id: taskId(file.path, text, occurrence),
			path: file.path,
			line,
			raw,
			text,
			indent: taskIndent(raw),
			handled,
			checkbox: checkbox !== null,
			checked: checkbox ?? handled,
			...(taskTags.length ? { taskTags } : {}),
		});
	}

	for (const task of out) {
		const block = taskBlock(content, task, split).lines;
		const deferral = readDeferral(block);
		if (deferral) task.deferral = deferral;
	}
	assignParents(out, split);
	return out;
}

export async function scanVault(
	app: App,
	tags: string | readonly string[] = "#task",
	source: TaskSource = "checkboxes",
	folder = "",
): Promise<Map<string, ScannedTask[]>> {
	const result = new Map<string, ScannedTask[]>();
	for (const file of app.vault.getMarkdownFiles()) {
		if (!inScanFolder(file.path, folder)) continue;
		const tasks = await scanFile(app, file, tags, source);
		if (tasks.length) result.set(file.path, tasks);
	}
	return result;
}

/**
 * Change only the state character inside a Markdown task checkbox. No text,
 * indentation, metadata, or surrounding syntax is rewritten.
 */
export async function setCheckboxDone(app: App, task: ScannedTask): Promise<boolean> {
	if (!task.checkbox) return false;
	return rewriteLine(app, task, markCheckboxDone);
}

export async function setTaskDone(app: App, task: ScannedTask): Promise<boolean> {
	if (task.checkbox) return setCheckboxDone(app, task);
	return rewriteLine(app, task, markTaggedTaskDone);
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
	next: (current: string) => string,
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

export async function setTaskSchedule(
	app: App,
	task: ScannedTask,
	schedule: Schedule,
	format: DateFormat,
): Promise<boolean> {
	return rewriteLine(app, task, (raw) => writeSchedule(raw, schedule, format));
}
