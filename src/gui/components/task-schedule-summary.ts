import { formatDate, formatTime } from "../../core/schedule";
import { hasDeadlineSpan } from "../../core/planner-schedule";
import type { Schedule, TaskLoopsSettings } from "../../core/types";

type ScheduleFormat = Pick<TaskLoopsSettings, "dateFormat" | "timeFormat">;

export function scheduleSummary(task: Schedule, settings: ScheduleFormat, deferred = false) {
	if (!task.due) return { state: "unscheduled", label: deferred ? "Deferred" : "Unscheduled" };
	const date = formatDate(task.due, settings.dateFormat);
	if (hasDeadlineSpan(task) && task.deadline)
		return { state: "scheduled", label: date + " → " + formatDate(task.deadline, settings.dateFormat) };
	const time = task.time ? formatTime(task.time, settings.timeFormat) : "All day";
	return { state: "scheduled", label: time + " · " + date };
}
