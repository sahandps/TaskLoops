import {
	createCalendar,
	destroyCalendar,
	DayGrid,
	TimeGrid,
	ResourceTimeline,
	Interaction,
	type Calendar,
} from "@event-calendar/core";
import { localDay, localTime, taskInterval, eventSchedule, isAllDayTask } from "../../core/planner-schedule";
import type { ScannedTask } from "../../core/types";
import type { PlannerOptions } from "./contracts";

export function renderEventCalendar(
	root: HTMLElement,
	tasks: ScannedTask[],
	options: PlannerOptions,
): () => void {
	const host = root.createDiv("tl-library-planner");
	const scheduled = tasks.filter((task) => task.due);
	const lookup = new Map(tasks.map((task) => [task.id, task]));
	const update = (info: Calendar.EventDropInfo | Calendar.EventResizeInfo) => {
		const task = lookup.get(String(info.event.id));
		if (!task || task.checked) {
			info.revert();
			return;
		}
		// Resource rows represent source notes, not a move between notes.
		if ("newResource" in info && info.newResource) info.event.resourceIds = [task.path];
		const schedule = eventSchedule(info.event.start, info.event.end, info.event.allDay, task);
		if (info.event.allDay && "endDelta" in info) {
			schedule.deadline = localDay(new Date(info.event.end.getTime() - 1));
		}
		void options.schedule(task, schedule).catch(() => info.revert());
	};
	const calendar = createCalendar(host, [DayGrid, TimeGrid, ResourceTimeline, Interaction], {
		view:
			options.scale === "timeline"
				? "resourceTimelineWeek"
				: options.scale === "month"
					? "dayGridMonth"
					: options.scale === "day"
						? "timeGridDay"
						: "timeGridWeek",
		date: options.anchor,
		headerToolbar: { start: "", center: "", end: "" },
		firstDay: options.settings.weekStart as 0 | 1 | 6,
		height: "100%",
		nowIndicator: true,
		scrollTime: String(options.settings.startHour).padStart(2, "0") + ":00:00",
		slotDuration: "00:30:00",
		snapDuration: "00:05:00",
		selectable: true,
		resources: [...new Set(tasks.map((task) => task.path))].map((path) => ({
			id: path,
			title: path.replace(/\.md$/, ""),
		})),
		events: scheduled.map((task) => {
			const interval = taskInterval(task)!;
			return {
				id: task.id,
				title: task.text,
				...interval,
				allDay: isAllDayTask(task),
				resourceIds: [task.path],
				editable: !task.checked,
				classNames: task.checked ? ["tl-event-completed"] : [],
			};
		}),
		eventTimeFormat: {
			hour: "2-digit",
			minute: "2-digit",
			hour12: options.settings.timeFormat === "12h",
		},
		slotLabelFormat: {
			hour: "2-digit",
			minute: "2-digit",
			hour12: options.settings.timeFormat === "12h",
		},
		eventClick: (info) => {
			const task = lookup.get(String(info.event.id));
			if (task) options.edit(task);
		},
		eventDrop: update,
		eventResize: update,
		dateClick: (info) =>
			options.create({
				due: localDay(info.date),
				...(!info.allDay
					? { time: localTime(info.date), duration: options.settings.defaultDuration }
					: {}),
			}),
	});
	options.dropTarget?.(host, (event) => {
		const info = calendar.dateFromPoint(event.clientX, event.clientY);
		if (!info) return null;
		return { due: localDay(info.date), ...(!info.allDay ? { time: localTime(info.date) } : {}) };
	});
	return () => {
		void destroyCalendar(calendar);
	};
}
