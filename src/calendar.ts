import { formatTime } from "./schedule";
import { addResizeHandle } from "./resize";
import type { ScannedTask } from "./types";
import type { TaskLoopsView } from "./view";
import { monthGrid, monthKey, monthLabel, shiftISO, shiftMonth, todayISO, weekdayNames, weekOf, weekLabel } from "./dates";

/** Resolve a vertical pointer position to a five-minute local start time. */
export function timelineDropTime(offset: number): string {
	const minute = Math.max(0, Math.min(1435, Math.floor(offset / 64 * 12) * 5));
	return String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0");
}

/** Clip a timed task to a day, including continuations across midnight. */
export function daySegment(task: ScannedTask, day: string): { start: number; end: number } | null {
	if (!task.due || !task.time) return null;
	const [hours, minutes] = task.time.split(":").map(Number);
	const offset = Math.round((Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) - Date.UTC(Number(task.due.slice(0, 4)), Number(task.due.slice(5, 7)) - 1, Number(task.due.slice(8, 10)))) / 86400000);
	const start = hours * 60 + minutes - offset * 1440;
	const end = start + (task.duration ?? 30);
	return end <= 0 || start >= 1440 ? null : { start: Math.max(0, start), end: Math.min(1440, end) };
}

function tasksOn(tasks: ScannedTask[], day: string): ScannedTask[] {
	return tasks.filter((task) => task.time ? !!daySegment(task, day) : task.due === day)
		.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.path.localeCompare(b.path) || a.line - b.line);
}

export function renderCalendar(root: HTMLElement, view: TaskLoopsView, tasks: ScannedTask[]): void {
	const toolbar = root.createDiv("tl-calendar-toolbar");
	const scales = toolbar.createDiv("tl-scales");
	for (const [scale, label] of [["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"]] as const) {
		scales.createEl("button", { text: label, cls: view.scale === scale ? "is-active" : "", attr: { "aria-pressed": String(view.scale === scale) } }).onclick = () => view.setScale(scale);
	}
	const navigation = toolbar.createDiv("tl-calendar-nav");
	navigation.createEl("button", { text: "←", attr: { "aria-label": "Previous " + view.scale } }).onclick = () => step(-1);
	navigation.createEl("button", { text: "Today" }).onclick = () => { view.anchor = todayISO(); view.render(); };
	navigation.createEl("button", { text: "→", attr: { "aria-label": "Next " + view.scale } }).onclick = () => step(1);
	const label = view.scale === "day" ? new Date(view.anchor + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : view.scale === "week" ? weekLabel(view.anchor, view.plugin.settings.weekStart) + " · " + view.anchor.slice(0, 4) : view.scale === "month" ? monthLabel(monthKey(view.anchor)) : view.anchor.slice(0, 4);
	root.createEl("h3", { cls: "tl-calendar-heading", text: label });
	const content = root.createDiv("tl-calendar-content");
	if (view.scale === "day" || view.scale === "week") renderTimeline(content, view, tasks);
	else if (view.scale === "month") renderMonth(content, view, tasks, monthKey(view.anchor));
	else {
		const year = content.createDiv("tl-year");
		for (let month = 1; month <= 12; month++) {
			const key = view.anchor.slice(0, 4) + "-" + String(month).padStart(2, "0");
			const section = year.createDiv("tl-year-month");
			section.createEl("button", { text: monthLabel(key), cls: "tl-month-title" }).onclick = () => { view.anchor = key + "-01"; view.setScale("month"); };
			renderMonth(section, view, tasks, key, true);
		}
	}
	function step(direction: number): void {
		if (view.scale === "day" || view.scale === "week") view.anchor = shiftISO(view.anchor, direction * (view.scale === "week" ? 7 : 1));
		else view.anchor = shiftMonth(monthKey(view.anchor), direction * (view.scale === "year" ? 12 : 1)) + "-01";
		view.render();
	}
}

function dayDrop(el: HTMLElement, view: TaskLoopsView, day: string, time?: string, allDay = false): void {
	view.dropTarget(el, (task) => void view.plugin.schedule(task, {
		due: day,
		...(!allDay && (time || task.time) ? { time: time ?? task.time } : {}),
		...(task.duration ? { duration: task.duration } : {}),
	}));
}

function renderMonth(root: HTMLElement, view: TaskLoopsView, tasks: ScannedTask[], key: string, mini = false): void {
	const grid = root.createDiv(mini ? "tl-month-grid is-mini" : "tl-month-grid");
	for (const name of weekdayNames(view.plugin.settings.weekStart)) grid.createDiv({ cls: "tl-weekday", text: name });
	for (const day of monthGrid(key, view.plugin.settings.weekStart)) {
		const cell = grid.createDiv("tl-month-day" + (monthKey(day) !== key ? " is-outside" : "") + (day === todayISO() ? " is-today" : ""));
		dayDrop(cell, view, day);
		const daily = tasksOn(tasks, day);
		const head = cell.createDiv("tl-day-heading");
		head.createEl("button", { cls: "tl-day-number", text: String(Number(day.slice(8))), attr: { "aria-label": day + (daily.length ? `, ${daily.length} tasks` : "") } }).onclick = () => { view.anchor = day; view.setScale("day"); };
		if (mini) {
			if (daily.length) {
				const dots = head.createSpan({ cls: "tl-day-dots", attr: { "aria-hidden": "true", title: `${daily.length} tasks` } });
				for (let dot = 0; dot < Math.min(daily.length, 3); dot++) dots.createSpan("tl-day-dot");
			}
		} else {
			head.createEl("button", { text: "+", attr: { "aria-label": "Add task on " + day } }).onclick = () => view.plugin.newTask({ due: day });
			const events = cell.createDiv("tl-month-events");
			for (const task of daily) view.card(events, task, true);
		}
	}
}

function renderTimeline(root: HTMLElement, view: TaskLoopsView, tasks: ScannedTask[]): void {
	const days = view.scale === "day" ? [view.anchor] : weekOf(view.anchor, view.plugin.settings.weekStart);
	const timeline = root.createDiv("tl-timeline" + (days.length === 1 ? " is-single-day" : ""));
	const header = timeline.createDiv("tl-timeline-header");
	header.createDiv({ cls: "tl-time-label", text: "All day" });
	for (const day of days) {
		const cell = header.createDiv("tl-all-day" + (day === todayISO() ? " is-today" : ""));
		const head = cell.createDiv("tl-day-heading");
		head.createEl("button", { text: new Date(day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) }).onclick = () => { view.anchor = day; view.setScale("day"); };
		head.createEl("button", { text: "+", attr: { "aria-label": "Add task on " + day } }).onclick = () => view.plugin.newTask({ due: day });
		dayDrop(cell, view, day, undefined, true);
		for (const task of tasksOn(tasks, day).filter((task) => !task.time)) view.card(cell, task, true);
	}
	const body = timeline.createDiv("tl-timeline-body");
	const labels = body.createDiv("tl-time-labels");
	for (let hour = 0; hour < 24; hour++) labels.createDiv({ cls: "tl-hour-label", text: formatTime(String(hour).padStart(2, "0") + ":00", view.plugin.settings.timeFormat) });
	for (const day of days) {
		const column = body.createDiv("tl-day-column" + (day === todayISO() ? " is-today" : ""));
		for (let slot = 0; slot < 48; slot++) {
			const time = timelineDropTime(slot * 32);
			const target = column.createEl("button", { cls: "tl-time-slot" + (slot % 2 === 0 ? " is-hour" : ""), attr: { "aria-label": "Add task " + day + " " + time, title: day + " " + time } });
			target.onclick = (event) => view.plugin.newTask({ due: day, time: event.detail ? timelineDropTime(event.clientY - column.getBoundingClientRect().top) : time, duration: view.plugin.settings.defaultDuration ?? 30 });
			view.dropTarget(target, (task, drop) => void view.plugin.schedule(task, {
				due: day, time: timelineDropTime(drop.clientY - column.getBoundingClientRect().top), duration: task.duration,
			}));
		}
		const marker = column.createDiv("tl-drop-time");
		column.addEventListener("dragover", (event) => {
			if (!view.hasDraggedTask()) return;
			const time = timelineDropTime(event.clientY - column.getBoundingClientRect().top);
			marker.setText(formatTime(time, view.plugin.settings.timeFormat));
			const [hour, minute] = time.split(":").map(Number);
			marker.style.setProperty("--tl-drop-top", (hour + minute / 60) * 64 + "px");
			marker.addClass("is-visible");
		}, { capture: true });
		column.addEventListener("dragleave", (event) => {
			if (!(event.relatedTarget instanceof Node) || !column.contains(event.relatedTarget)) marker.removeClass("is-visible");
		});
		column.addEventListener("drop", () => marker.removeClass("is-visible"), { capture: true });
		const timed = tasksOn(tasks, day).flatMap((task) => {
			const segment = daySegment(task, day);
			return segment ? [{ task, ...segment, lane: 0 }] : [];
		});
		// Assign lanes per overlapping cluster, so simultaneous tasks stay visible.
		let cluster: typeof timed = [];
		let clusterEnd = 0;
		const paint = () => {
			const lanes = Math.max(1, ...cluster.map((event) => event.lane + 1));
			for (const event of cluster) {
				const card = view.card(column, event.task, true);
				card.addClass("tl-timed-task");
				card.classList.toggle("is-short-event", event.end - event.start < 75);
				card.classList.toggle("is-tiny-event", event.end - event.start < 35);
				card.style.setProperty("--tl-event-top", event.start / 60 * 64 + "px");
				card.style.setProperty("--tl-event-height", Math.max(24, (event.end - event.start) / 60 * 64) + "px");
				card.style.setProperty("--tl-event-left", event.lane / lanes * 100 + "%");
				card.style.setProperty("--tl-event-width", 100 / lanes + "%");
				card.title = event.task.text + " · " + formatTime(event.task.time ?? "", view.plugin.settings.timeFormat) + " · " + (event.task.duration ?? 30) + " minutes";
				// Only the final day of an overnight event has its end handle.
				if (!daySegment(event.task, shiftISO(day, 1))) addResizeHandle(card, event.task, view, (duration) => {
					const segment = daySegment({ ...event.task, duration }, day);
					return segment ? (segment.end - segment.start) / 60 * 64 : 0;
				});
				view.dropTarget(card, (task, drop) => {
					const offset = drop.clientY - column.getBoundingClientRect().top;
					void view.plugin.schedule(task, { due: day, time: timelineDropTime(offset), duration: task.duration });
				});
			}
		};
		for (const event of timed.sort((a, b) => a.start - b.start || b.end - a.end)) {
			if (cluster.length && event.start >= clusterEnd) { paint(); cluster = []; clusterEnd = 0; }
			const occupied = new Set(cluster.filter((other) => other.end > event.start).map((other) => other.lane));
			while (occupied.has(event.lane)) event.lane++;
			cluster.push(event);
			clusterEnd = Math.max(clusterEnd, event.end);
		}
		if (cluster.length) paint();
	}
	// One grid track per day, shared by the sticky all-day row and time body.
	timeline.style.setProperty("--tl-days", String(days.length));
}
