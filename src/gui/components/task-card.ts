import { priorityBadge, projectAccent } from "./task-appearance";
import { isDeferred } from "../../core/task-deferral";
import { shiftISO } from "../../core/dates";
import { overdueDays } from "../../core/task-review";
import { todayISO } from "../../core/dates";
import { renderCompletionCheckbox } from "./completion-checkbox";
import type { ScannedTask } from "../../core/types";
import type { TaskActions } from "../../application/task-actions";
import { taskDisplayTitle } from "../../core/text";
import { scheduleSummary } from "./task-schedule-summary";
import { formatDate, formatDuration } from "../../core/schedule";
import { describeRepeat, parseRepeat } from "../../core/repeat";

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
	const title = taskDisplayTitle(task.text);
	const deferred = isDeferred(task);
	const card = parent.createDiv(
		"tl-task" +
			(task.checked ? " is-done" : "") +
			(late ? " is-overdue" : "") +
			(compact ? " is-compact" : "") +
			(task.parentId ? " is-subtask" : ""),
	);
	projectAccent(card, task.path, actions.settings);
	const content = card.createDiv("tl-task-content");
	const row = content.createDiv("tl-task-row");
	renderCompletionCheckbox(row, task, (task) => actions.complete(task));
	const open = () => edit(task);
	row.createEl("button", {
		cls: "tl-task-title",
		text: title,
		attr: { "aria-label": "Edit " + title },
	}).onclick = open;
	card.onclick = (event) => {
		if (event.target instanceof Element && !event.target.closest("button, input, select, a")) open();
	};
	priorityBadge(row, task, actions.settings);
	const summary = scheduleSummary(task, actions.settings, deferred);
	const scheduleRow = content.createDiv("tl-card-schedule");
	scheduleRow.createEl("button", {
		cls: "tl-task-meta tl-schedule-summary",
		text: summary.label,
		attr: { "data-state": summary.state, "aria-label": "Change schedule: " + summary.label },
	}).onclick = open;
	if (late)
		scheduleRow.createSpan({
			cls: "tl-overdue-label",
			text: `${late} ${late === 1 ? "day" : "days"} overdue`,
		});
	const repeatRule = task.repeat ? parseRepeat(task.repeat) : undefined;
	const details = [
		task.deadline === task.due && task.deadline ? "Deadline on scheduled date" : undefined,
		task.duration ? formatDuration(task.duration) : undefined,
		repeatRule
			? "↻ " + describeRepeat(repeatRule, (iso) => formatDate(iso, actions.settings.dateFormat))
			: undefined,
	]
		.filter(Boolean)
		.join(" · ");
	card.title = [title, summary.label, details, task.path].filter(Boolean).join(" · ");
	if (details) content.createDiv({ cls: "tl-task-schedule-details", text: details });
	if (compact)
		content.createEl("button", {
			cls: "tl-task-source",
			text: actions.noteName(task.path) + " ↗",
			attr: {
				title: "Open " + task.path + " in a new tab",
				"aria-label": "Open " + task.path + " in a new tab",
			},
		}).onclick = () => void actions.reveal(task);
	if (deferred) {
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
				attr: { "aria-label": `Schedule ${title} ${label.toLowerCase()}` },
			}).onclick = () => void actions.schedule(task, { due: shiftISO(todayISO(), offset) });
		choices.createEl("button", { text: "Choose date…" }).onclick = open;
	}
	if (!task.checked && !task.due)
		(deferred ? content : scheduleRow).createEl("button", {
			cls: "tl-defer-task",
			text: deferred ? "Edit reason" : "Can’t schedule now",
			attr: { "aria-label": `Record why ${title} can’t be scheduled` },
		}).onclick = () => defer(task);
	if (!task.checked) makeDraggable(card, task);
	return card;
}
