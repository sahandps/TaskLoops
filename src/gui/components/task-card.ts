import { isDeferred } from "../../core/task-deferral";
import { shiftISO } from "../../core/dates";
import { overdueDays } from "../../core/task-review";
import { todayISO } from "../../core/dates";
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
	defer: (task: ScannedTask) => void,
): HTMLElement {
	const late = overdueDays(task, todayISO());
	const card = parent.createDiv(
		"tl-task" +
			(task.checked ? " is-done" : "") +
			(late ? " is-overdue" : "") +
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
	if (late)
		content.createSpan({
			cls: "tl-overdue-label",
			text: `${late} ${late === 1 ? "day" : "days"} overdue`,
		});
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
	if (isDeferred(task)) {
		const reason = content.createDiv("tl-deferral-reason");
		reason.createDiv({ cls: "tl-deferral-reason-label", text: "Can’t schedule now" });
		reason.createDiv({ text: task.deferral!.reason });
		const choices = content.createDiv("tl-scheduling-alternatives");
		choices.createSpan({ text: "Try a date", cls: "tl-field-hint" });
		for (const [label, offset] of [
			["Today", 0],
			["Tomorrow", 1],
			["Next week", 7],
		] as const)
			choices.createEl("button", {
				text: label,
				attr: { "aria-label": `Schedule ${task.text} ${label.toLowerCase()}` },
			}).onclick = () => void actions.schedule(task, { due: shiftISO(todayISO(), offset) });
		choices.createEl("button", { text: "Choose date…" }).onclick = open;
	}
	if (!task.checked)
		content.createEl("button", {
			cls: "tl-defer-task",
			text: isDeferred(task) ? "Edit reason" : "Can’t schedule now",
			attr: { "aria-label": `Record why ${task.text} can’t be scheduled` },
		}).onclick = () => defer(task);
	if (!task.checked) makeDraggable(card, task);
	return card;
}
