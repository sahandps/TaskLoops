import type { ScannedTask } from "../../core/types";
import type { TaskLoopsView } from "../views/taskloops-view";
import { renderLibraryPlanner } from "./planner";
import {
	taskInterval,
	localDay,
	isAllDayTask,
	moveTaskToDay,
	hasDeadlineSpan,
} from "../../core/planner-schedule";
import { TaskEditorModal } from "../modals/index";
import {
	monthGrid,
	monthKey,
	monthLabel,
	shiftISO,
	shiftMonth,
	todayISO,
	weekdayNames,
	weekLabel,
	isoWeek,
	weekNumberLabel,
} from "../../core/dates";

/** Resolve a vertical pointer position to a five-minute local start time. */
export function timelineDropTime(offset: number): string {
	const minute = Math.max(0, Math.min(1435, Math.floor((offset / 64) * 12) * 5));
	return String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
}

/** Clip a timed task to a day, including continuations across midnight. */
export function daySegment(task: ScannedTask, day: string): { start: number; end: number } | null {
	if (!task.due || !task.time) return null;
	const [hours, minutes] = task.time.split(":").map(Number);
	const offset = Math.round(
		(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) -
			Date.UTC(
				Number(task.due.slice(0, 4)),
				Number(task.due.slice(5, 7)) - 1,
				Number(task.due.slice(8, 10)),
			)) /
			86400000,
	);
	const start = hours * 60 + minutes - offset * 1440;
	const end = start + (task.duration ?? 30);
	return end <= 0 || start >= 1440 ? null : { start: Math.max(0, start), end: Math.min(1440, end) };
}

function tasksOn(tasks: ScannedTask[], day: string): ScannedTask[] {
	return tasks
		.filter((task) =>
			!isAllDayTask(task)
				? !!daySegment(task, day)
				: !!task.due && day >= task.due && day < localDay(taskInterval(task)!.end),
		)
		.sort(
			(a, b) =>
				(a.time ?? "").localeCompare(b.time ?? "") || a.path.localeCompare(b.path) || a.line - b.line,
		);
}

export function renderCalendar(root: HTMLElement, view: TaskLoopsView, tasks: ScannedTask[]): void {
	const toolbar = root.createDiv("tl-calendar-toolbar");
	const scales = toolbar.createDiv("tl-scales");
	for (const [scale, label] of [
		["day", "Day"],
		["week", "Week"],
		["month", "Month"],
		["year", "Year"],
		["timeline", "Timeline"],
		["gantt", "Gantt"],
	] as const) {
		scales.createEl("button", {
			text: label,
			cls: view.scale === scale ? "is-active" : "",
			attr: { "aria-pressed": String(view.scale === scale) },
		}).onclick = () => view.setScale(scale);
	}
	const navigation = toolbar.createDiv("tl-calendar-nav");
	navigation.createEl("button", { text: "←", attr: { "aria-label": "Previous " + view.scale } }).onclick =
		() => step(-1);
	navigation.createEl("button", { text: "Today" }).onclick = () => {
		view.anchor = todayISO();
		view.render();
	};
	navigation.createEl("button", { text: "→", attr: { "aria-label": "Next " + view.scale } }).onclick = () =>
		step(1);
	const label =
		view.scale === "day"
			? new Date(view.anchor + "T12:00:00").toLocaleDateString(undefined, {
					weekday: "long",
					day: "numeric",
					month: "long",
					year: "numeric",
				})
			: view.scale === "week" || view.scale === "timeline"
				? weekLabel(view.anchor, view.plugin.settings.weekStart) + " · " + view.anchor.slice(0, 4)
				: view.scale === "month" || view.scale === "gantt"
					? monthLabel(monthKey(view.anchor))
					: view.anchor.slice(0, 4);
	root.createEl("h3", {
		cls: "tl-calendar-heading",
		text:
			label +
			(view.plugin.settings.showWeekNumbers !== false &&
			(view.scale === "day" || view.scale === "week" || view.scale === "timeline")
				? ` · ${weekNumberLabel(view.anchor)}`
				: ""),
	});
	const content = root.createDiv("tl-calendar-content");
	if (view.scale !== "year") {
		view.disposeCalendar = renderLibraryPlanner(content, tasks, {
			scale: view.scale,
			anchor: view.anchor,
			settings: view.plugin.settings,
			saveZoom: (size) => {
				view.plugin.settings.timeSlotHeight = size;
				void view.plugin.saveSettings();
			},
			schedule: (task, schedule) => view.plugin.schedule(task, schedule),
			complete: (task) => view.plugin.complete(task),
			edit: (task) => new TaskEditorModal(view.app, view.plugin, task).open(),
			create: (schedule, path) => view.plugin.newTask(schedule, path),
			dropTarget: (element, scheduleAt) =>
				view.dropTarget(element, (task, event) => {
					const schedule = scheduleAt(event);
					if (schedule)
						void view.plugin.schedule(task, {
							...moveTaskToDay(task, schedule.due!),
							...schedule,
							time:
								schedule.time ??
								(view.scale === "month" || hasDeadlineSpan(task) ? task.time : undefined),
							duration: task.duration,
						});
				}),
		});
	} else {
		const year = content.createDiv("tl-year");
		for (let month = 1; month <= 12; month++) {
			const key = view.anchor.slice(0, 4) + "-" + String(month).padStart(2, "0");
			const section = year.createDiv("tl-year-month");
			section.createEl("button", { text: monthLabel(key), cls: "tl-month-title" }).onclick = () => {
				view.anchor = key + "-01";
				view.setScale("month");
			};
			renderMonth(section, view, tasks, key, true);
		}
	}
	function step(direction: number): void {
		if (view.scale === "day" || view.scale === "week" || view.scale === "timeline")
			view.anchor = shiftISO(view.anchor, direction * (view.scale === "day" ? 1 : 7));
		else
			view.anchor =
				shiftMonth(monthKey(view.anchor), direction * (view.scale === "year" ? 12 : 1)) + "-01";
		view.render();
	}
}

function dayDrop(el: HTMLElement, view: TaskLoopsView, day: string, time?: string, allDay = false): void {
	view.dropTarget(
		el,
		(task) =>
			void view.plugin.schedule(task, {
				...moveTaskToDay(task, day),
				...(!allDay && (time || task.time) ? { time: time ?? task.time } : {}),
				...(task.duration ? { duration: task.duration } : {}),
			}),
	);
}

function renderMonth(
	root: HTMLElement,
	view: TaskLoopsView,
	tasks: ScannedTask[],
	key: string,
	mini = false,
): void {
	const grid = root.createDiv(mini ? "tl-month-grid is-mini" : "tl-month-grid");
	for (const name of weekdayNames(view.plugin.settings.weekStart))
		grid.createDiv({ cls: "tl-weekday", text: name });
	for (const day of monthGrid(key, view.plugin.settings.weekStart)) {
		const cell = grid.createDiv(
			"tl-month-day" +
				(monthKey(day) !== key ? " is-outside" : "") +
				(day === todayISO() ? " is-today" : ""),
		);
		dayDrop(cell, view, day);
		const daily = tasksOn(tasks, day);
		const head = cell.createDiv("tl-day-heading");
		head.createEl("button", {
			cls: "tl-day-number",
			text: String(Number(day.slice(8))),
			attr: { "aria-label": day + (daily.length ? `, ${daily.length} tasks` : "") },
		}).onclick = () => {
			view.anchor = day;
			view.setScale("day");
		};
		if (mini) {
			if (
				view.plugin.settings.showWeekNumbers !== false &&
				new Date(day + "T12:00:00").getDay() === view.plugin.settings.weekStart
			)
				head.createSpan({
					cls: "tl-mini-week-number",
					text: "W" + isoWeek(day).week,
					attr: { title: "ISO week " + isoWeek(day).week },
				});
			if (daily.length) {
				const dots = head.createSpan({
					cls: "tl-day-dots",
					attr: { "aria-hidden": "true", title: `${daily.length} tasks` },
				});
				for (let dot = 0; dot < Math.min(daily.length, 3); dot++) dots.createSpan("tl-day-dot");
			}
		} else {
			head.createEl("button", { text: "+", attr: { "aria-label": "Add task on " + day } }).onclick =
				() => view.plugin.newTask({ due: day });
			const events = cell.createDiv("tl-month-events");
			for (const task of daily) view.card(events, task, true);
		}
	}
}
