import { attachCalendarZoom } from "../interactions/calendar-zoom";
import { isoWeek } from "../../core/dates";
import { renderCompletionCheckbox } from "../components/completion-checkbox";
import { createCalendarCreationHandlers } from "./creation-handlers";
import {
	createCalendar,
	destroyCalendar,
	DayGrid,
	TimeGrid,
	ResourceTimeline,
	Interaction,
	type Calendar,
} from "@event-calendar/core";
import {
	localDay,
	localTime,
	taskInterval,
	eventSchedule,
	isAllDayTask,
	timedDropMinutes,
	crossGridSchedule,
} from "../../core/planner-schedule";
import type { ScannedTask } from "../../core/types";
import type { PlannerOptions } from "./contracts";

export function renderEventCalendar(
	root: HTMLElement,
	tasks: ScannedTask[],
	options: PlannerOptions,
): () => void {
	const host = root.createDiv("tl-library-planner tl-" + options.scale + "-view");
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
		const crossed = info.event.allDay !== info.oldEvent.allDay;
		const schedule = crossed
			? crossGridSchedule(info.event.start, info.event.allDay, task, options.settings.defaultDuration)
			: eventSchedule(info.event.start, info.event.end, info.event.allDay, task);
		if (info.event.allDay && "endDelta" in info) {
			schedule.deadline = localDay(new Date(info.event.end.getTime() - 1));
		}
		void options.schedule(task, schedule).catch(() => info.revert());
	};
	const creationHandlers = createCalendarCreationHandlers(options, () => calendar.unselect());
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
		weekNumbers: options.settings.showWeekNumbers !== false,
		weekNumberContent: (info) => "W" + isoWeek(localDay(info.date)).week,
		dayHeaderFormat: options.scale === "day" ? { weekday: "long" } : { weekday: "short", day: "numeric" },
		headerToolbar: { start: "", center: "", end: "" },
		firstDay: options.settings.weekStart as 0 | 1 | 6,
		height: "100%",
		nowIndicator: true,
		scrollTime: String(options.settings.startHour).padStart(2, "0") + ":00:00",
		slotDuration: "00:30:00",
		slotHeight:
			options.scale === "day" || options.scale === "week"
				? (options.settings.timeSlotHeight ?? 24)
				: 24,
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
				extendedProps:
					options.scale === "day" || options.scale === "week"
						? { taskloopsTimedMinutes: timedDropMinutes(task, options.settings.defaultDuration) }
						: {},
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
		eventContent: (info) => {
			const task = lookup.get(String(info.event.id));
			if (!task) return { domNodes: [] };
			const content = host.createDiv(
				"tl-calendar-event-content " + (info.event.allDay ? "is-all-day" : "is-timed"),
			);
			content.title = task.text + (info.timeText && !info.event.allDay ? " · " + info.timeText : "");
			// EventCalendar attaches the returned content to the event body.
			content.remove();
			renderCompletionCheckbox(content, task, options.complete);
			content.createEl("h4", { cls: "ec-event-title", text: task.text });
			const minutes = (info.event.end.getTime() - info.event.start.getTime()) / 60000;
			if (!info.event.allDay && info.timeText && minutes > 30)
				content.createEl("time", { cls: "ec-event-time", text: info.timeText });
			return { domNodes: [content] };
		},
		eventClick: (info) => {
			const task = lookup.get(String(info.event.id));
			if (task) options.edit(task);
		},
		eventDrop: update,
		eventResize: update,
		...creationHandlers,
	});
	const disposeZoom =
		options.scale === "day" || options.scale === "week"
			? attachCalendarZoom(
					host,
					options.settings.timeSlotHeight ?? 24,
					(size) => calendar.setOption("slotHeight", size),
					(size) => options.saveZoom?.(size),
				)
			: () => {};
	options.dropTarget?.(host, (event) => {
		const info = calendar.dateFromPoint(event.clientX, event.clientY);
		if (!info) return null;
		return { due: localDay(info.date), ...(!info.allDay ? { time: localTime(info.date) } : {}) };
	});
	return () => {
		disposeZoom();
		void destroyCalendar(calendar);
	};
}
