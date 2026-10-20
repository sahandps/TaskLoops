import { renderCompletionCheckbox } from "./completion-checkbox";
import type { ScannedTask } from "../../core/types";
import type { TaskActions } from "../../application/task-actions";
import { formatDate, formatDuration, formatTime } from "../../core/schedule";

export function renderTaskCard(
	parent: HTMLElement,
	task: ScannedTask,
	compact: boolean,
	actions: TaskActions,
	edit: (task: ScannedTask) => void,
	makeDraggable: (card: HTMLElement, task: ScannedTask) => void,
): HTMLElement {
	const card = parent.createDiv(
		"tl-task" +
			(task.checked ? " is-done" : "") +
			(compact ? " is-compact" : "") +
			(task.parentId ? " is-subtask" : ""),
	);
	const content = card.createDiv("tl-task-content");
	const row = content.createDiv("tl-task-row");
	renderCompletionCheckbox(row, task, (task) => actions.complete(task));
	const open = () => edit(task);
	row.createEl("button", {
		cls: "tl-task-title",
		text: task.text,
		attr: { "aria-label": "Edit " + task.text },
	}).onclick = open;
	card.onclick = (event) => {
		if (event.target instanceof Element && !event.target.closest("button, input, a")) open();
	};
	const schedule = row.createEl("button", {
		cls: "tl-schedule-button",
		text: "⋯",
		attr: { "aria-label": "Schedule " + task.text },
	});
	schedule.onclick = open;
	const details = [
		task.due ? formatDate(task.due, actions.settings.dateFormat) : "No date",
		task.deadline ? "Deadline: " + formatDate(task.deadline, actions.settings.dateFormat) : undefined,
		task.time ? formatTime(task.time, actions.settings.timeFormat) : undefined,
		task.duration ? formatDuration(task.duration) : undefined,
	]
		.filter(Boolean)
		.join(" · ");
	card.title = task.text + " · " + details + " · " + task.path;
	content.createEl("button", {
		cls: "tl-task-meta",
		text: details,
		attr: { "aria-label": "Change schedule: " + details },
	}).onclick = open;
	if (compact)
		content.createEl("button", {
			cls: "tl-task-source",
			text: actions.noteName(task.path) + " ↗",
			attr: {
				title: "Open " + task.path + " in a new tab",
				"aria-label": "Open " + task.path + " in a new tab",
			},
		}).onclick = () => void actions.reveal(task);
	if (!task.checked) makeDraggable(card, task);
	return card;
}
