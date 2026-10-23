import { deferBlock, resolveDeferral, validateDeferralReason } from "../core/task-deferral";
import { todayISO } from "../core/dates";
import { App, TFile, normalizePath } from "obsidian";
import type { LegacyItem, ScannedTask, Schedule, TaskLoopsSettings } from "../core/types";
import { parseSchedule, validSchedule, writeSchedule } from "../core/schedule";
import { setCheckboxDone } from "../infrastructure/obsidian/task-repository";
import { applyNoteChanges, type NoteChange } from "../infrastructure/obsidian/note-transaction";
import { existingSubtaskCandidates, existingSubtaskDestination } from "../core/existing-tasks";
import {
	appendTaskBlock,
	editedBlock,
	replaceTaskBlock,
	taskBlock,
	nestTaskBlock,
	validateWording,
} from "../core/task-edits";

interface TaskServiceHost {
	app(): App;
	settings(): TaskLoopsSettings;
	legacyItems(): Record<string, LegacyItem>;
	allTasks(): ScannedTask[];
	saveSettings(): Promise<void>;
	reloadWrittenFile(path: string): Promise<void>;
	refreshViews(): void;
	report(error: unknown, message: string): void;
}

/** Owns task writes and their queue; it has no GUI dependency. */
export class TaskService {
	private mutations: Promise<unknown> = Promise.resolve();
	constructor(private host: TaskServiceHost) {}
	private get app(): App {
		return this.host.app();
	}
	private get settings(): TaskLoopsSettings {
		return this.host.settings();
	}
	private get items(): Record<string, LegacyItem> {
		return this.host.legacyItems();
	}
	private async enqueue(action: () => Promise<void>): Promise<void> {
		const next = this.mutations
			.then(action)
			.catch((error: unknown) => this.host.report(error, "Could not update the task."));
		this.mutations = next;
		await next;
		this.host.refreshViews();
	}

	/** Re-find the clicked task after earlier queued operations, without guessing. */
	private current(task: ScannedTask): ScannedTask {
		return this.host.allTasks().find((t) => t.id === task.id) ?? task;
	}

	async schedule(task: ScannedTask, schedule: Schedule): Promise<void> {
		if (schedule.time && schedule.duration === undefined)
			schedule = { ...schedule, duration: task.duration ?? this.settings.defaultDuration ?? 30 };
		await this.enqueue(async () => {
			if (!validSchedule(schedule)) throw new Error("Choose a date before setting time or duration.");
			const current = this.current(task);
			const file = this.app.vault.getAbstractFileByPath(current.path);
			if (!(file instanceof TFile)) throw new Error("The source note no longer exists.");
			await this.app.vault.process(file, (content) => {
				const block = taskBlock(content, current).lines;
				block[0] = writeSchedule(block[0], schedule, this.settings.dateFormat);
				return replaceTaskBlock(content, current, resolveDeferral(block, schedule.due, todayISO()));
			});
			// Clear a legacy fallback only after the Markdown operation succeeds.
			if (this.items[current.id]?.due) {
				delete this.items[current.id].due;
				await this.host.saveSettings();
			}
			await this.host.reloadWrittenFile(current.path);
		});
	}

	async complete(task: ScannedTask): Promise<boolean> {
		let completed = false;
		await this.enqueue(async () => {
			const current = this.current(task);
			if (current.checked) {
				completed = true;
				return;
			}
			if (!(await setCheckboxDone(this.app, current)))
				throw new Error("The task changed or moved ambiguously. Refresh and try again.");
			await this.host.reloadWrittenFile(current.path);
			completed = true;
		});
		return completed;
	}

	async deferTask(task: ScannedTask, reason: string): Promise<boolean> {
		let saved = false;
		await this.enqueue(async () => {
			validateDeferralReason(reason);
			const current = this.current(task);
			if (current.checked) throw new Error("Completed tasks cannot be deferred.");
			const file = this.app.vault.getAbstractFileByPath(current.path);
			if (!(file instanceof TFile)) throw new Error("The source note no longer exists.");
			await this.app.vault.process(file, (content) => {
				const block = taskBlock(content, current).lines;
				block[0] = writeSchedule(block[0], {}, this.settings.dateFormat);
				return replaceTaskBlock(content, current, deferBlock(block, reason));
			});
			if (this.items[current.id]?.due) {
				delete this.items[current.id].due;
				await this.host.saveSettings();
			}
			await this.host.reloadWrittenFile(current.path);
			saved = true;
		});
		return saved;
	}

	async createTask(text: string, path: string, schedule: Schedule, reason?: string): Promise<boolean> {
		if (schedule.time && schedule.duration === undefined)
			schedule = { ...schedule, duration: this.settings.defaultDuration ?? 30 };
		let created = false;
		await this.enqueue(async () => {
			if (!text.trim() || /[\r\n]/.test(text)) throw new Error("Enter one task on a single line.");
			if (!validSchedule(schedule)) throw new Error("Enter a valid date, time and duration.");
			path = normalizePath(path);
			if (!path.endsWith(".md")) throw new Error("Choose a Markdown note.");
			if (reason !== undefined) {
				validateDeferralReason(reason);
				if (schedule.due) throw new Error("A deferred task must be unscheduled.");
			}
			const raw = "- [ ] " + text.trim();
			const base =
				schedule.due || schedule.priority || schedule.color
					? writeSchedule(
							raw,
							{ ...parseSchedule(raw).schedule, ...schedule },
							this.settings.dateFormat,
						)
					: raw;
			const line = reason !== undefined ? deferBlock([base], reason).join("\n") : base;
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile)
				await this.app.vault.process(file, (content) => appendTaskBlock(content, line.split("\n")));
			else if (!file && path === normalizePath(this.settings.standaloneNote)) {
				const folder = path.split("/").slice(0, -1).join("/");
				if (folder && !this.app.vault.getAbstractFileByPath(folder))
					await this.app.vault.createFolder(folder);
				await this.app.vault.create(path, appendTaskBlock("", line.split("\n")));
			} else throw new Error("The selected note no longer exists.");
			created = true;
			await this.host.reloadWrittenFile(path);
		});
		return created;
	}

	/** Save the editor in one source operation; moving preserves the whole subtree. */
	async editTask(
		task: ScannedTask,
		text: string,
		path: string,
		schedule: Schedule,
		subtasks: string[] = [],
		existing: ScannedTask[] = [],
		reason?: string,
	): Promise<boolean> {
		if (existing.length)
			return this.editWithExisting(task, text, path, schedule, subtasks, existing, reason);
		let saved = false;
		await this.enqueue(async () => {
			if (reason !== undefined) {
				validateDeferralReason(reason);
				schedule = { priority: schedule.priority, color: schedule.color };
			}
			if (!validSchedule(schedule)) throw new Error("Enter a valid date, time and duration.");
			const current = this.current(task);
			if (reason !== undefined && current.checked)
				throw new Error("Completed tasks cannot be deferred.");
			const source = this.app.vault.getAbstractFileByPath(current.path);
			if (!(source instanceof TFile)) throw new Error("The source note no longer exists.");
			path = normalizePath(path);
			if (path === current.path) {
				await this.app.vault.process(source, (content) =>
					replaceTaskBlock(
						content,
						current,
						editedBlock(
							content,
							current,
							text,
							schedule,
							this.settings.dateFormat,
							subtasks,
							reason,
						),
					),
				);
			} else {
				if (!path.endsWith(".md")) throw new Error("Choose a Markdown project note.");
				const original = await this.app.vault.read(source);
				const expected = taskBlock(original, current).lines;
				const edited = editedBlock(
					original,
					current,
					text,
					schedule,
					this.settings.dateFormat,
					subtasks,
					reason,
				);
				let destination = this.app.vault.getAbstractFileByPath(path);
				let before = "";
				let written = "";
				if (destination instanceof TFile) {
					await this.app.vault.process(destination, (content) => {
						before = content;
						written = appendTaskBlock(content, edited);
						return written;
					});
				} else if (!destination && path === normalizePath(this.settings.standaloneNote)) {
					const folder = path.split("/").slice(0, -1).join("/");
					if (folder && !this.app.vault.getAbstractFileByPath(folder))
						await this.app.vault.createFolder(folder);
					written = appendTaskBlock("", edited);
					destination = await this.app.vault.create(path, written);
				} else throw new Error("The selected project note no longer exists.");
				if (!(destination instanceof TFile))
					throw new Error("The destination is not a Markdown note.");
				try {
					await this.app.vault.process(source, (content) =>
						replaceTaskBlock(content, current, [], expected),
					);
				} catch (error) {
					// Two notes cannot be edited atomically. Roll back only our exact
					// destination write; never overwrite somebody's intervening edit.
					let originalPresent = false;
					try {
						originalPresent =
							taskBlock(await this.app.vault.read(source), current).lines.join("\n") ===
							expected.join("\n");
					} catch {
						/* An unreadable source cannot justify removing the destination copy. */
					}
					if (!originalPresent)
						throw new Error(
							"The move could not be confirmed. The destination copy has been kept; review both notes before retrying.",
						);
					let restored = false;
					try {
						let matched = false;
						await this.app.vault.process(destination, (content) => {
							if (content !== written) return content;
							matched = true;
							return before;
						});
						restored = matched;
					} catch {
						/* Preserve both copies if rollback is unsafe or unavailable. */
					}
					if (!restored)
						throw new Error(
							"The move could not finish. Both notes retain a copy of the task; review them before retrying.",
						);
					throw error;
				}
			}
			if (this.items[current.id]?.due) {
				delete this.items[current.id].due;
				await this.host.saveSettings();
			}
			saved = true;
			await this.host.reloadWrittenFile(current.path);
			if (path !== current.path) await this.host.reloadWrittenFile(path);
		});
		return saved;
	}

	/** Assemble all affected notes before moving existing tasks under a parent. */
	private async editWithExisting(
		task: ScannedTask,
		text: string,
		path: string,
		schedule: Schedule,
		subtasks: string[],
		existing: ScannedTask[],
		reason?: string,
	): Promise<boolean> {
		let saved = false;
		await this.enqueue(async () => {
			if (reason !== undefined) {
				validateDeferralReason(reason);
				schedule = { priority: schedule.priority, color: schedule.color };
			}
			if (!validSchedule(schedule)) throw new Error("Enter a valid schedule.");
			validateWording(text);
			subtasks.forEach(validateWording);
			const parent = this.current(task);
			if (reason !== undefined && parent.checked)
				throw new Error("Completed tasks cannot be deferred.");
			const children = existing.map((child) => this.current(child));
			const selected: ScannedTask[] = [];
			for (const child of children) {
				if (
					!existingSubtaskCandidates(this.host.allTasks(), parent, selected).some(
						(candidate) => candidate.id === child.id,
					)
				)
					throw new Error(
						"A selected task is already related to this parent or another selection. Choose it again.",
					);
				selected.push(child);
			}
			path = existingSubtaskDestination(
				parent.path,
				normalizePath(this.settings.standaloneNote),
				normalizePath(path),
				children.map((child) => child.path),
			);
			if (!path.endsWith(".md")) throw new Error("Choose a Markdown project note.");
			const changes = new Map<string, NoteChange>();
			for (const note of new Set([parent.path, ...children.map((child) => child.path), path])) {
				const file = this.app.vault.getAbstractFileByPath(note);
				if (file instanceof TFile) {
					const before = await this.app.vault.read(file);
					changes.set(note, { file, before, after: before });
				} else if (!file && note === path && note === normalizePath(this.settings.standaloneNote)) {
					const folder = note.split("/").slice(0, -1).join("/");
					if (folder && !this.app.vault.getAbstractFileByPath(folder))
						await this.app.vault.createFolder(folder);
					const created = await this.app.vault.create(note, "");
					changes.set(note, { file: created, before: "", after: "" });
				} else throw new Error("A selected note no longer exists.");
			}
			const source = changes.get(parent.path)!;
			const parentBlock = taskBlock(source.before, parent);
			const replacement = editedBlock(
				source.before,
				parent,
				text,
				schedule,
				this.settings.dateFormat,
				subtasks,
				reason,
			);
			const ranges = [{ path: parent.path, start: parentBlock.start, end: parentBlock.end }];
			for (const child of children) {
				const change = changes.get(child.path)!;
				const block = taskBlock(change.before, child);
				if (
					ranges.some(
						(range) =>
							range.path === child.path && range.start < block.end && block.start < range.end,
					)
				)
					throw new Error(
						"Selected tasks overlap or would create a subtask loop. Refresh and try again.",
					);
				ranges.push({ path: child.path, start: block.start, end: block.end });
				// Preserve dates retained from older plugin versions when moving.
				if (!child.hasSchedule && child.due)
					block.lines[0] = writeSchedule(
						block.lines[0],
						{
							due: child.due,
							deadline: child.deadline,
							time: child.time,
							duration: child.duration,
						},
						this.settings.dateFormat,
					);
				replacement.push(...nestTaskBlock(replacement[0], block.lines));
			}
			for (const [note, change] of changes) {
				const lines = change.before.split("\n");
				for (const range of ranges
					.filter((range) => range.path === note)
					.sort((a, b) => b.start - a.start)) {
					const contents =
						note === parent.path && range.start === parentBlock.start && path === parent.path
							? replacement
							: [];
					lines.splice(range.start, range.end - range.start, ...contents);
				}
				change.after = lines.join("\n");
			}
			const destination = changes.get(path)!;
			if (path !== parent.path) destination.after = appendTaskBlock(destination.after, replacement);
			await applyNoteChanges(this.app, [
				destination,
				...[...changes.values()].filter((change) => change !== destination),
			]);
			for (const moved of [parent, ...children])
				if (this.items[moved.id]?.due) delete this.items[moved.id].due;
			saved = true;
			try {
				await this.host.saveSettings();
			} catch (error) {
				this.host.report(error, "Tasks were saved, but the settings backup could not be updated.");
			}
			for (const change of changes.values()) await this.host.reloadWrittenFile(change.file.path);
		});
		return saved;
	}
}
