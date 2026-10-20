import { setIcon } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import type { TaskViewState } from "../views/view-state";

export function renderPlannerSidebar(
	layout: HTMLElement,
	actions: TaskActions,
	state: TaskViewState,
	renderCard: (parent: HTMLElement, task: ScannedTask) => HTMLElement,
	onChange: () => void,
	dropTarget: (el: HTMLElement, onDrop: (task: ScannedTask, event: DragEvent) => void) => void,
): { matching: ScannedTask[]; list: HTMLElement; search: HTMLInputElement } {
	const side = layout.createEl("aside", { cls: "tl-sidebar", attr: { "aria-label": "Tasks by note" } });
	const tasks = actions.allTasks().filter((task) => state.showDone || !task.checked);
	const search = side.createEl("input", {
		cls: "tl-search",
		type: "search",
		placeholder: "Search tasks or notes…",
		attr: { "aria-label": "Search tasks or notes" },
	});
	search.value = state.query;
	search.oninput = () => {
		state.query = search.value;
		onChange();
	};
	const filters = side.createDiv("tl-filters");
	const doneLabel = filters.createEl("label");
	const done = doneLabel.createEl("input", { type: "checkbox" });
	done.checked = state.showDone;
	doneLabel.createSpan({ text: "Show completed" });
	done.onchange = () => {
		state.showDone = done.checked;
		onChange();
	};
	const undatedLabel = filters.createEl("label");
	const undated = undatedLabel.createEl("input", { type: "checkbox" });
	undated.checked = state.onlyUndated;
	undatedLabel.createSpan({ text: "Unscheduled only" });
	undated.onchange = () => {
		state.onlyUndated = undated.checked;
		onChange();
	};
	const unschedule = side.createDiv({ cls: "tl-unschedule", text: "Drop here to remove a schedule" });
	dropTarget(unschedule, (task) => void actions.schedule(task, {}));
	const list = side.createDiv("tl-task-list");
	const q = state.query.trim().toLocaleLowerCase();
	const matching = tasks.filter((task) => (task.text + " " + task.path).toLocaleLowerCase().includes(q));
	const listed = matching.filter((task) => !state.onlyUndated || !task.due);
	let path: string | undefined;
	for (const task of listed) {
		if (task.path !== path) {
			path = task.path;
			const heading = list.createDiv("tl-note-heading");
			heading.createEl("button", {
				cls: "tl-note-name",
				text: actions.noteName(path),
				attr: { title: "Open " + path + " in a new tab" },
			}).onclick = () => void actions.reveal(task);
			const jump = heading.createEl("button", {
				cls: "tl-open-note",
				attr: { title: "Open note in new tab", "aria-label": "Open " + path + " in a new tab" },
			});
			setIcon(jump, "square-arrow-out-up-right");
			jump.onclick = () => void actions.reveal(task);
			heading.createEl("button", { text: "+", attr: { "aria-label": "Add task to " + path } }).onclick =
				() => actions.newTask({}, task.path);
			list.createDiv({ cls: "tl-note-path", text: path });
		}
		renderCard(list, task);
	}
	if (!listed.length)
		list.createEl("p", {
			cls: "tl-empty",
			text:
				state.onlyUndated && !q
					? "No unscheduled tasks. Scheduled tasks are on the calendar."
					: q
						? "No matching tasks."
						: "No tasks yet. Add a task or write a checkbox in any note.",
		});
	return { matching, list, search };
}
