import { reviewTasks } from "../../core/task-review";
import { todayISO } from "../../core/dates";
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
	onDefer: () => void,
	dropTarget: (el: HTMLElement, onDrop: (task: ScannedTask, event: DragEvent) => void) => void,
): { matching: ScannedTask[]; list: HTMLElement; search: HTMLInputElement } {
	const side = layout.createEl("aside", {
		cls: "tl-sidebar" + (state.taskFilter === "deferred" ? " tl-showing-deferred" : ""),
		attr: { "aria-label": "Tasks by note" },
	});
	const { matching, listed, overdueCount, deferredCount } = reviewTasks(
		actions.allTasks(),
		state.query,
		state.showDone,
		state.taskFilter,
		todayISO(),
	);
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
	const review = filters.createDiv({
		cls: "tl-review-filters",
		attr: { "aria-label": "Task list filters" },
	});
	for (const [value, text] of [
		["all", "All"],
		["undated", "Unscheduled"],
		["overdue", "Overdue"],
		["deferred", "Can’t schedule"],
	] as const) {
		const button = review.createEl("button", {
			cls: "tl-review-filter" + (value === "overdue" && overdueCount ? " has-overdue" : ""),
			text,
			attr: {
				"aria-pressed": String(state.taskFilter === value),
				"aria-label":
					value === "overdue"
						? `Overdue tasks (${overdueCount})`
						: value === "deferred"
							? `Can’t schedule now (${deferredCount})`
							: text + " tasks",
			},
		});
		if (value === "overdue" || value === "deferred")
			button.createSpan({
				cls: "tl-filter-count",
				text: String(value === "overdue" ? overdueCount : deferredCount),
				attr: { "aria-hidden": "true" },
			});
		button.onclick = () => {
			state.taskFilter = value;
			onChange();
		};
	}
	const doneLabel = filters.createEl("label");
	const done = doneLabel.createEl("input", { type: "checkbox" });
	done.checked = state.showDone;
	doneLabel.createSpan({ text: "Show completed" });
	done.onchange = () => {
		state.showDone = done.checked;
		onChange();
	};
	const unschedule = side.createDiv({ cls: "tl-unschedule", text: "Drop here to remove a schedule" });
	dropTarget(unschedule, (task) => void actions.schedule(task, {}));
	const list = side.createDiv("tl-task-list");
	const q = state.query.trim();
	if (state.taskFilter === "deferred") {
		const heading = list.createDiv("tl-deferral-heading");
		heading.createEl("h3", { text: "Can’t schedule now" });
		heading.createEl("button", {
			text: "+ Add task",
			attr: { "aria-label": "Add a task that can’t be scheduled" },
		}).onclick = onDefer;
		list.createDiv({
			cls: "tl-review-summary",
			text: "Keep the reason here. Choose a date when you’re ready.",
		});
	}
	if (state.taskFilter === "overdue" && listed.length)
		list.createDiv({
			cls: "tl-review-summary",
			text: "Oldest first · Deadline takes priority over due date",
		});
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
				state.taskFilter === "deferred"
					? "No waiting tasks match. Add a new or existing task and record the reason."
					: state.taskFilter === "overdue"
						? q
							? "No overdue tasks match your search."
							: "No overdue tasks."
						: state.taskFilter === "undated" && !q
							? "No unscheduled tasks. Scheduled tasks are on the calendar."
							: q
								? "No matching tasks."
								: "No tasks yet. Add a task or write a checkbox in any note.",
		});
	return { matching, list, search };
}
