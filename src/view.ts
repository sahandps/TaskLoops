import { ItemView, Platform, setIcon, WorkspaceLeaf } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { CalendarScale, ScannedTask } from "./types";
import { formatDate, formatDuration, formatTime } from "./schedule";
import { todayISO } from "./dates";
import { TaskEditorModal } from "./modals";
import { renderCalendar } from "./calendar";
import { noteFolder, noteGroups, NoteFilter } from "./note-grid";
import { addPanelDivider } from "./panel-resize";

export const VIEW_TYPE_TASKLOOPS = "taskloops-view";

export class TaskLoopsView extends ItemView {
	scale: CalendarScale;
	anchor = todayISO();
	private query = "";
	private showDone = false;
	private onlyUndated = true;
	private dragging: ScannedTask | null = null;
	private resizing = false;
	private cancelResize: (() => void) | null = null;
	private pending = false;
	private calendarKey = "";
	private mode: "planner" | "notes";
	private noteFilter: NoteFilter = "open";
	private folder: string | null = null;
	private expandedNotes = new Set<string>();
	private disposeDivider: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, public plugin: TaskLoopsPlugin) {
		super(leaf);
		this.scale = Platform.isMobile && plugin.settings.lastScale === "week" ? "day" : plugin.settings.lastScale;
		this.mode = plugin.settings.defaultView ?? "planner";
		this.showDone = plugin.settings.showCompleted ?? false;
	}
	getViewType(): string { return VIEW_TYPE_TASKLOOPS; }
	getDisplayText(): string { return "TaskLoops"; }
	getIcon(): string { return "calendar-days"; }
	async onOpen(): Promise<void> { this.contentEl.addClass("tl-view"); this.render(); }
	async onClose(): Promise<void> { this.pending = false; this.disposeDivider?.(); this.disposeDivider = null; this.cancelResize?.(); this.dragging = null; }

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
		const notesScroll = root.querySelector(".tl-notes-pane")?.scrollTop ?? 0;
		const nextCalendarKey = this.scale + ":" + this.anchor + ":" + this.plugin.settings.weekStart + ":" + this.plugin.settings.startHour;
		const preserveCalendar = this.calendarKey === nextCalendarKey;
		const calendarScroll = preserveCalendar ? root.querySelector(".tl-calendar-content")?.scrollTop : undefined;
		this.calendarKey = nextCalendarKey;
		const calendarLeft = preserveCalendar ? root.querySelector(".tl-calendar-content")?.scrollLeft ?? 0 : 0;
		const active = root.ownerDocument.activeElement;
		const searchFocused = active instanceof HTMLInputElement && active.classList.contains("tl-search");
		const selection = searchFocused ? active.selectionStart : null;
		this.disposeDivider?.(); this.disposeDivider = null;
		root.empty();
		const header = root.createDiv("tl-header");
		header.createEl("h2", { text: "TaskLoops" });
		const views = header.createDiv({ cls: "tl-view-switch", attr: { "aria-label": "TaskLoops views" } });
		for (const [value, label] of [["planner", "Planner"], ["notes", "Notes"]] as const) {
			const button = views.createEl("button", { text: label, attr: { "aria-pressed": String(this.mode === value) } });
			button.onclick = () => { this.mode = value; this.render(); };
		}
		header.createEl("button", { text: "+ Task", cls: "mod-cta" }).onclick = () => this.plugin.newTask();
		header.createEl("button", { text: "Refresh" }).onclick = () => void this.plugin.rescan();
		if (this.mode === "notes") {
			this.renderNotes(root);
			const pane = root.querySelector(".tl-notes-pane");
			if (pane) pane.scrollTop = notesScroll;
			if (searchFocused) {
				const input = root.querySelector<HTMLInputElement>(".tl-search");
				input?.focus(); if (selection !== null) input?.setSelectionRange(selection, selection);
			}
			return;
		}
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
		undatedLabel.createSpan({ text: "Unscheduled only" });
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
				heading.createEl("button", { cls: "tl-note-name", text: this.plugin.noteName(path), attr: { title: "Open " + path + " in a new tab" } }).onclick = () => void this.plugin.reveal(task);
				const jump = heading.createEl("button", { cls: "tl-open-note", attr: { title: "Open note in new tab", "aria-label": "Open " + path + " in a new tab" } });
				setIcon(jump, "square-arrow-out-up-right");
				jump.onclick = () => void this.plugin.reveal(task);
				heading.createEl("button", { text: "+", attr: { "aria-label": "Add task to " + path } }).onclick = () => this.plugin.newTask({}, task.path);
				list.createDiv({ cls: "tl-note-path", text: path });
			}
			this.card(list, task);
		}
		if (!listed.length) list.createEl("p", { cls: "tl-empty", text: this.onlyUndated && !q ? "No unscheduled tasks. Scheduled tasks are on the calendar." : q ? "No matching tasks." : "No tasks yet. Add a task or write a checkbox in any note." });
		const divider = layout.createDiv({ cls: "tl-panel-divider", attr: { role: "separator", tabindex: "0", "aria-label": "Resize task list and calendar", title: "Drag to resize panels · arrow keys adjust · double-click to reset" } });
		const main = layout.createEl("main", { cls: "tl-calendar", attr: { "aria-label": "Task calendar" } });
		renderCalendar(main, this, matching);
		this.disposeDivider = addPanelDivider(layout, divider, {
			width: this.plugin.settings.panelWidth ?? 260, height: this.plugin.settings.panelHeight ?? 220,
			begin: cancel => this.beginResize(cancel), end: () => this.endResize(),
			save: (size, stacked) => { if (stacked) this.plugin.settings.panelHeight = size; else this.plugin.settings.panelWidth = size; void this.plugin.saveSettings(); },
		});
		list.scrollTop = sideScroll;
		const scroller = root.querySelector(".tl-calendar-content");
		if (scroller) { scroller.scrollTop = calendarScroll ?? ((this.scale === "day" || this.scale === "week") ? (this.plugin.settings.startHour ?? 8) * 64 : 0); scroller.scrollLeft = calendarLeft; }
		if (searchFocused) { search.focus(); if (selection !== null) search.setSelectionRange(selection, selection); }
	}

	private renderNotes(root: HTMLElement): void {
		const tasks = this.plugin.allTasks();
		const pane = root.createDiv("tl-notes-pane" + (this.plugin.settings.noteDensity === "compact" ? " is-compact-grid" : ""));
		const controls = pane.createDiv("tl-notes-controls");
		const search = controls.createEl("input", { cls: "tl-search", type: "search", placeholder: "Search notes and tasks…", attr: { "aria-label": "Search notes and tasks" } });
		search.value = this.query;
		search.oninput = () => { this.query = search.value; this.render(); };
		const folders = [...new Set(tasks.map(task => noteFolder(task.path)))].sort();
		if (this.folder !== null && !folders.includes(this.folder)) this.folder = null;
		const folder = controls.createEl("select", { attr: { "aria-label": "Filter notes by folder" } });
		folder.createEl("option", { text: "All folders", value: "all" });
		folders.forEach((path, i) => folder.createEl("option", { text: path || "Vault root", value: String(i) }));
		folder.value = this.folder === null ? "all" : String(folders.indexOf(this.folder));
		folder.onchange = () => { this.folder = folder.value === "all" ? null : folders[Number(folder.value)]; this.render(); };
		const filters = pane.createDiv("tl-note-filters");
		for (const [value, text] of [["all", "All task notes"], ["open", "With open tasks"], ["today", "Due today"], ["undated", "Undated tasks"]] as const) {
			filters.createEl("button", { text, attr: { "aria-pressed": String(this.noteFilter === value) } }).onclick = () => { this.noteFilter = value; this.render(); };
		}
		const groups = noteGroups(tasks, this.query, this.folder, this.noteFilter, todayISO());
		pane.createDiv({ cls: "tl-notes-count", text: `${groups.length} ${groups.length === 1 ? "note" : "notes"}`, attr: { "aria-live": "polite" } });
		const grid = pane.createDiv("tl-notes-grid");
		for (const group of groups) {
			const note = grid.createEl("article", { cls: "tl-note-card" });
			const heading = note.createDiv("tl-note-heading");
			heading.createEl("button", { cls: "tl-note-name", text: this.plugin.noteName(group.path), attr: { title: "Open note in a new tab" } }).onclick = () => void this.plugin.reveal(group.tasks[0]);
			const jump = heading.createEl("button", { cls: "tl-open-note", attr: { "aria-label": "Open " + group.path + " in a new tab", title: "Open note in a new tab" } });
			setIcon(jump, "square-arrow-out-up-right"); jump.onclick = () => void this.plugin.reveal(group.tasks[0]);
			note.createDiv({ cls: "tl-note-path", text: group.path });
			const expanded = this.expandedNotes.has(group.path);
			const limit = this.plugin.settings.notePreviewLimit ?? 5;
			const preview = note.createDiv("tl-note-preview");
			for (const task of expanded ? group.tasks : group.tasks.slice(0, limit)) {
				const card = this.card(preview, task);
				if (!task.due && !task.time && !task.duration) card.querySelector(".tl-task-meta")?.remove();
			}
			if (group.tasks.length > limit) note.createEl("button", { cls: "tl-note-expand", text: expanded ? "Show less" : `Show all ${group.tasks.length} tasks`, attr: { "aria-expanded": String(expanded) } }).onclick = () => {
				if (expanded) this.expandedNotes.delete(group.path); else this.expandedNotes.add(group.path); this.render();
			};
			const footer = note.createDiv("tl-note-footer");
			footer.createSpan({ text: `${group.open} open · ${group.tasks.length} total` });
			footer.createEl("button", { text: "+ Task", attr: { "aria-label": "Add task to " + group.path } }).onclick = () => this.plugin.newTask({}, group.path);
		}
		if (!groups.length) grid.createEl("p", { cls: "tl-empty", text: tasks.length ? "No notes match these filters." : "No task notes yet. Add a task or write a Markdown checkbox in a note." });
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
		const details = [task.due ? formatDate(task.due, this.plugin.settings.dateFormat) : "No date", task.time ? formatTime(task.time, this.plugin.settings.timeFormat) : undefined, task.duration ? formatDuration(task.duration) : undefined].filter(Boolean).join(" · ");
		card.title = task.text + " · " + details + " · " + task.path;
		content.createEl("button", { cls: "tl-task-meta", text: details, attr: { "aria-label": "Change schedule: " + details } }).onclick = () => new TaskEditorModal(this.app, this.plugin, task).open();
		if (compact) content.createEl("button", { cls: "tl-task-source", text: this.plugin.noteName(task.path) + " ↗", attr: { title: "Open " + task.path + " in a new tab", "aria-label": "Open " + task.path + " in a new tab" } }).onclick = () => void this.plugin.reveal(task);
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
