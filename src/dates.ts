/**
 * Date helpers, all working in local time on plain `yyyy-mm-dd` strings.
 *
 * Dates here are calendar days, not instants: "due tomorrow" means the day, not
 * a moment. Going through UTC would shift the day for anyone west of Greenwich,
 * so every conversion offsets by the local timezone first.
 */

/** Today as `yyyy-mm-dd` in the user's own timezone. */
export function todayISO(): string {
	const d = new Date();
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 10);
}

/** Move an ISO day forward or back by whole days. */
export function shiftISO(iso: string, days: number): string {
	const d = new Date(iso + "T00:00:00");
	d.setDate(d.getDate() + days);
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 10);
}

/** Whole days from today; negative means overdue. */
export function daysUntil(iso: string): number {
	const today = new Date(todayISO() + "T00:00:00");
	const target = new Date(iso + "T00:00:00");
	return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/** The heading a scheduled task is grouped under. */
export function dueGroup(iso?: string): string {
	if (!iso) return "No date";
	const d = daysUntil(iso);
	if (d < 0) return "Overdue";
	if (d === 0) return "Today";
	if (d === 1) return "Tomorrow";
	if (d <= 7) return "This week";
	return "Later";
}

/** Short label for a date chip: relative when close, calendar date when not. */
export function formatDue(iso: string): string {
	const d = daysUntil(iso);
	if (d === 0) return "today";
	if (d === 1) return "tomorrow";
	if (d === -1) return "yesterday";
	if (d < 0) return `${-d}d overdue`;
	return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

/** Ordering for the scheduled view's group headings. */
export const DUE_GROUP_ORDER = [
	"Overdue",
	"Today",
	"Tomorrow",
	"This week",
	"Later",
	"No date",
];
