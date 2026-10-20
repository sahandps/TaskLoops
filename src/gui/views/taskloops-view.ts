import { applyPlannerTheme } from "../components/planner-theme";
import { TaskDeferralModal } from "../modals/task-deferral";
import { TaskDragController } from "../interactions/task-drag-controller";
import type { TaskViewState } from "./view-state";
import { renderNotesView } from "./notes-view";
import { renderPlannerSidebar } from "../components/planner-sidebar";
import { renderTaskCard } from "../components/task-card";
import { renderViewHeader } from "../components/view-header";
import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { CalendarScale, ScannedTask } from "../../core/types";
import { todayISO } from "../../core/dates";
import { TaskEditorModal } from "../modals/index";
import { renderCalendar } from "../calendar/calendar-view";
import { addPanelDivider } from "../interactions/panel-resize";

export const VIEW_TYPE_TASKLOOPS = "taskloops-view";

export class TaskLoopsView extends ItemView {
	private state: TaskViewState = {
		query: "",
		showDone: false,
		taskFilter: "undated",
		mode: "planner",
		noteFilter: "open",
		folder: null,
		expandedNotes: new Set(),
		collapsedNotes: new Set(),
	};
	scale: CalendarScale;
	anchor = todayISO();
	private dragController = new TaskDragController(
		() => this.contentEl,
		() => {
			if (this.pending) this.render();
		},
	);
	private resizing = false;
	private cancelResize: (() => void) | null = null;
	private pending = false;
	private calendarKey = "";
	disposeCalendar: (() => void) | null = null;
	private disposeDivider: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		public plugin: TaskActions,
	) {
		super(leaf);
		this.scale =
			Platform.isMobile && plugin.settings.lastScale === "week" ? "day" : plugin.settings.lastScale;
		this.state.mode = plugin.settings.defaultView ?? "planner";
		this.state.showDone = plugin.settings.showCompleted ?? false;
	}
	getViewType(): string {
		return VIEW_TYPE_TASKLOOPS;
	}
	getDisplayText(): string {
		return "TaskLoops";
	}
	getIcon(): string {
		return "calendar-days";
	}
	async onOpen(): Promise<void> {
		this.contentEl.addClass("tl-view");
		this.render();
	}
	async onClose(): Promise<void> {
		this.pending = false;
		this.disposeCalendar?.();
		this.disposeCalendar = null;
		this.disposeDivider?.();
		this.disposeDivider = null;
		this.cancelResize?.();
		this.dragController.clear();
	}

	hasDraggedTask(): boolean {
		return this.dragController.active;
	}

	beginResize(cancel: () => void): void {
		this.resizing = true;
		this.cancelResize = cancel;
	}
	endResize(): void {
		this.resizing = false;
		this.cancelResize = null;
		if (this.pending) this.render();
	}

	setScale(scale: CalendarScale): void {
		this.scale = scale;
		this.plugin.settings.lastScale = scale;
		void this.plugin.saveSettings();
		this.render();
	}

	render(): void {
		if (this.dragController.active || this.resizing) {
			this.pending = true;
			return;
		}
		this.pending = false;
		const root = this.contentEl;
		applyPlannerTheme(root, this.plugin.settings.theme);
		const sideScroll = root.querySelector(".tl-task-list")?.scrollTop ?? 0;
		const notesScroll = root.querySelector(".tl-notes-pane")?.scrollTop ?? 0;
		const nextCalendarKey =
			this.scale +
			":" +
			this.anchor +
			":" +
			this.plugin.settings.weekStart +
			":" +
			this.plugin.settings.startHour;
		const preserveCalendar = this.calendarKey === nextCalendarKey;
		const calendarScroll = preserveCalendar
			? root.querySelector(".tl-calendar-content")?.scrollTop
			: undefined;
		this.calendarKey = nextCalendarKey;
		const calendarLeft = preserveCalendar
			? (root.querySelector(".tl-calendar-content")?.scrollLeft ?? 0)
			: 0;
		const active = root.ownerDocument.activeElement;
		const searchFocused = active instanceof HTMLInputElement && active.classList.contains("tl-search");
		const selection = searchFocused ? active.selectionStart : null;
		this.disposeDivider?.();
		this.disposeDivider = null;
		this.disposeCalendar?.();
		this.disposeCalendar = null;
		root.empty();
		renderViewHeader(root, this.plugin, this.state, () => this.render());
		if (this.state.mode === "notes") {
			renderNotesView(
				root,
				this.plugin,
				this.state,
				(parent, task) => this.card(parent, task),
				() => this.render(),
			);
			const pane = root.querySelector(".tl-notes-pane");
			if (pane) pane.scrollTop = notesScroll;
			if (searchFocused) {
				const input = root.querySelector<HTMLInputElement>(".tl-search");
				input?.focus();
				if (selection !== null) input?.setSelectionRange(selection, selection);
			}
			return;
		}
		const layout = root.createDiv("tl-planner");
		const { matching, list, search } = renderPlannerSidebar(
			layout,
			this.plugin,
			this.state,
			(parent, task) => this.card(parent, task),
			() => this.render(),
			() => new TaskDeferralModal(this.app, this.plugin).open(),
			(element, onDrop) => this.dropTarget(element, onDrop),
		);
		const divider = layout.createDiv({
			cls: "tl-panel-divider",
			attr: {
				role: "separator",
				tabindex: "0",
				"aria-label": "Resize task list and calendar",
				title: "Drag to resize panels · arrow keys adjust · double-click to reset",
			},
		});
		const main = layout.createEl("main", { cls: "tl-calendar", attr: { "aria-label": "Task calendar" } });
		renderCalendar(main, this, matching);
		this.disposeDivider = addPanelDivider(layout, divider, {
			width: this.plugin.settings.panelWidth ?? 260,
			height: this.plugin.settings.panelHeight ?? 220,
			begin: (cancel) => this.beginResize(cancel),
			end: () => this.endResize(),
			save: (size, stacked) => {
				if (stacked) this.plugin.settings.panelHeight = size;
				else this.plugin.settings.panelWidth = size;
				void this.plugin.saveSettings();
			},
		});
		list.scrollTop = sideScroll;
		const scroller = root.querySelector(".tl-calendar-content");
		if (scroller) {
			scroller.scrollTop = calendarScroll ?? 0;
			scroller.scrollLeft = calendarLeft;
		}
		if (searchFocused) {
			search.focus();
			if (selection !== null) search.setSelectionRange(selection, selection);
		}
	}

	card(parent: HTMLElement, task: ScannedTask, compact = false): HTMLElement {
		return renderTaskCard(
			parent,
			task,
			compact,
			this.plugin,
			(task) => new TaskEditorModal(this.app, this.plugin, task).open(),
			(card, task) => this.dragController.makeDraggable(card, task),
			(task) => new TaskDeferralModal(this.app, this.plugin, task).open(),
		);
	}

	dropTarget(el: HTMLElement, onDrop: (task: ScannedTask, event: DragEvent) => void): void {
		this.dragController.dropTarget(el, onDrop);
	}
}
