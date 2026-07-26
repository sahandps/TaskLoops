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

/** `yyyy-mm` for the month an ISO day falls in. */
export function monthKey(iso: string): string {
	return iso.slice(0, 7);
}

/** Shift a `yyyy-mm` key by whole months. */
export function shiftMonth(key: string, months: number): string {
	const [y, m] = key.split("-").map(Number);
	const d = new Date(y, m - 1 + months, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Month and year as a heading, e.g. "July 2026". */
export function monthLabel(key: string): string {
	const [y, m] = key.split("-").map(Number);
	return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

/**
 * The six-week grid a month is drawn on, as ISO days.
 *
 * Always 42 cells so the grid never changes height between months, and always
 * starting on the user's own first day of the week.
 */
export function monthGrid(key: string, weekStart = 1): string[] {
	const [y, m] = key.split("-").map(Number);
	const first = new Date(y, m - 1, 1);
	const offset = (first.getDay() - weekStart + 7) % 7;
	const start = new Date(y, m - 1, 1 - offset);

	const days: string[] = [];
	for (let i = 0; i < 42; i++) {
		const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
		days.push(
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
				d.getDate()
			).padStart(2, "0")}`
		);
	}
	return days;
}

/** Short weekday names in display order, starting from `weekStart`. */
export function weekdayNames(weekStart = 1): string[] {
	const names: string[] = [];
	// 2026-07-05 is a Sunday, so index from there.
	for (let i = 0; i < 7; i++) {
		const d = new Date(2026, 6, 5 + ((weekStart + i) % 7));
		names.push(d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2));
	}
	return names;
}

/** True when the ISO day is today in the user's timezone. */
export function isToday(iso: string): boolean {
	return iso === todayISO();
}
