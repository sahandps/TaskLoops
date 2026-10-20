import { validDate } from "./schedule";
import { shiftISO } from "./dates";
import { isAllDayTask, taskInterval } from "./planner-schedule";
import { overdueDays } from "./task-review";
import type { ScannedTask } from "./types";

export interface AgendaEntry {
	task: ScannedTask;
	start: Date;
	end: Date;
	allDay: boolean;
	continuing: boolean;
}

/** Local-day overlap uses the same inclusive deadlines and exclusive ends as Calendar. */
export function todayAgenda(tasks: readonly ScannedTask[], day: string) {
	const start = new Date(day + "T00:00:00");
	const end = new Date(shiftISO(day, 1) + "T00:00:00");
	const entries: AgendaEntry[] = [];
	for (const task of tasks) {
		if (!task.due || !validDate(task.due) || (task.deadline && !validDate(task.deadline))) continue;
		const interval = taskInterval(task);
		if (
			!interval ||
			!Number.isFinite(interval.start.getTime()) ||
			!Number.isFinite(interval.end.getTime()) ||
			interval.start >= end ||
			interval.end <= start
		)
			continue;
		entries.push({ task, ...interval, allDay: isAllDayTask(task), continuing: interval.start < start });
	}
	entries.sort(
		(a, b) =>
			a.start.getTime() - b.start.getTime() ||
			a.task.path.localeCompare(b.task.path) ||
			a.task.line - b.task.line,
	);
	const active = entries.filter((entry) => !entry.task.checked);
	const timed = active.filter((entry) => !entry.allDay);
	const period = (entry: AgendaEntry) => (entry.continuing ? 0 : entry.start.getHours());
	const included = new Set(entries.map((entry) => entry.task));
	const total = entries.filter((entry) => entry.task.checkbox).length;
	const completed = entries.filter((entry) => entry.task.checkbox && entry.task.checked).length;
	return {
		entries,
		allDay: active.filter((entry) => entry.allDay),
		morning: timed.filter((entry) => period(entry) < 12),
		afternoon: timed.filter((entry) => period(entry) >= 12 && period(entry) < 17),
		evening: timed.filter((entry) => period(entry) >= 17),
		completed: entries.filter((entry) => entry.task.checked),
		overdue: tasks
			.filter((task) => overdueDays(task, day) > 0 && !included.has(task))
			.sort(
				(a, b) =>
					overdueDays(b, day) - overdueDays(a, day) ||
					a.path.localeCompare(b.path) ||
					a.line - b.line,
			),
		remaining: active.length,
		progress: { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 },
	};
}
