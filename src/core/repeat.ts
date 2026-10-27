import type { Schedule } from "./types";

function validDate(iso: string): boolean {
	const [y, m, d] = iso.split("-").map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Repeat rules use a small subset of the iCalendar RRULE syntax, for example
 * `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE`. All dates are calendar days.
 */
export type RepeatFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RepeatDay {
	/** 0 = Sunday … 6 = Saturday, like Date#getDay. */
	day: number;
	/** 1–4 or -1 (last), only for monthly and yearly rules; absent means every such weekday. */
	nth?: number;
}

export interface RepeatRule {
	freq: RepeatFreq;
	interval: number;
	days: RepeatDay[];
	/** 1–31, or -1 for the last day. */
	monthDays: number[];
	/** 1–12. */
	months: number[];
	until?: string;
	/** Total occurrences remaining, including the current task. */
	count?: number;
}

const CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
/** Display order: Monday first. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MS_DAY = 86400000;

export function weekdayCode(day: number): string {
	return CODES[day];
}

function toDay(iso: string): number {
	const [y, m, d] = iso.split("-").map(Number);
	return Date.UTC(y, m - 1, d) / MS_DAY;
}

function fromDay(n: number): string {
	return new Date(n * MS_DAY).toISOString().slice(0, 10);
}

function parts(n: number): { y: number; m: number; d: number; w: number } {
	const date = new Date(n * MS_DAY);
	return {
		y: date.getUTCFullYear(),
		m: date.getUTCMonth() + 1,
		d: date.getUTCDate(),
		w: date.getUTCDay(),
	};
}

function monthLength(y: number, m: number): number {
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function integers(value: string, min: number, max: number, allowLast = false): number[] | undefined {
	const out: number[] = [];
	for (const item of value.split(",")) {
		if (!/^-?\d+$/.test(item)) return;
		const n = Number(item);
		if (!((n >= min && n <= max) || (allowLast && n === -1))) return;
		if (!out.includes(n)) out.push(n);
	}
	return out.length ? out : undefined;
}

/** Parse a stored rule; returns undefined for anything invalid or unsupported. */
export function parseRepeat(text: string): RepeatRule | undefined {
	const rule: RepeatRule = { freq: "DAILY", interval: 1, days: [], monthDays: [], months: [] };
	let freq: string | undefined;
	const seen = new Set<string>();
	for (const item of text.split(";")) {
		const split = item.indexOf("=");
		if (split < 1) return;
		const key = item.slice(0, split);
		const value = item.slice(split + 1);
		if (seen.has(key) || !value) return;
		seen.add(key);
		if (key === "FREQ") freq = value;
		else if (key === "INTERVAL") {
			const n = integers(value, 1, 99);
			if (!n || n.length !== 1) return;
			rule.interval = n[0];
		} else if (key === "BYDAY") {
			for (const token of value.split(",")) {
				const match = token.match(/^(-1|[1-4])?(SU|MO|TU|WE|TH|FR|SA)$/);
				if (!match) return;
				const day = CODES.indexOf(match[2]);
				const nth = match[1] === undefined ? undefined : Number(match[1]);
				if (!rule.days.some((d) => d.day === day && d.nth === nth)) rule.days.push({ day, nth });
			}
		} else if (key === "BYMONTHDAY") {
			const n = integers(value, 1, 31, true);
			if (!n) return;
			rule.monthDays = n;
		} else if (key === "BYMONTH") {
			const n = integers(value, 1, 12);
			if (!n) return;
			rule.months = n;
		} else if (key === "UNTIL") {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !validDate(value)) return;
			rule.until = value;
		} else if (key === "COUNT") {
			const n = integers(value, 1, 999);
			if (!n || n.length !== 1) return;
			rule.count = n[0];
		} else return;
	}
	if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY" && freq !== "YEARLY") return;
	rule.freq = freq;
	if (rule.days.length && rule.monthDays.length) return;
	if (freq === "DAILY" && (rule.days.length || rule.monthDays.length || rule.months.length)) return;
	if (
		freq === "WEEKLY" &&
		(rule.days.some((d) => d.nth !== undefined) || rule.monthDays.length || rule.months.length)
	)
		return;
	if (freq === "MONTHLY" && rule.months.length) return;
	return rule;
}

export function validRepeat(text: string): boolean {
	return !!parseRepeat(text);
}

/** Canonical text for a rule. */
export function formatRepeat(rule: RepeatRule): string {
	const order = (day: number) => WEEKDAY_ORDER.indexOf(day);
	const out = ["FREQ=" + rule.freq];
	if (rule.interval > 1) out.push("INTERVAL=" + rule.interval);
	if (rule.days.length) {
		const days = [...rule.days].sort(
			(a, b) => order(a.day) - order(b.day) || (a.nth ?? 0) - (b.nth ?? 0),
		);
		out.push("BYDAY=" + days.map((d) => (d.nth === undefined ? "" : d.nth) + CODES[d.day]).join(","));
	}
	if (rule.months.length) out.push("BYMONTH=" + [...rule.months].sort((a, b) => a - b).join(","));
	if (rule.monthDays.length) {
		const days = [...rule.monthDays].sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b));
		out.push("BYMONTHDAY=" + days.join(","));
	}
	if (rule.until) out.push("UNTIL=" + rule.until);
	if (rule.count !== undefined) out.push("COUNT=" + rule.count);
	return out.join(";");
}

function nthDay(p: { d: number }, len: number, nth: number): boolean {
	return nth === -1 ? p.d + 7 > len : Math.ceil(p.d / 7) === nth;
}

/** Whether `day` is an occurrence of a rule whose pattern is aligned to `anchor`. */
function matches(rule: RepeatRule, day: number, anchor: number): boolean {
	const p = parts(day);
	const a = parts(anchor);
	const len = monthLength(p.y, p.m);
	const dayMatches = () => {
		if (rule.days.length)
			return rule.days.some((d) => d.day === p.w && (d.nth === undefined || nthDay(p, len, d.nth)));
		const wanted = rule.monthDays.length ? rule.monthDays : [a.d];
		return wanted.some((n) => (n === -1 || n >= len ? p.d === len : p.d === n));
	};
	switch (rule.freq) {
		case "DAILY":
			return (day - anchor) % rule.interval === 0;
		case "WEEKLY": {
			const weekStart = (n: number) => n - ((parts(n).w + 6) % 7);
			const weeks = (weekStart(day) - weekStart(anchor)) / 7;
			const wanted = rule.days.length ? rule.days.map((d) => d.day) : [a.w];
			return weeks % rule.interval === 0 && wanted.includes(p.w);
		}
		case "MONTHLY":
			return ((p.y - a.y) * 12 + (p.m - a.m)) % rule.interval === 0 && dayMatches();
		case "YEARLY":
			return (
				(p.y - a.y) % rule.interval === 0 &&
				(rule.months.length ? rule.months : [a.m]).includes(p.m) &&
				dayMatches()
			);
	}
}

/**
 * First occurrence after `after`, with interval alignment taken from `anchor`
 * (the task's current due date). Returns undefined when the rule has ended.
 */
export function nextOccurrence(rule: RepeatRule, anchor: string, after: string): string | undefined {
	const start = toDay(anchor);
	const limit = 366 * (rule.interval + 1);
	const from = Math.max(toDay(after), start);
	for (let n = from + 1; n <= from + limit; n++) {
		if (rule.until && n > toDay(rule.until)) return;
		if (matches(rule, n, start)) return fromDay(n);
	}
}

/**
 * Schedule for the occurrence that follows a completed task. A task completed
 * late skips straight to the next future date instead of creating a backlog.
 */
export function nextRepeatSchedule(schedule: Schedule, today: string): Schedule | undefined {
	if (!schedule.due || !schedule.repeat) return;
	const rule = parseRepeat(schedule.repeat);
	if (!rule || (rule.count !== undefined && rule.count <= 1)) return;
	const due = nextOccurrence(rule, schedule.due, schedule.due > today ? schedule.due : today);
	if (!due) return;
	const span = schedule.deadline ? toDay(schedule.deadline) - toDay(schedule.due) : undefined;
	return {
		due,
		...(span !== undefined ? { deadline: fromDay(toDay(due) + span) } : {}),
		...(schedule.time ? { time: schedule.time } : {}),
		...(schedule.duration ? { duration: schedule.duration } : {}),
		repeat: formatRepeat(rule.count === undefined ? rule : { ...rule, count: rule.count - 1 }),
	};
}

const ORDINALS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };

function list(items: string[]): string {
	return items.length < 3
		? items.join(" and ")
		: items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

/** Short human description, such as "Every 2 weeks on Mon, Wed". */
export function describeRepeat(rule: RepeatRule, formatDate: (iso: string) => string = (iso) => iso): string {
	const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[rule.freq];
	let text = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
	if (rule.freq === "YEARLY" && rule.months.length)
		text += " in " + list([...rule.months].sort((a, b) => a - b).map((m) => MONTH_NAMES[m - 1]));
	if (rule.days.length) {
		const sorted = [...rule.days].sort(
			(a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day),
		);
		if (sorted.every((d) => d.nth === undefined))
			text += " on " + list(sorted.map((d) => DAY_NAMES[d.day].slice(0, 3)));
		else
			text +=
				" on the " +
				list(
					sorted.map(
						(d) => (d.nth === undefined ? "every " : ORDINALS[d.nth] + " ") + DAY_NAMES[d.day],
					),
				);
	} else if (rule.monthDays.length) {
		text +=
			" on " +
			list(
				[...rule.monthDays]
					.sort((a, b) => (a === -1 ? 99 : a) - (b === -1 ? 99 : b))
					.map((n) => (n === -1 ? "the last day" : "day " + n)),
			);
	}
	if (rule.until) text += ", until " + formatDate(rule.until);
	if (rule.count !== undefined) text += `, ${rule.count} ${rule.count === 1 ? "time" : "times"}`;
	return text;
}
