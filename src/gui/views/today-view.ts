import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { todayAgenda, type AgendaEntry } from "../../core/today-agenda";
import { todayISO, weekNumberLabel } from "../../core/dates";
import { localDay, localTime, moveTaskToDay, dayDistance } from "../../core/planner-schedule";
import { formatDate, formatTime, formatDuration } from "../../core/schedule";
import { overdueDays } from "../../core/task-review";
import { renderCompletionCheckbox } from "../components/completion-checkbox";

/** A compact agenda, independent of Planner filters and the browsed calendar date. */
export function renderTodayView(
	root: HTMLElement,
	actions: TaskActions,
	edit: (task: ScannedTask) => void,
	now = new Date(),
	expanded = new Set<string>(),
): void {
	const day = localDay(now);
	const agenda = todayAgenda(actions.allTasks(), day);
	const pane = root.createEl("main", { cls: "tl-today-pane", attr: { "aria-label": "Today's tasks" } });
	const body = pane.createDiv("tl-today-body");
	const intro = body.createEl("header", { cls: "tl-today-intro" });
	intro.createDiv({ cls: "tl-today-eyebrow", text: "One day at a time" });
	intro.createEl("h1", { text: "Today" });
	intro.createEl("time", {
		text: now.toLocaleDateString(undefined, {
			weekday: "long",
			month: "long",
			day: "numeric",
			year: "numeric",
		}),
		attr: { datetime: day },
	});
	if (actions.settings.showWeekNumbers !== false)
		intro.createSpan({ cls: "tl-today-week", text: weekNumberLabel(day) });
	const summary = intro.createDiv("tl-today-summary");
	summary.createSpan({ text: `${agenda.remaining} remaining` });
	summary.createSpan({ text: `${agenda.completed.length} complete` });
	if (actions.settings.showProgressBars !== false && agenda.progress.total) {
		intro.createEl("progress", {
			cls: "tl-today-progress",
			attr: {
				max: String(agenda.progress.total),
				value: String(agenda.progress.completed),
				"aria-label": "Today's task progress",
				"aria-valuetext": `${agenda.progress.completed} of ${agenda.progress.total} checkbox tasks complete (${agenda.progress.percent}%). Includes subtasks.`,
			},
		});
	}
	const card = (parent: HTMLElement, task: ScannedTask, entry?: AgendaEntry, overdue = false) => {
		const item = parent.createEl("article", { cls: "tl-today-task" + (task.checked ? " is-done" : "") });
		if (entry && !entry.allDay) {
			const clock = item.createDiv("tl-today-clock");
			clock.createEl("time", {
				text: entry.continuing
					? formatTime("00:00", actions.settings.timeFormat)
					: formatTime(localTime(entry.start), actions.settings.timeFormat),
				attr: {
					datetime: (entry.continuing ? new Date(day + "T00:00:00") : entry.start).toISOString(),
				},
			});
			clock.createSpan({
				text:
					"to " +
					formatTime(localTime(entry.end), actions.settings.timeFormat) +
					(localDay(entry.end) > day
						? ` +${dayDistance(day, localDay(entry.end))} day${dayDistance(day, localDay(entry.end)) === 1 ? "" : "s"}`
						: ""),
			});
			if (!task.checked)
				clock.createSpan({
					cls: "tl-today-phase",
					text:
						entry.start <= now && entry.end > now
							? "Now"
							: entry.end <= now
								? "Earlier"
								: "Upcoming",
				});
		}
		const content = item.createDiv("tl-today-task-content");
		const row = content.createDiv("tl-today-task-row");
		const checkTarget = row.createEl("label", { cls: "tl-today-check" });
		const check = renderCompletionCheckbox(checkTarget, task, (task) => actions.complete(task));
		check.setAttribute("data-today-focus", "complete:" + task.id);
		row.createEl("button", {
			cls: "tl-today-task-title",
			text: task.text,
			attr: { "aria-label": "Edit " + task.text, "data-today-focus": "edit:" + task.id },
		}).onclick = () => edit(task);
		const metadata = content.createDiv("tl-today-task-meta");
		metadata.createEl("button", {
			cls: "tl-today-source",
			text: actions.noteName(task.path) + " ↗",
			attr: {
				"aria-label": "Open " + task.path + " in a new tab",
				title: task.path,
				"data-today-focus": "source:" + task.id,
			},
		}).onclick = () => void actions.reveal(task);
		if (task.parentId) metadata.createSpan({ text: "Subtask" });
		if (entry?.continuing)
			metadata.createSpan({
				text: "Continues from " + formatDate(task.due!, actions.settings.dateFormat),
			});
		const through =
			task.deadline ?? (entry?.allDay ? localDay(new Date(entry.end.getTime() - 1)) : undefined);
		if (through && (task.deadline || through > task.due!))
			metadata.createSpan({
				text: "Through " + formatDate(through, actions.settings.dateFormat),
			});
		else if (task.duration && entry && !entry.allDay)
			metadata.createSpan({ text: formatDuration(task.duration) });
		if (overdue) {
			const days = overdueDays(task, day);
			metadata.createSpan({
				cls: "tl-today-late",
				text: `${days} ${days === 1 ? "day" : "days"} overdue`,
			});
			content.createEl("button", { cls: "tl-today-plan", text: "Plan for today" }).onclick = () =>
				void actions.schedule(task, moveTaskToDay(task, todayISO()));
		}
	};
	for (const [key, title, hint] of [
		["allDay", "All day", "No fixed time · including tasks spanning today"],
		["morning", "Morning", "Before 12:00"],
		["afternoon", "Afternoon", "12:00 – 17:00"],
		["evening", "Evening", "After 17:00"],
	] as const) {
		const entries = agenda[key];
		if (!entries.length) continue;
		const section = body.createEl("section", { cls: "tl-today-section", attr: { "aria-label": title } });
		const heading = section.createDiv("tl-today-section-heading");
		heading.createEl("h2", { text: title });
		heading.createSpan({ text: String(entries.length) });
		section.createDiv({
			cls: "tl-today-section-hint",
			text:
				key === "morning"
					? "Before " + formatTime("12:00", actions.settings.timeFormat)
					: key === "afternoon"
						? formatTime("12:00", actions.settings.timeFormat) +
							" – " +
							formatTime("17:00", actions.settings.timeFormat)
						: key === "evening"
							? "After " + formatTime("17:00", actions.settings.timeFormat)
							: hint,
		});
		for (const entry of entries) card(section, entry.task, entry);
	}
	if (!agenda.remaining) {
		const empty = body.createDiv("tl-today-empty");
		empty.createEl("h2", {
			text: agenda.entries.length ? "Today's tasks are complete." : "A little room in your day.",
		});
		empty.createEl("p", {
			text: agenda.entries.length
				? "Your completed tasks are kept below."
				: "No tasks scheduled for today. Add one when you’re ready.",
		});
		empty.createEl("button", { text: "Add a task for today" }).onclick = () =>
			actions.newTask({ due: todayISO() });
	}
	for (const [key, title] of [
		["overdue", "Overdue"],
		["completed", "Completed"],
	] as const) {
		const entries = agenda[key];
		if (!entries.length) continue;
		const section = body.createEl("details", { cls: "tl-today-secondary" });
		section.open = expanded.has(key);
		section.ontoggle = () => {
			if (section.open) expanded.add(key);
			else expanded.delete(key);
		};
		section.createEl("summary", {
			text: `${title} · ${entries.length}`,
			attr: { "data-today-focus": "section:" + key },
		});
		if (key === "overdue") for (const task of agenda.overdue) card(section, task, undefined, true);
		else for (const entry of agenda.completed) card(section, entry.task, entry);
	}
}
