import { App, FuzzySuggestModal, Modal, Notice } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { ScannedTask, Schedule } from "./types";
import { validSchedule } from "./schedule";
import { taskWording } from "./task-edits";

export class NotePicker extends FuzzySuggestModal<string> {
	constructor(app: App, private standalone: string, private onPick: (path: string) => void) {
		super(app);
		this.setPlaceholder("Search project notes…");
		this.setInstructions([
			{ command: "↑ ↓", purpose: "navigate notes" },
			{ command: "↵", purpose: "pick project" },
			{ command: "esc", purpose: "cancel" },
		]);
	}
	getItems(): string[] {
		return [...new Set([this.standalone, ...this.app.vault.getMarkdownFiles().map((file) => file.path)])].sort((a, b) => a.localeCompare(b));
	}
	getItemText(path: string): string { return path === this.standalone ? "Standalone tasks — " + path : path.replace(/\.md$/, ""); }
	onChooseItem(path: string): void { this.onPick(path); }
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

export class TaskEditorModal extends Modal {
	private path: string;
	constructor(app: App, private plugin: TaskLoopsPlugin, private task: ScannedTask) {
		super(app);
		this.path = task.path;
	}
	onOpen(): void {
		const root = this.contentEl;
		root.createEl("h2", { text: "Edit task" });
		const label = root.createEl("label", { text: "Task" });
		const text = label.createEl("input", { type: "text", cls: "tl-task-input" });
		text.value = taskWording(this.task.raw);
		const destination = root.createDiv("tl-destination");
		destination.createSpan({ text: "Project / note" });
		const pick = destination.createEl("button", { text: this.path, attr: { "aria-label": "Pick project note", title: "Search notes in your vault" } });
		pick.onclick = () => new NotePicker(this.app, this.plugin.settings.standaloneNote, (path) => { this.path = path; pick.setText(path); }).open();
		destination.createEl("small", { text: "Choosing another note moves this task and its subtasks under Tasks:." });
		const fields = scheduleFields(root, this.task);
		root.createEl("button", { text: "Remove schedule", cls: "tl-clear-schedule" }).onclick = () => fields.clear();
		root.createEl("h3", { text: "Subtasks" });
		const existing = this.plugin.allTasks().filter((task) => task.path === this.task.path && task.parentId === this.task.id);
		for (const child of existing) {
			root.createDiv({ cls: "tl-existing-subtask", text: (child.checked ? "✓ " : "○ ") + child.text });
		}
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
		const actions = root.createDiv("tl-dialog-actions");
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save changes", cls: "mod-cta" });
		save.onclick = () => {
			const schedule = fields.read();
			if (!schedule) return;
			if (!text.value.trim()) { text.focus(); return; }
			add();
			save.disabled = true;
			void this.plugin.editTask(this.task, text.value, this.path, schedule, drafts).then((ok) => {
				if (ok) this.close(); else save.disabled = false;
			});
		};
		text.focus();
	}
	onClose(): void { this.contentEl.empty(); }
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
		const destination = root.createDiv("tl-destination");
		destination.createSpan({ text: "Project / note" });
		const pick = destination.createEl("button", { text: this.path, attr: { "aria-label": "Pick project note", title: "Search notes in your vault" } });
		pick.onclick = () => new NotePicker(this.app, this.plugin.settings.standaloneNote, (path) => { this.path = path; pick.setText(path); }).open();
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
