import { renderTaskTagFilter } from "./task-tag-filter";
import { todayISO } from "../../core/dates";
import type { TaskActions } from "../../application/task-actions";
import type { TaskViewState } from "../views/view-state";

export function renderViewHeader(
	root: HTMLElement,
	actions: TaskActions,
	state: TaskViewState,
	onChange: () => void,
): void {
	const header = root.createDiv("tl-header");
	header.createEl("h2", { text: "TaskLoops" });
	const views = header.createDiv({ cls: "tl-view-switch", attr: { "aria-label": "TaskLoops views" } });
	for (const [value, label] of [
		["dashboard", "Dashboard"],
		["today", "Today"],
		["planner", "Planner"],
		["kanban", "Kanban"],
		["notes", "Notes"],
	] as const) {
		const button = views.createEl("button", {
			text: label,
			attr: { "aria-pressed": String(state.mode === value), "data-tl-view": value },
		});
		button.onclick = () => {
			state.mode = value;
			if (value === "dashboard") state.dashboardPage = undefined;
			onChange();
			root.querySelector<HTMLElement>(`[data-tl-view="${value}"]`)?.focus();
		};
	}
	const tagControls = header.createDiv("tl-header-tags");
	renderTaskTagFilter(tagControls, actions.allTasks(), actions, () => {
		onChange();
		root.querySelector<HTMLElement>(".tl-tag-picker summary")?.focus();
	});
	if (actions.settings.noteTagFilter) {
		tagControls.createEl("button", {
			text: "Clear",
			attr: { "aria-label": "Clear tag filter", title: "Show tasks from all tags" },
		}).onclick = () => {
			actions.settings.noteTagFilter = null;
			void actions.saveSettings();
			onChange();
			root.querySelector<HTMLElement>(".tl-tag-picker summary")?.focus();
		};
	}
	header.createEl("button", { text: "+ Task", cls: "mod-cta" }).onclick = () => {
		const project = state.mode === "dashboard" ? state.dashboardPage : undefined;
		if (project?.kind === "project" && actions.settings.projectNotes.includes(project.path))
			actions.newTask(undefined, project.path);
		else actions.newTask(state.mode === "today" ? { due: todayISO() } : undefined);
	};
	header.createEl("button", { text: "Refresh" }).onclick = () => void actions.rescan();
}
