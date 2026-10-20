import { isDeferred } from "./task-deferral";
import type { ScannedTask } from "./types";
import { dayDistance } from "./planner-schedule";

export type PlannerTaskFilter = "all" | "undated" | "overdue" | "deferred";

/** The deadline is the inclusive final day; otherwise the due date is final. */
export function overdueDays(task: Pick<ScannedTask, "checked" | "due" | "deadline">, today: string): number {
	const finalDay = task.deadline ?? task.due;
	return !task.checked && finalDay && finalDay < today ? dayDistance(finalDay, today) : 0;
}

/** Keep the calendar/search result separate from the sidebar's review filter. */
export function reviewTasks(
	tasks: ScannedTask[],
	query: string,
	showDone: boolean,
	filter: PlannerTaskFilter,
	today: string,
): {
	matching: ScannedTask[];
	listed: ScannedTask[];
	overdueCount: number;
	deferredCount: number;
} {
	const q = query.trim().toLocaleLowerCase();
	const matching = tasks.filter(
		(task) =>
			(showDone || !task.checked) && (task.text + " " + task.path).toLocaleLowerCase().includes(q),
	);
	const overdue = matching.filter((task) => overdueDays(task, today) > 0);
	const listed =
		filter === "deferred"
			? matching.filter(isDeferred)
			: filter === "overdue"
				? [...overdue].sort(
						(a, b) =>
							overdueDays(b, today) - overdueDays(a, today) ||
							a.path.localeCompare(b.path) ||
							a.line - b.line,
					)
				: filter === "undated"
					? matching.filter((task) => !task.due && !isDeferred(task))
					: matching;
	return {
		matching,
		listed,
		overdueCount: overdue.length,
		deferredCount: matching.filter(isDeferred).length,
	};
}
