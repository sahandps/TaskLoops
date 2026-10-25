import type { DailyNoteActions } from "./application/task-actions";
import { DailyNotes } from "./infrastructure/obsidian/daily-notes";
import { DailyCalendarView, VIEW_TYPE_DAILY_CALENDAR } from "./gui/views/daily-calendar-view";
import { TaskService } from "./application/task-service";
import { normalizeSettings } from "./core/settings";
import { Notice, Platform, Plugin, TFile } from "obsidian";
import type { LegacyItem, ScannedTask, Schedule, TaskLoopsData, TaskLoopsSettings } from "./core/types";
import { DEFAULT_SETTINGS } from "./core/types";
import { scanFile, scanVault } from "./infrastructure/obsidian/task-repository";

import { TaskLoopsView, VIEW_TYPE_TASKLOOPS } from "./gui/views/taskloops-view";
import { TaskLoopsSettingTab } from "./gui/obsidian/settings-tab";
import { TaskModal } from "./gui/modals/index";
import { inlineTaskExtension, readingTaskButtons } from "./gui/obsidian/inline-tasks";
import { inScanFolder } from "./core/note-grid";

export default class TaskLoopsPlugin extends Plugin {
	readonly inlineControls = new Set<HTMLElement>();
	settings: TaskLoopsSettings = { ...DEFAULT_SETTINGS };
	private tasks = new Map<string, ScannedTask[]>();
	private items: Record<string, LegacyItem> = {};
	private retained: Record<string, unknown> = {};
	private timers = new Map<string, number>();
	private scanVersion = 0;
	private fullScanVersion = 0;
	private fileVersions = new Map<string, number>();
	private taskService = new TaskService({
		app: () => this.app,
		settings: () => this.settings,
		legacyItems: () => this.items,
		allTasks: () => this.allTasks(),
		saveSettings: () => this.saveSettings(),
		reloadWrittenFile: (path) => this.reloadWrittenFile(path),
		refreshViews: () => this.refreshViews(),
		report: (error, message) => this.report(error, message),
	});

	private daily = new DailyNotes(() => this.app);
	readonly dailyNotes: DailyNoteActions = (() => {
		const daily = this.daily;
		return {
			get enabled() {
				return daily.enabled;
			},
			path: (date: string) => this.daily.path(date),
			exists: (date: string) => this.daily.exists(date),
			open: async (date: string): Promise<boolean> => {
				try {
					const file = await this.daily.ensure(date);
					return await this.openNote(file.path);
				} catch (error) {
					this.report(error, "Could not open the daily note.");
					return false;
				}
			},
			createTask: async (
				date: string,
				text: string,
				schedule: Schedule,
				reason?: string,
			): Promise<boolean> => {
				try {
					return await this.taskService.createTask(
						text,
						this.daily.path(date),
						schedule,
						reason,
						() => this.daily.ensure(date),
					);
				} catch (error) {
					this.report(error, "Could not save to the daily note.");
					return false;
				}
			},
		};
	})();

	async activateDailyCalendar(): Promise<void> {
		const leaf =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_DAILY_CALENDAR)[0] ??
			this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_DAILY_CALENDAR, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_DAILY_CALENDAR, (leaf) => new DailyCalendarView(leaf, this));
		this.addCommand({
			id: "open-daily-calendar",
			name: "Open daily note calendar",
			callback: () => void this.activateDailyCalendar(),
		});
		this.addRibbonIcon("calendar", "Daily note calendar", () => void this.activateDailyCalendar());
		const data = (await this.loadData()) as (Partial<TaskLoopsData> & Record<string, unknown>) | null;
		this.retained = data ?? {};
		this.items = data?.items ?? {};
		this.settings = normalizeSettings(data?.settings);
		this.registerView(VIEW_TYPE_TASKLOOPS, (leaf) => new TaskLoopsView(leaf, this));
		this.addRibbonIcon("calendar-days", "TaskLoops", () => void this.activateView());
		this.addCommand({ id: "open-panel", name: "Open planner", callback: () => void this.activateView() });
		this.addCommand({
			id: "open-in-main-area",
			name: "Open planner in a main tab",
			callback: () => void this.activateView(true),
		});
		this.addCommand({ id: "rescan-vault", name: "Refresh tasks", callback: () => void this.rescan() });
		this.addCommand({ id: "capture-task", name: "Add a task", callback: () => this.newTask() });
		this.addSettingTab(new TaskLoopsSettingTab(this.app, this));
		this.registerEditorExtension(inlineTaskExtension(this));
		this.registerMarkdownPostProcessor((root, context) => readingTaskButtons(this, root, context));
		this.app.workspace.onLayoutReady(() => {
			void this.rescan();
			if (
				Platform.isMobile &&
				this.app.workspace
					.getLeavesOfType(VIEW_TYPE_TASKLOOPS)
					.some((leaf) => leaf.getRoot() !== this.app.workspace.rootSplit)
			)
				void this.activateView();
		});
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				window.clearTimeout(this.timers.get(file.path));
				this.timers.set(
					file.path,
					window.setTimeout(() => {
						this.timers.delete(file.path);
						void this.refreshFile(file);
					}, 150),
				);
			}),
		);
		this.registerEvent(this.app.vault.on("delete", () => void this.rescan()));
		this.registerEvent(this.app.vault.on("rename", () => void this.rescan()));
	}

	onunload(): void {
		for (const control of this.inlineControls) control.remove();
		this.inlineControls.clear();
		for (const timer of this.timers.values()) window.clearTimeout(timer);
		this.timers.clear();
	}

	async saveSettings(): Promise<void> {
		// Keep the previous release's filing data as a reversible backup.
		await this.saveData({
			...this.retained,
			settings: { ...((this.retained.settings as object) ?? {}), ...this.settings },
			items: this.items,
		});
	}

	async rescan(): Promise<void> {
		const version = ++this.scanVersion;
		const fullScan = ++this.fullScanVersion;
		try {
			const tasks = await scanVault(this.app, "#task", "checkboxes", this.settings.scanFolder);
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
		} catch (error) {
			this.report(error, "Could not refresh tasks.");
		}
	}

	async refreshFile(file: TFile): Promise<void> {
		if (file.extension !== "md") return;
		if (!inScanFolder(file.path, this.settings.scanFolder)) {
			this.tasks.delete(file.path);
			this.refreshViews();
			return;
		}
		const version = ++this.scanVersion;
		this.fileVersions.set(file.path, version);
		try {
			const tasks = await scanFile(this.app, file, "#task", "checkboxes");
			if (this.fileVersions.get(file.path) !== version) return;
			this.tasks.set(file.path, tasks);
			this.refreshViews();
		} catch (error) {
			this.report(error, "Could not read " + file.path);
		}
	}

	allTasks(): ScannedTask[] {
		return [...this.tasks.values()]
			.flat()
			.filter((task) => task.checkbox && inScanFolder(task.path, this.settings.scanFolder))
			.map((task) => {
				const old = this.items[task.id];
				return !task.hasSchedule && old?.due ? { ...task, due: old.due } : task;
			})
			.sort(
				(a, b) =>
					this.noteName(a.path).localeCompare(this.noteName(b.path)) ||
					a.path.localeCompare(b.path) ||
					a.line - b.line,
			);
	}

	noteName(path: string): string {
		return path.split("/").pop()?.replace(/\.md$/i, "") ?? path;
	}

	newTask(schedule: Schedule = {}, path?: string): void {
		if (schedule.time && schedule.duration === undefined)
			schedule = { ...schedule, duration: this.settings.defaultDuration ?? 30 };
		new TaskModal(this.app, this, schedule, path).open();
	}

	// Public commands delegate to a service so GUI callers never handle vault writes.
	schedule(task: ScannedTask, schedule: Schedule): Promise<void> {
		return this.taskService.schedule(task, schedule);
	}

	complete(task: ScannedTask): Promise<boolean> {
		return this.taskService.complete(task);
	}

	deferTask(task: ScannedTask, reason: string): Promise<boolean> {
		return this.taskService.deferTask(task, reason);
	}

	createTask(text: string, path: string, schedule: Schedule, reason?: string): Promise<boolean> {
		return this.taskService.createTask(text, path, schedule, reason);
	}

	editTask(
		task: ScannedTask,
		text: string,
		path: string,
		schedule: Schedule,
		subtasks: string[] = [],
		existing: ScannedTask[] = [],
		reason?: string,
	): Promise<boolean> {
		return this.taskService.editTask(task, text, path, schedule, subtasks, existing, reason);
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
		await this.openNote(task.path, task.line);
	}

	async openNote(path: string, line?: number): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice("This note does not exist yet. Save the task first to create it.");
			return false;
		}
		await this.app.workspace
			.getLeaf("tab")
			.openFile(file, { ...(line === undefined ? {} : { eState: { line } }), active: true });
		return true;
	}

	async activateView(mainArea = false): Promise<void> {
		const workspace = this.app.workspace;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_TASKLOOPS);
		const leaf = Platform.isMobile
			? (existing.find((item) => item.getRoot() === workspace.rootSplit) ?? workspace.getLeaf("tab"))
			: mainArea
				? workspace.getLeaf("tab")
				: (existing[0] ?? workspace.getRightLeaf(false));
		if (!leaf) return;
		await leaf.setViewState({ type: VIEW_TYPE_TASKLOOPS, active: true });
		if (Platform.isMobile)
			for (const old of existing)
				if (old !== leaf && old.getRoot() !== workspace.rootSplit) old.detach();
		await workspace.revealLeaf(leaf);
	}
}
