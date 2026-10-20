import type { ScannedTask, Schedule } from "./types";
import { shiftISO } from "./dates";

export function localDay(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localTime(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
/** Calendar days, rather than elapsed hours, keep date spans stable through DST. */
export function dayDistance(start: string, end: string): number {
	const utc = (day: string) =>
		Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
	return Math.round((utc(end) - utc(start)) / 86400000);
}

export function hasDeadlineSpan(task: Schedule): boolean {
	return !!task.due && !!task.deadline && task.deadline > task.due;
}

export function isAllDayTask(task: Schedule): boolean {
	return !task.time || hasDeadlineSpan(task);
}

/** Shift the whole date span when a task is dropped onto another day. */
export function moveTaskToDay(task: ScannedTask, due: string): Schedule {
	return {
		due,
		...(task.deadline && task.due
			? { deadline: shiftISO(task.deadline, dayDistance(task.due, due)) }
			: {}),
		...(task.time ? { time: task.time } : {}),
		...(task.duration ? { duration: task.duration } : {}),
	};
}

/** Both views share local start and exclusive end; deadlines include their final day. */
export function taskInterval(task: ScannedTask): { start: Date; end: Date } | null {
	if (!task.due) return null;
	const allDay = isAllDayTask(task);
	const start = new Date(task.due + "T" + (allDay ? "00:00" : task.time) + ":00");
	const end = allDay
		? new Date(
				shiftISO(
					task.deadline ?? task.due,
					task.deadline ? 1 : Math.max(1, Math.ceil((task.duration ?? 1440) / 1440)),
				) + "T00:00:00",
			)
		: new Date(start.getTime() + (task.duration ?? 30) * 60000);
	return { start, end };
}

/** Keep effort and optional time when editing a date range. */
function dateSpanSchedule(start: Date, exclusiveEnd: Date, task: ScannedTask): Schedule {
	return {
		due: localDay(start),
		deadline: localDay(new Date(exclusiveEnd.getTime() - 1)),
		...(task.time ? { time: task.time } : {}),
		...(task.duration ? { duration: task.duration } : {}),
	};
}
export function eventSchedule(start: Date, end: Date, allDay: boolean, task: ScannedTask): Schedule {
	if (task.deadline && allDay) return dateSpanSchedule(start, end, task);
	return allDay
		? { due: localDay(start), ...(task.duration ? { duration: task.duration } : {}) }
		: {
				due: localDay(start),
				...(task.deadline ? { deadline: localDay(new Date(end.getTime() - 1)) } : {}),
				time: localTime(start),
				duration: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
			};
}
/** Frappe's callback returns an inclusive end (exclusive end minus one second). */
export function ganttSchedule(start: Date, inclusiveEnd: Date, task: ScannedTask): Schedule {
	if (task.deadline) return dateSpanSchedule(start, new Date(inclusiveEnd.getTime() + 1000), task);
	if (!task.time) {
		const days = Math.max(
			1,
			Math.round(
				(Date.UTC(inclusiveEnd.getFullYear(), inclusiveEnd.getMonth(), inclusiveEnd.getDate()) -
					Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
					86400000,
			) + 1,
		);
		return { due: localDay(start), duration: days * 1440 };
	}
	return eventSchedule(start, new Date(inclusiveEnd.getTime() + 1000), false, task);
}

/** Calendar selection ends are exclusive; task deadlines include the final day. */
export function selectionSchedule(start: Date, end: Date, allDay: boolean): Schedule | null {
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return null;
	const due = localDay(start);
	const deadline = localDay(new Date(end.getTime() - 1));
	if (allDay) return { due, deadline };
	return {
		due,
		...(deadline !== due ? { deadline } : {}),
		time: localTime(start),
		duration: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
	};
}

/** All-day spans need a useful time block rather than a 24-hour timed event. */
export function timedDropMinutes(task: Schedule, fallback = 30): number {
	return task.duration && task.duration > 0 && task.duration < 1440 ? task.duration : fallback;
}

/** Crossing the all-day boundary explicitly replaces the old date span. */
export function crossGridSchedule(start: Date, allDay: boolean, task: Schedule, fallback = 30): Schedule {
	return allDay
		? {
				due: localDay(start),
				...(task.duration && task.duration < 1440 ? { duration: task.duration } : {}),
			}
		: { due: localDay(start), time: localTime(start), duration: timedDropMinutes(task, fallback) };
}
