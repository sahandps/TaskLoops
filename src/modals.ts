import { App, FuzzySuggestModal, Modal, Notice, TFile } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { ScannedTask, Schedule } from "./types";
import { existingSubtaskCandidates } from "./existing-tasks";
import { formatDate, formatDuration, formatTime, validSchedule } from "./schedule";
import { taskWording } from "./task-edits";

export class NotePicker extends FuzzySuggestModal<string> {
	constructor(app: App, private standalone: string, private onPick: (path: string) => void, private choices?: string[]) {
		super(app);
		this.setPlaceholder(choices ? "Search notes with available tasks…" : "Search project notes…");
		this.setInstructions([
			{ command: "↑ ↓", purpose: "navigate notes" },
			{ command: "↵", purpose: "pick project" },
			{ command: "esc", purpose: "cancel" },
		]);
	}
	getItems(): string[] {
		return [...new Set(this.choices ?? [this.standalone, ...this.app.vault.getMarkdownFiles().map((file) => file.path)])].sort((a, b) => a.localeCompare(b));
	}
	getItemText(path: string): string { return path === this.standalone ? "Standalone tasks — " + path : path.replace(/\.md$/, ""); }
	onChooseItem(path: string): void { this.onPick(path); }
}

/** Choose the actual source task; selection alone never changes Markdown. */
export class ExistingTaskPicker extends FuzzySuggestModal<ScannedTask> {
	constructor(app: App, private tasks: ScannedTask[], private plugin: TaskLoopsPlugin, private onPick: (task: ScannedTask) => void) {
		super(app);
		this.setPlaceholder("Search tasks in " + this.plugin.noteName(tasks[0]?.path ?? "this note") + "…");
		this.setInstructions([
			{ command: "↑ ↓", purpose: "navigate tasks" },
			{ command: "↵", purpose: "select subtask" },
			{ command: "esc", purpose: "cancel" },
		]);
	}
	getItems(): ScannedTask[] { return this.tasks; }
	getItemText(task: ScannedTask): string { return task.text; }
	renderSuggestion(match: { item: ScannedTask }, el: HTMLElement): void {
		const task = match.item;
		el.createDiv({ cls: "tl-picker-title", text: task.text });
		const schedule = [task.due ? formatDate(task.due, this.plugin.settings.dateFormat) : "No date", task.time ? formatTime(task.time, this.plugin.settings.timeFormat) : undefined, task.duration ? formatDuration(task.duration) : undefined].filter(Boolean).join(" · ");
		el.createDiv({ cls: "tl-picker-meta", text: schedule + " · Line " + (task.line + 1) });
	}
	onChooseItem(task: ScannedTask): void { this.onPick(task); }
}

function scheduleFields(parent: HTMLElement, initial: Schedule): { read: () => Schedule | null; clear: () => void } {
	const fields = parent.createDiv("tl-schedule-fields");
	const field = (label: string, type: string, value: string) => {
		const wrap = fields.createEl("label");
		wrap.createSpan({ text: label });
		const input = wrap.createEl("input", { type });
		input.value = value;
		return input;
	};
	const due = field("Due date", "date", initial.due ?? "");
	const time = field("Time", "time", initial.time ?? "");
	const hours = field("Duration · hours", "number", initial.duration ? String(Math.floor(initial.duration / 60)) : "");
	const minutes = field("Duration · minutes", "number", initial.duration ? String(initial.duration % 60) : "");
	hours.min = minutes.min = "0";
	hours.step = minutes.step = "1";
	minutes.max = "59";
	const read = () => {
		const h = Number(hours.value || 0);
		const m = Number(minutes.value || 0);
		const duration = h * 60 + m;
		const result: Schedule = { ...(due.value ? { due: due.value } : {}), ...(time.value ? { time: time.value } : {}), ...(duration ? { duration } : {}) };
		if (!due.checkValidity() || !time.checkValidity() || !Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59 || !validSchedule(result)) {
			new Notice("Choose a valid date before adding a time or duration. Duration uses whole hours and minutes.");
			return null;
		}
		return result;
	};
	return { read, clear: () => { due.value = time.value = hours.value = minutes.value = ""; } };
}

function projectDestination(root: HTMLElement, app: App, plugin: TaskLoopsPlugin, initial: string, onPick: (path: string) => void): void {
	const destination = root.createDiv("tl-destination");
	destination.createSpan({ text: "Project / note" });
	const pick = destination.createEl("button", { text: "Choose project note…", attr: { "aria-label": "Pick project note", title: "Search existing notes in your vault" } });
	const selected = destination.createDiv("tl-selected-project");
	const projectLink = destination.createEl("button", { cls: "tl-open-project", text: "Open project note ↗" });
	const hint = destination.createEl("small");
	const update = (path: string) => {
		selected.setText("Selected note: " + path);
		const exists = app.vault.getAbstractFileByPath(path) instanceof TFile;
		projectLink.disabled = !exists;
		projectLink.title = exists ? "Open the selected note in a new tab. Unsaved edits stay in this dialog." : "Save the task before opening this note.";
		projectLink.onclick = () => void plugin.openNote(path);
		hint.setText(exists ? "Save to add or move the task into this note's Tasks section. If there is no Tasks section, # Tasks is appended at the bottom." : path === plugin.settings.standaloneNote ? "No project selected. Saving creates the standalone note with # Tasks. Choose project note to use an existing note instead." : "This note is unavailable. Choose another project note before saving.");
	};
	pick.onclick = () => new NotePicker(app, plugin.settings.standaloneNote, path => { onPick(path); update(path); }).open();
	update(initial);
}

export class TaskEditorModal extends Modal {
	private path: string;
	constructor(app: App, private plugin: TaskLoopsPlugin, private task: ScannedTask, private onUpdated?: () => void) {
		super(app);
		this.path = task.path;
	}
	onOpen(): void {
		const root = this.contentEl;
		root.createEl("h2", { text: "Edit task" });
		const label = root.createEl("label", { text: "Task" });
		const text = label.createEl("input", { type: "text", cls: "tl-task-input" });
		text.value = taskWording(this.task.raw);
		const links = root.createDiv("tl-note-links");
		links.createEl("button", { text: "Jump to task in note ↗", attr: { title: "Open the source note at this task in a new tab. Unsaved edits stay in this dialog." } }).onclick = () => void this.plugin.reveal(this.task);
		projectDestination(root, this.app, this.plugin, this.path, path => { this.path = path; });
		const fields = scheduleFields(root, this.task);
		root.createEl("button", { text: "Remove schedule", cls: "tl-clear-schedule" }).onclick = () => fields.clear();
		root.createEl("h3", { text: "Subtasks" });
		const children = root.createDiv("tl-existing-subtasks");
		const drawChildren = () => {
			children.empty();
			for (const child of this.plugin.allTasks().filter((task) => task.path === this.task.path && task.parentId === this.task.id)) {
				const button = children.createEl("button", { cls: "tl-existing-subtask", attr: { "aria-label": "Open subtask " + child.text } });
				button.createSpan({ cls: "tl-subtask-state", text: child.checked ? "✓" : "○" });
				button.createSpan({ text: child.text });
				button.createSpan({ cls: "tl-subtask-open", text: "↗" });
				button.onclick = () => new TaskEditorModal(this.app, this.plugin, child, drawChildren).open();
			}
		};
		drawChildren();
		const drafts: string[] = [];
		const list = root.createDiv("tl-subtask-drafts");
		const row = root.createDiv("tl-subtask-entry");
		const subtask = row.createEl("input", { type: "text", placeholder: "Add a subtask…", attr: { "aria-label": "New subtask" } });
		const add = () => {
			const value = subtask.value.trim();
			if (!value) return;
			drafts.push(value);
			subtask.value = "";
			drawDrafts();
			subtask.focus();
		};
		const drawDrafts = () => {
			list.empty();
			drafts.forEach((value, index) => {
				const item = list.createDiv("tl-subtask-draft");
				item.createSpan({ text: value });
				item.createEl("button", { text: "×", attr: { "aria-label": "Remove subtask " + value } }).onclick = () => { drafts.splice(index, 1); drawDrafts(); };
			});
		};
		row.createEl("button", { text: "Add subtask" }).onclick = add;
		subtask.onkeydown = (event) => { if (event.key === "Enter") { event.preventDefault(); add(); } };
		const selected: ScannedTask[] = [];
		const selectedList = root.createDiv("tl-selected-subtasks");
		const existingButton = root.createEl("button", { cls: "tl-choose-existing", text: "Choose existing task…" });
		const hint = root.createEl("small", { cls: "tl-subtask-hint", text: "Find a task in your notes. It and its subtasks will move here when you save." });
		const drawSelected = () => {
			selectedList.empty();
			for (const [index, child] of selected.entries()) {
				const item = selectedList.createDiv("tl-selected-subtask");
				const label = item.createDiv();
				label.createDiv({ text: child.text });
				label.createDiv({ cls: "tl-picker-meta", text: "From " + child.path + " · Added on save" });
				item.createEl("button", { text: "×", attr: { "aria-label": "Remove selection " + child.text } }).onclick = () => { selected.splice(index, 1); drawSelected(); };
			}
			existingButton.disabled = !existingSubtaskCandidates(this.plugin.allTasks(), this.task, selected).length;
			hint.setText(existingButton.disabled ? "No other open tasks available. Create a subtask above, or add a checkbox in another note." : "Find a task in your notes. It and its subtasks will move here when you save.");
		};
		existingButton.onclick = () => {
			const candidates = existingSubtaskCandidates(this.plugin.allTasks(), this.task, selected);
			const notes = [...new Set(candidates.map((task) => task.path))];
			new NotePicker(this.app, this.plugin.settings.standaloneNote, (path) => {
				const tasks = existingSubtaskCandidates(this.plugin.allTasks(), this.task, selected).filter((task) => task.path === path);
				if (!tasks.length) { new Notice("No available open tasks remain in that note."); drawSelected(); return; }
				new ExistingTaskPicker(this.app, tasks, this.plugin, (task) => { selected.push(task); drawSelected(); }).open();
			}, notes).open();
		};
		drawSelected();
		const actions = root.createDiv("tl-dialog-actions");
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save changes", cls: "mod-cta" });
		save.onclick = () => {
			const schedule = fields.read();
			if (!schedule) return;
			if (!text.value.trim()) { text.focus(); return; }
			add();
			save.disabled = true;
			void this.plugin.editTask(this.task, text.value, this.path, schedule, drafts, selected).then((ok) => {
				if (ok) this.close(); else save.disabled = false;
			});
		};
		text.focus();
	}
	onClose(): void { this.contentEl.empty(); this.onUpdated?.(); }
}

export class TaskModal extends Modal {
	private path: string;
	constructor(app: App, private plugin: TaskLoopsPlugin, private initial: Schedule = {}, path?: string) {
		super(app);
		this.path = path ?? plugin.settings.standaloneNote;
	}
	onOpen(): void {
		const root = this.contentEl;
		root.createEl("h2", { text: "Add a task" });
		const label = root.createEl("label", { text: "Task" });
		const text = label.createEl("input", { type: "text", cls: "tl-task-input", placeholder: "What needs doing?" });
		projectDestination(root, this.app, this.plugin, this.path, path => { this.path = path; });
		const fields = scheduleFields(root, this.initial);
		const actions = root.createDiv("tl-dialog-actions");
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Add task", cls: "mod-cta" });
		const commit = async () => {
			const schedule = fields.read();
			if (!schedule) return;
			if (!text.value.trim()) { text.focus(); return; }
			save.disabled = true;
			if (await this.plugin.createTask(text.value, this.path, schedule)) this.close();
			else save.disabled = false;
		};
		save.onclick = () => void commit();
		text.onkeydown = (event) => { if (event.key === "Enter" && !save.disabled) void commit(); };
		text.focus();
	}
	onClose(): void { this.contentEl.empty(); }
}
