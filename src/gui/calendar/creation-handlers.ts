import type { Calendar } from "@event-calendar/core";
import { localDay, localTime, selectionSchedule } from "../../core/planner-schedule";
import type { PlannerOptions } from "./contracts";

interface CalendarCreationHandlers {
	dateClick(info: Calendar.DateClickInfo): void;
	select(info: Calendar.SelectInfo): void;
}

/** Both click and range selection open a draft; saving is the dialog's responsibility. */
export function createCalendarCreationHandlers(
	options: Pick<PlannerOptions, "create" | "settings">,
	clearSelection: () => void,
): CalendarCreationHandlers {
	const notePath = (resource?: Calendar.Resource) =>
		typeof resource?.id === "string" ? resource.id : undefined;
	return {
		dateClick: (info) =>
			options.create(
				{
					due: localDay(info.date),
					...(!info.allDay
						? { time: localTime(info.date), duration: options.settings.defaultDuration }
						: {}),
				},
				notePath(info.resource),
			),
		select: (info) => {
			const schedule = selectionSchedule(info.start, info.end, info.allDay);
			clearSelection();
			if (schedule) options.create(schedule, notePath(info.resource));
		},
	};
}
