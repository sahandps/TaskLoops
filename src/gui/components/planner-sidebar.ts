import { renderTaskCompletionTabs } from "./task-completion-tabs";
import { noteProgress } from "../../core/task-progress";
import { renderTaskProgress } from "./task-progress";
import { taskGroupFolds } from "./task-group-folds";
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
	const tasks = actions.allTasks();
	const progress = actions.settings.showProgressBars !== false ? noteProgress(tasks) : undefined;
	const {
		matching,
		listed: reviewed,
		overdueCount,
		deferredCount,
	} = reviewTasks(tasks, state.query, state.showDone, state.taskFilter, todayISO());
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
		state.completionTab = "open";
		const list = side.querySelector<HTMLElement>(".tl-task-list");
		if (list) list.scrollTop = 0;
		onChange();
	};
	const unschedule = side.createDiv({ cls: "tl-unschedule", text: "Drop here to remove a schedule" });
	dropTarget(unschedule, (task) => void actions.schedule(task, {}));
	const listed = state.showDone ? renderTaskCompletionTabs(side, reviewed, state, onChange) : reviewed;
	const folds = taskGroupFolds(state.collapsedNotes);
	folds.controls(side.createDiv("tl-group-controls"));
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
	// Keep overdue order intact, including notes that occur in multiple age groups.
	const segments: { path: string; tasks: ScannedTask[] }[] = [];
	for (const task of listed) {
		const previous = segments[segments.length - 1];
		if (previous?.path === task.path) previous.tasks.push(task);
		else segments.push({ path: task.path, tasks: [task] });
	}
	for (const group of segments) {
		const path = group.path;
		const task = group.tasks[0];
		const section = list.createDiv("tl-task-group");
		const heading = section.createDiv("tl-note-heading");
		section.createDiv({ cls: "tl-note-path", text: path });
		if (progress) renderTaskProgress(section, path, progress.get(path));
		const body = section.createDiv("tl-group-tasks");
		folds.add(path, heading, body, group.tasks.length);
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
			() => actions.newTask({}, path);
		for (const entry of group.tasks) renderCard(body, entry);
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
