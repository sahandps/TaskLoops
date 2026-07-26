import { setIcon } from "obsidian";
import type { PanelHost } from "./host";
import { JoinedTask } from "./types";
import {
	isToday,
	monthGrid,
	monthKey,
	monthLabel,
	shiftMonth,
	todayISO,
	weekdayNames,
} from "./dates";

export interface CalendarState {
	/** The `yyyy-mm` on screen. */
	month: string;
	/** The ISO day whose tasks are listed under the grid. */
	selected: string;
}

export function initialCalendarState(): CalendarState {
	const today = todayISO();
	return { month: monthKey(today), selected: today };
}

/**
 * A month grid over the tasks that have dates, plus the selected day's tasks
 * underneath.
 *
 * Dropping a task on a day sets that date, which makes rescheduling a drag
 * rather than a trip through a date picker. Undated tasks are listed separately
 * so they can be dragged onto the calendar in the first place.
 */
export function renderCalendar(
	root: HTMLElement,
	host: PanelHost,
	state: CalendarState,
	all: JoinedTask[],
	matches: (task: JoinedTask) => boolean
): void {
	const wrap = root.createDiv("tl-calendar");

	const dated = all.filter(
		(t) => t.item.due && !t.item.done && t.item.bucket !== "trash" && matches(t)
	);

	const byDay = new Map<string, JoinedTask[]>();
	for (const task of dated) {
		const day = task.item.due!;
		if (!byDay.has(day)) byDay.set(day, []);
		byDay.get(day)!.push(task);
	}

	renderHeader(wrap, host, state);
	renderGrid(wrap, host, state, byDay);
	renderSelectedDay(wrap, host, state, byDay);
	renderUndated(wrap, host, all, matches);
}

function renderHeader(
	wrap: HTMLElement,
	host: PanelHost,
	state: CalendarState
): void {
	const head = wrap.createDiv("tl-cal-head");

	const prev = head.createEl("button", {
		cls: "tl-icon-btn",
		attr: { "aria-label": "Previous month" },
	});
	setIcon(prev, "chevron-left");
	prev.onclick = () => {
		state.month = shiftMonth(state.month, -1);
		host.rerender();
	};

	const title = head.createEl("button", {
		cls: "tl-cal-title",
		text: monthLabel(state.month),
		attr: { "aria-label": "Jump to today" },
	});
	title.onclick = () => {
		const today = todayISO();
		state.month = monthKey(today);
		state.selected = today;
		host.rerender();
	};

	const next = head.createEl("button", {
		cls: "tl-icon-btn",
		attr: { "aria-label": "Next month" },
	});
	setIcon(next, "chevron-right");
	next.onclick = () => {
		state.month = shiftMonth(state.month, 1);
		host.rerender();
	};
}

function renderGrid(
	wrap: HTMLElement,
	host: PanelHost,
	state: CalendarState,
	byDay: Map<string, JoinedTask[]>
): void {
	const names = wrap.createDiv("tl-cal-weekdays");
	for (const name of weekdayNames()) {
		names.createSpan({ cls: "tl-cal-weekday", text: name });
	}

	const grid = wrap.createDiv("tl-cal-grid");
	const days = monthGrid(state.month);
	const today = todayISO();

	for (const day of days) {
		const tasks = byDay.get(day) ?? [];
		const outside = monthKey(day) !== state.month;
		const overdue = day < today && tasks.length > 0;

		const cell = grid.createEl("button", {
			cls:
				"tl-cal-day" +
				(outside ? " is-outside" : "") +
				(isToday(day) ? " is-today" : "") +
				(state.selected === day ? " is-selected" : "") +
				(overdue ? " is-overdue" : ""),
			attr: { "aria-label": day },
		});

		cell.createSpan({
			cls: "tl-cal-daynum",
			text: String(Number(day.slice(8, 10))),
		});

		if (tasks.length > 0) {
			const dots = cell.createDiv("tl-cal-dots");
			// Three dots reads as "some", a count reads as "a lot".
			for (const task of tasks.slice(0, 3)) {
				dots.createSpan({
					cls:
						"tl-cal-dot" +
						(task.item.priority ? " is-p" + String(task.item.priority) : ""),
				});
			}
			if (tasks.length > 3) {
				dots.createSpan({ cls: "tl-cal-more", text: "+" + String(tasks.length - 3) });
			}
		}

		cell.onclick = () => {
			state.selected = day;
			host.rerender();
		};

		// Dropping on a day is the fast way to reschedule.
		host.dropTarget(cell, (task) => {
			state.selected = day;
			void host.plugin.setDue(task, day);
		});
	}
}

function renderSelectedDay(
	wrap: HTMLElement,
	host: PanelHost,
	state: CalendarState,
	byDay: Map<string, JoinedTask[]>
): void {
	const tasks = (byDay.get(state.selected) ?? []).sort(host.compare);
	const section = wrap.createDiv("tl-cal-section");

	const label = new Date(state.selected + "T00:00:00").toLocaleDateString(
		undefined,
		{ weekday: "long", month: "short", day: "numeric" }
	);
	section.createDiv({
		cls: "tl-group",
		text: isToday(state.selected) ? `${label} · today` : label,
	});

	if (tasks.length === 0) {
		section.createDiv({
			cls: "tl-cal-hint",
			text: "Nothing on this day. Drag a task onto the grid to schedule it.",
		});
		return;
	}
	for (const task of tasks) host.card(section, task, { noReorder: true });
}

function renderUndated(
	wrap: HTMLElement,
	host: PanelHost,
	all: JoinedTask[],
	matches: (task: JoinedTask) => boolean
): void {
	const undated = all
		.filter(
			(t) =>
				!t.item.due &&
				!t.item.done &&
				t.item.bucket !== "trash" &&
				t.item.bucket !== "reference" &&
				t.item.bucket !== "project" &&
				matches(t)
		)
		.sort(host.compare);

	if (undated.length === 0) return;

	const section = wrap.createDiv("tl-cal-section");
	section.createDiv({
		cls: "tl-group",
		text: `No date · ${String(undated.length)}`,
	});
	for (const task of undated.slice(0, 25)) {
		host.card(section, task, { noReorder: true, terse: true });
	}
	if (undated.length > 25) {
		section.createDiv({
			cls: "tl-cal-hint",
			text: `and ${String(undated.length - 25)} more`,
		});
	}
}
