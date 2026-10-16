import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import type { LegacyItem, ScannedTask, Schedule, TaskLoopsData, TaskLoopsSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { scanFile, scanVault, setCheckboxDone, setTaskSchedule } from "./scanner";
import { appendTask, DATE_FORMATS, validSchedule, writeSchedule } from "./schedule";
import { TaskLoopsView, VIEW_TYPE_TASKLOOPS } from "./view";
import { TaskLoopsSettingTab } from "./settings";
import { existingSubtaskCandidates } from "./existing-tasks";
import { applyNoteChanges, NoteChange } from "./note-transaction";
import { TaskModal } from "./modals";
import { appendTaskBlock, editedBlock, replaceTaskBlock, taskBlock, nestTaskBlock, validateWording } from "./task-edits";

export default class TaskLoopsPlugin extends Plugin {
	settings: TaskLoopsSettings = { ...DEFAULT_SETTINGS };
	private tasks = new Map<string, ScannedTask[]>();
	private items: Record<string, LegacyItem> = {};
	private retained: Record<string, unknown> = {};
	private timers = new Map<string, number>();
	private scanVersion = 0;
	private fullScanVersion = 0;
	private fileVersions = new Map<string, number>();
	/** Serialize mutations so rapid capture / schedule / completion cannot race. */
	private mutations: Promise<unknown> = Promise.resolve();

	async onload(): Promise<void> {
		const data = (await this.loadData()) as (Partial<TaskLoopsData> & Record<string, unknown>) | null;
		this.retained = data ?? {};
		this.items = data?.items ?? {};
		this.settings = { ...DEFAULT_SETTINGS, ...data?.settings };
		if (!DATE_FORMATS.includes(this.settings.dateFormat)) this.settings.dateFormat = DEFAULT_SETTINGS.dateFormat;
		if (!["day", "week", "month", "year"].includes(this.settings.lastScale)) this.settings.lastScale = "week";
		this.registerView(VIEW_TYPE_TASKLOOPS, (leaf) => new TaskLoopsView(leaf, this));
		this.addRibbonIcon("calendar-days", "TaskLoops", () => void this.activateView());
		this.addCommand({ id: "open-panel", name: "Open planner", callback: () => void this.activateView() });
		this.addCommand({ id: "open-in-main-area", name: "Open planner in a main tab", callback: () => void this.activateView(true) });
		this.addCommand({ id: "rescan-vault", name: "Refresh tasks", callback: () => void this.rescan() });
		this.addCommand({ id: "capture-task", name: "Add a task", callback: () => this.newTask() });
		this.addSettingTab(new TaskLoopsSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => void this.rescan());
		this.registerEvent(this.app.metadataCache.on("changed", (file) => {
			window.clearTimeout(this.timers.get(file.path));
			this.timers.set(file.path, window.setTimeout(() => {
				this.timers.delete(file.path);
				void this.refreshFile(file);
			}, 150));
		}));
		this.registerEvent(this.app.vault.on("delete", () => void this.rescan()));
		this.registerEvent(this.app.vault.on("rename", () => void this.rescan()));
	}

	onunload(): void {
		for (const timer of this.timers.values()) window.clearTimeout(timer);
		this.timers.clear();
	}

	async saveSettings(): Promise<void> {
		// Keep the previous release's filing data as a reversible backup.
		await this.saveData({ ...this.retained, settings: { ...(this.retained.settings as object ?? {}), ...this.settings }, items: this.items });
	}

	async rescan(): Promise<void> {
		const version = ++this.scanVersion;
		const fullScan = ++this.fullScanVersion;
		try {
			const tasks = await scanVault(this.app, "#task", "checkboxes");
			if (fullScan !== this.fullScanVersion) return;
			// Keep per-file refreshes that finished after this scan started.
			for (const [path, revision] of this.fileVersions) {
				if (revision > version) {
					const latest = this.tasks.get(path);
					if (latest) tasks.set(path, latest);
					else tasks.delete(path);
				}
			}
			this.tasks = tasks;
			this.refreshViews();
		} catch (error) { this.report(error, "Could not refresh tasks."); }
	}

	private async refreshFile(file: TFile): Promise<void> {
		if (file.extension !== "md") return;
		const version = ++this.scanVersion;
		this.fileVersions.set(file.path, version);
		try {
			const tasks = await scanFile(this.app, file, "#task", "checkboxes");
			if (this.fileVersions.get(file.path) !== version) return;
			this.tasks.set(file.path, tasks);
			this.refreshViews();
		} catch (error) { this.report(error, "Could not read " + file.path); }
	}

	allTasks(): ScannedTask[] {
		return [...this.tasks.values()].flat().filter((task) => task.checkbox).map((task) => {
			const old = this.items[task.id];
			return !task.hasSchedule && old?.due ? { ...task, due: old.due } : task;
		}).sort((a, b) => this.noteName(a.path).localeCompare(this.noteName(b.path)) || a.path.localeCompare(b.path) || a.line - b.line);
	}

	noteName(path: string): string { return path.split("/").pop()?.replace(/\.md$/i, "") ?? path; }

	newTask(schedule: Schedule = {}, path?: string): void {
		new TaskModal(this.app, this, schedule, path).open();
	}

	private async enqueue(action: () => Promise<void>): Promise<void> {
		const next = this.mutations.then(action).catch((error: unknown) => this.report(error, "Could not update the task."));
		this.mutations = next;
		await next;
		this.refreshViews();
	}

	/** Re-find the clicked task after earlier queued operations, without guessing. */
	private current(task: ScannedTask): ScannedTask {
		return this.allTasks().find((t) => t.id === task.id) ?? task;
	}

	async schedule(task: ScannedTask, schedule: Schedule): Promise<void> {
		await this.enqueue(async () => {
			if (!validSchedule(schedule)) throw new Error("Choose a date before setting time or duration.");
			const current = this.current(task);
			const expected = writeSchedule(current.raw, schedule, this.settings.dateFormat);
			if (expected !== current.raw && !await setTaskSchedule(this.app, current, schedule, this.settings.dateFormat)) {
				throw new Error("The task changed or moved ambiguously. Refresh and try again.");
			}
			// Clear a legacy fallback only after the Markdown operation succeeds.
			if (this.items[current.id]?.due) {
				delete this.items[current.id].due;
				await this.saveSettings();
			}
			await this.reloadWrittenFile(current.path);
		});
	}

	async complete(task: ScannedTask): Promise<void> {
		await this.enqueue(async () => {
			const current = this.current(task);
			if (current.checked) return;
			if (!await setCheckboxDone(this.app, current)) throw new Error("The task changed or moved ambiguously. Refresh and try again.");
			await this.reloadWrittenFile(current.path);
		});
	}

	async createTask(text: string, path: string, schedule: Schedule): Promise<boolean> {
		let created = false;
		await this.enqueue(async () => {
			if (!text.trim() || /[\r\n]/.test(text)) throw new Error("Enter one task on a single line.");
			if (!validSchedule(schedule)) throw new Error("Enter a valid date, time and duration.");
			path = normalizePath(path);
			if (!path.endsWith(".md")) throw new Error("Choose a Markdown note.");
			const raw = "- [ ] " + text.trim();
			const line = schedule.due ? writeSchedule(raw, schedule, this.settings.dateFormat) : raw;
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) await this.app.vault.process(file, (content) => appendTask(content, line));
			else if (!file && path === normalizePath(this.settings.standaloneNote)) {
				const folder = path.split("/").slice(0, -1).join("/");
				if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
				await this.app.vault.create(path, appendTask("", line));
			} else throw new Error("The selected note no longer exists.");
			created = true;
			await this.reloadWrittenFile(path);
		});
		return created;
	}

	/** Save the editor in one source operation; moving preserves the whole subtree. */
	async editTask(task: ScannedTask, text: string, path: string, schedule: Schedule, subtasks: string[] = [], existing: ScannedTask[] = []): Promise<boolean> {
		if (existing.length) return this.editWithExisting(task, text, path, schedule, subtasks, existing);
		let saved = false;
		await this.enqueue(async () => {
			if (!validSchedule(schedule)) throw new Error("Enter a valid date, time and duration.");
			const current = this.current(task);
			const source = this.app.vault.getAbstractFileByPath(current.path);
			if (!(source instanceof TFile)) throw new Error("The source note no longer exists.");
			path = normalizePath(path);
			if (path === current.path) {
				await this.app.vault.process(source, (content) => replaceTaskBlock(content, current,
					editedBlock(content, current, text, schedule, this.settings.dateFormat, subtasks)));
			} else {
				if (!path.endsWith(".md")) throw new Error("Choose a Markdown project note.");
				const original = await this.app.vault.read(source);
				const expected = taskBlock(original, current).lines;
				const edited = editedBlock(original, current, text, schedule, this.settings.dateFormat, subtasks);
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
					if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
					written = appendTaskBlock("", edited);
					destination = await this.app.vault.create(path, written);
				} else throw new Error("The selected project note no longer exists.");
				if (!(destination instanceof TFile)) throw new Error("The destination is not a Markdown note.");
				try {
					await this.app.vault.process(source, (content) => replaceTaskBlock(content, current, [], expected));
				} catch (error) {
					// Two notes cannot be edited atomically. Roll back only our exact
					// destination write; never overwrite somebody's intervening edit.
					let originalPresent = false;
					try {
						originalPresent = taskBlock(await this.app.vault.read(source), current).lines.join("\n") === expected.join("\n");
					} catch { /* An unreadable source cannot justify removing the destination copy. */ }
					if (!originalPresent) throw new Error("The move could not be confirmed. The destination copy has been kept; review both notes before retrying.");
					let restored = false;
					try {
						let matched = false;
						await this.app.vault.process(destination, (content) => {
							if (content !== written) return content;
							matched = true;
							return before;
						});
						restored = matched;
					} catch { /* Preserve both copies if rollback is unsafe or unavailable. */ }
					if (!restored) throw new Error("The move could not finish. Both notes retain a copy of the task; review them before retrying.");
					throw error;
				}
			}
			if (this.items[current.id]?.due) { delete this.items[current.id].due; await this.saveSettings(); }
			saved = true;
			await this.reloadWrittenFile(current.path);
			if (path !== current.path) await this.reloadWrittenFile(path);
		});
		return saved;
	}

	/** Assemble all affected notes before moving existing tasks under a parent. */
	private async editWithExisting(task: ScannedTask, text: string, path: string, schedule: Schedule, subtasks: string[], existing: ScannedTask[]): Promise<boolean> {
		let saved = false;
		await this.enqueue(async () => {
			if (!validSchedule(schedule)) throw new Error("Enter a valid schedule.");
			validateWording(text);
			subtasks.forEach(validateWording);
			const parent = this.current(task);
			const children = existing.map((child) => this.current(child));
			const selected: ScannedTask[] = [];
			for (const child of children) {
				if (!existingSubtaskCandidates(this.allTasks(), parent, selected).some((candidate) => candidate.id === child.id)) throw new Error("A selected task is already related to this parent or another selection. Choose it again.");
				selected.push(child);
			}
			path = normalizePath(path);
			if (!path.endsWith(".md")) throw new Error("Choose a Markdown project note.");
			const changes = new Map<string, NoteChange>();
			for (const note of new Set([parent.path, ...children.map((child) => child.path), path])) {
				const file = this.app.vault.getAbstractFileByPath(note);
				if (file instanceof TFile) {
					const before = await this.app.vault.read(file);
					changes.set(note, { file, before, after: before });
				} else if (!file && note === path && note === normalizePath(this.settings.standaloneNote)) {
					const folder = note.split("/").slice(0, -1).join("/");
					if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
					const created = await this.app.vault.create(note, "");
					changes.set(note, { file: created, before: "", after: "" });
				} else throw new Error("A selected note no longer exists.");
			}
			const source = changes.get(parent.path)!;
			const parentBlock = taskBlock(source.before, parent);
			const replacement = editedBlock(source.before, parent, text, schedule, this.settings.dateFormat, subtasks);
			const ranges = [{ path: parent.path, start: parentBlock.start, end: parentBlock.end }];
			for (const child of children) {
				const change = changes.get(child.path)!;
				const block = taskBlock(change.before, child);
				if (ranges.some((range) => range.path === child.path && range.start < block.end && block.start < range.end)) throw new Error("Selected tasks overlap or would create a subtask loop. Refresh and try again.");
				ranges.push({ path: child.path, start: block.start, end: block.end });
				// Preserve dates retained from older plugin versions when moving.
				if (!child.hasSchedule && child.due) block.lines[0] = writeSchedule(block.lines[0], { due: child.due, time: child.time, duration: child.duration }, this.settings.dateFormat);
				replacement.push(...nestTaskBlock(replacement[0], block.lines));
			}
			for (const [note, change] of changes) {
				const lines = change.before.split("\n");
				for (const range of ranges.filter((range) => range.path === note).sort((a, b) => b.start - a.start)) {
					const contents = note === parent.path && range.start === parentBlock.start && path === parent.path ? replacement : [];
					lines.splice(range.start, range.end - range.start, ...contents);
				}
				change.after = lines.join("\n");
			}
			const destination = changes.get(path)!;
			if (path !== parent.path) destination.after = appendTaskBlock(destination.after, replacement);
			await applyNoteChanges(this.app, [destination, ...[...changes.values()].filter((change) => change !== destination)]);
			for (const moved of [parent, ...children]) if (this.items[moved.id]?.due) delete this.items[moved.id].due;
			saved = true;
			try { await this.saveSettings(); } catch (error) { this.report(error, "Tasks were saved, but the settings backup could not be updated."); }
			for (const change of changes.values()) await this.reloadWrittenFile(change.file.path);
		});
		return saved;
	}

	private async reloadWrittenFile(path: string): Promise<void> {
		// Metadata may lag behind an inserted checkbox. The metadata changed
		// listener supplies the final authoritative scan when the cache catches up.
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		await this.refreshFile(file);
	}

	private report(error: unknown, message: string): void {
		console.error("TaskLoops:", error);
		new Notice("TaskLoops: " + message + (error instanceof Error ? " " + error.message : ""));
	}

	refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKLOOPS)) {
			if (leaf.view instanceof TaskLoopsView) leaf.view.render();
		}
	}

	async reveal(task: ScannedTask): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.path);
		if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file, { eState: { line: task.line }, active: true });
	}

	async activateView(mainArea = false): Promise<void> {
		const workspace = this.app.workspace;
		const leaf = mainArea ? workspace.getLeaf("tab") : workspace.getLeavesOfType(VIEW_TYPE_TASKLOOPS)[0] ?? workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_TASKLOOPS, active: true });
		await workspace.revealLeaf(leaf);
	}
}
