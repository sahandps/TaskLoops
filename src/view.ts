import { ItemView, WorkspaceLeaf } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { CalendarScale, ScannedTask } from "./types";
import { formatDate, formatDuration } from "./schedule";
import { todayISO } from "./dates";
import { TaskEditorModal } from "./modals";
import { renderCalendar } from "./calendar";

export const VIEW_TYPE_TASKLOOPS = "taskloops-view";

export class TaskLoopsView extends ItemView {
	scale: CalendarScale;
	anchor = todayISO();
	private query = "";
	private showDone = false;
	private onlyUndated = false;
	private dragging: ScannedTask | null = null;
	private resizing = false;
	private cancelResize: (() => void) | null = null;
	private pending = false;
	private calendarKey = "";

	constructor(leaf: WorkspaceLeaf, public plugin: TaskLoopsPlugin) {
		super(leaf);
		this.scale = plugin.settings.lastScale;
	}
	getViewType(): string { return VIEW_TYPE_TASKLOOPS; }
	getDisplayText(): string { return "TaskLoops"; }
	getIcon(): string { return "calendar-days"; }
	async onOpen(): Promise<void> { this.contentEl.addClass("tl-view"); this.render(); }
	async onClose(): Promise<void> { this.cancelResize?.(); this.dragging = null; }

	hasDraggedTask(): boolean { return this.dragging !== null; }

	beginResize(cancel: () => void): void { this.resizing = true; this.cancelResize = cancel; }
	endResize(): void { this.resizing = false; this.cancelResize = null; if (this.pending) this.render(); }

	setScale(scale: CalendarScale): void {
		this.scale = scale;
		this.plugin.settings.lastScale = scale;
		void this.plugin.saveSettings();
		this.render();
	}

	render(): void {
		if (this.dragging || this.resizing) { this.pending = true; return; }
		this.pending = false;
		const root = this.contentEl;
		const sideScroll = root.querySelector(".tl-task-list")?.scrollTop ?? 0;
		const nextCalendarKey = this.scale + ":" + this.anchor;
		const preserveCalendar = this.calendarKey === nextCalendarKey;
		const calendarScroll = preserveCalendar ? root.querySelector(".tl-calendar-content")?.scrollTop : undefined;
		this.calendarKey = nextCalendarKey;
		const calendarLeft = preserveCalendar ? root.querySelector(".tl-calendar-content")?.scrollLeft ?? 0 : 0;
		const active = root.ownerDocument.activeElement;
		const searchFocused = active instanceof HTMLInputElement && active.classList.contains("tl-search");
		const selection = searchFocused ? active.selectionStart : null;
		root.empty();
		const header = root.createDiv("tl-header");
		header.createEl("h2", { text: "TaskLoops" });
		header.createEl("button", { text: "+ Task", cls: "mod-cta" }).onclick = () => this.plugin.newTask();
		header.createEl("button", { text: "Open full view" }).onclick = () => void this.plugin.activateView(true);
		header.createEl("button", { text: "Refresh" }).onclick = () => void this.plugin.rescan();
		const layout = root.createDiv("tl-planner");
		const side = layout.createEl("aside", { cls: "tl-sidebar", attr: { "aria-label": "Tasks by note" } });
		const tasks = this.plugin.allTasks().filter((task) => this.showDone || !task.checked);
		const search = side.createEl("input", { cls: "tl-search", type: "search", placeholder: "Search tasks or notes…", attr: { "aria-label": "Search tasks or notes" } });
		search.value = this.query;
		search.oninput = () => { this.query = search.value; this.render(); };
		const filters = side.createDiv("tl-filters");
		const doneLabel = filters.createEl("label");
		const done = doneLabel.createEl("input", { type: "checkbox" });
		done.checked = this.showDone;
		doneLabel.createSpan({ text: "Show completed" });
		done.onchange = () => { this.showDone = done.checked; this.render(); };
		const undatedLabel = filters.createEl("label");
		const undated = undatedLabel.createEl("input", { type: "checkbox" });
		undated.checked = this.onlyUndated;
		undatedLabel.createSpan({ text: "Undated only" });
		undated.onchange = () => { this.onlyUndated = undated.checked; this.render(); };
		const unschedule = side.createDiv({ cls: "tl-unschedule", text: "Drop here to remove a schedule" });
		this.dropTarget(unschedule, (task) => void this.plugin.schedule(task, {}));
		const list = side.createDiv("tl-task-list");
		const q = this.query.trim().toLocaleLowerCase();
		const matching = tasks.filter((task) => (task.text + " " + task.path).toLocaleLowerCase().includes(q));
		const listed = matching.filter((task) => !this.onlyUndated || !task.due);
		let path: string | undefined;
		for (const task of listed) {
			if (task.path !== path) {
				path = task.path;
				const heading = list.createDiv("tl-note-heading");
				heading.createEl("button", { text: this.plugin.noteName(path), attr: { title: path } }).onclick = () => void this.plugin.reveal(task);
				heading.createEl("button", { text: "+", attr: { "aria-label": "Add task to " + path } }).onclick = () => this.plugin.newTask({}, task.path);
				list.createDiv({ cls: "tl-note-path", text: path });
			}
			this.card(list, task);
		}
		if (!listed.length) list.createEl("p", { cls: "tl-empty", text: q || this.onlyUndated ? "No matching tasks." : "No tasks yet. Add a task or write a checkbox in any note." });
		const main = layout.createEl("main", { cls: "tl-calendar", attr: { "aria-label": "Task calendar" } });
		renderCalendar(main, this, matching);
		list.scrollTop = sideScroll;
		const scroller = root.querySelector(".tl-calendar-content");
		if (scroller) { scroller.scrollTop = calendarScroll ?? ((this.scale === "day" || this.scale === "week") ? 8 * 64 : 0); scroller.scrollLeft = calendarLeft; }
		if (searchFocused) { search.focus(); if (selection !== null) search.setSelectionRange(selection, selection); }
	}

	card(parent: HTMLElement, task: ScannedTask, compact = false): HTMLElement {
		const card = parent.createDiv("tl-task" + (task.checked ? " is-done" : "") + (compact ? " is-compact" : "") + (task.parentId ? " is-subtask" : ""));
		const content = card.createDiv("tl-task-content");
		const row = content.createDiv("tl-task-row");
		const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": "Complete " + task.text } });
		check.checked = task.checked;
		check.disabled = task.checked;
		check.onchange = () => { check.disabled = true; void this.plugin.complete(task); };
		const open = () => new TaskEditorModal(this.app, this.plugin, task).open();
		row.createEl("button", { cls: "tl-task-title", text: task.text, attr: { "aria-label": "Edit " + task.text } }).onclick = open;
		card.onclick = (event) => {
			if (event.target instanceof Element && !event.target.closest("button, input, a")) open();
		};
		const schedule = row.createEl("button", { cls: "tl-schedule-button", text: "⋯", attr: { "aria-label": "Schedule " + task.text } });
		schedule.onclick = () => new TaskEditorModal(this.app, this.plugin, task).open();
		const details = [task.due ? formatDate(task.due, this.plugin.settings.dateFormat) : "No date", task.time, task.duration ? formatDuration(task.duration) : undefined].filter(Boolean).join(" · ");
		card.title = task.text + " · " + details + " · " + task.path;
		content.createEl("button", { cls: "tl-task-meta", text: details, attr: { "aria-label": "Change schedule: " + details } }).onclick = () => new TaskEditorModal(this.app, this.plugin, task).open();
		if (compact) content.createEl("button", { cls: "tl-task-source", text: this.plugin.noteName(task.path), attr: { title: task.path } }).onclick = () => void this.plugin.reveal(task);
		if (!task.checked) this.makeDraggable(card, task);
		return card;
	}

	private makeDraggable(card: HTMLElement, task: ScannedTask): void {
		card.draggable = true;
		card.addEventListener("dragstart", (event) => {
			this.dragging = task;
			event.dataTransfer?.setData("application/x-taskloops", task.id);
			if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
			card.addClass("is-dragging");
		});
		card.addEventListener("dragend", () => {
			this.dragging = null;
			card.removeClass("is-dragging");
			this.contentEl.querySelectorAll(".is-drop-target").forEach((el) => el.removeClass("is-drop-target"));
			this.contentEl.querySelectorAll(".tl-drop-time").forEach((el) => el.removeClass("is-visible"));
			if (this.pending) this.render();
		});
	}

	dropTarget(el: HTMLElement, onDrop: (task: ScannedTask, event: DragEvent) => void): void {
		el.addEventListener("dragover", (event) => {
			if (!this.dragging) return;
			event.preventDefault();
			event.stopPropagation();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
			el.addClass("is-drop-target");
		});
		el.addEventListener("dragleave", (event) => {
			if (!(event.relatedTarget instanceof Node) || !el.contains(event.relatedTarget)) el.removeClass("is-drop-target");
		});
		el.addEventListener("drop", (event) => {
			if (!this.dragging) return;
			event.preventDefault();
			event.stopPropagation();
			const task = this.dragging;
			this.dragging = null;
			el.removeClass("is-drop-target");
			onDrop(task, event);
			if (this.pending) this.render();
		});
	}
}
