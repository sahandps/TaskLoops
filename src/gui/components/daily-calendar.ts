import type { TaskActions } from "../../application/task-actions";
import {
	isoWeek,
	monthGrid,
	monthKey,
	monthLabel,
	shiftMonth,
	todayISO,
	weekdayNames,
} from "../../core/dates";

export function renderDailyCalendar(root: HTMLElement, plugin: TaskActions): () => void {
	let month = monthKey(todayISO());
	let selected = todayISO();
	let busy = false;
	const draw = () => {
		root.empty();
		root.addClass("tl-daily-calendar");
		const header = root.createDiv("tl-daily-calendar-header");
		header.createEl("h3", { text: monthLabel(month) });
		const previous = header.createEl("button", { text: "‹", attr: { "aria-label": "Previous month" } });
		const today = header.createEl("button", { text: "Today" });
		const next = header.createEl("button", { text: "›", attr: { "aria-label": "Next month" } });
		previous.onclick = () => {
			month = shiftMonth(month, -1);
			draw();
		};
		next.onclick = () => {
			month = shiftMonth(month, 1);
			draw();
		};
		today.onclick = () => {
			month = monthKey(todayISO());
			selected = todayISO();
			draw();
		};
		if (!plugin.dailyNotes?.enabled) {
			root.createEl("p", {
				text: "Enable Obsidian’s core Daily notes plugin in Settings to open or create daily notes.",
			});
			return;
		}
		const grid = root.createDiv("tl-daily-calendar-grid");
		grid.setAttribute("aria-label", monthLabel(month));
		const showWeeks = plugin.settings.dailyCalendarShowWeekNumbers;
		grid.classList.toggle("has-week-numbers", showWeeks);
		if (showWeeks) grid.createSpan({ cls: "tl-daily-week-label", text: "Wk" });
		for (const name of weekdayNames(plugin.settings.dailyCalendarWeekStart))
			grid.createSpan({ cls: "tl-daily-weekday", text: name });
		const days = monthGrid(month, plugin.settings.dailyCalendarWeekStart);
		for (let row = 0; row < 6; row++) {
			const week = days.slice(row * 7, row * 7 + 7);
			if (showWeeks)
				grid.createSpan({
					cls: "tl-daily-week-number",
					text: String(
						isoWeek(week.find((day) => new Date(day + "T12:00:00").getDay() === 4) ?? week[0])
							.week,
					),
				});
			for (const day of week) {
				const exists = plugin.dailyNotes.exists(day);
				const button = grid.createEl("button", {
					cls: "tl-daily-day",
					attr: {
						"aria-label": `${day}: ${exists ? "Open daily note" : "Create daily note"}`,
						"aria-pressed": String(day === selected),
						title: exists ? "Open daily note" : "Create daily note",
					},
				});
				button.disabled = busy;
				button.createSpan({ text: String(Number(day.slice(-2))) });
				if (day.slice(0, 7) !== month) button.addClass("is-outside-month");
				if (
					plugin.settings.dailyCalendarHighlightWeekends &&
					[0, 6].includes(new Date(day + "T12:00:00").getDay())
				)
					button.addClass("is-weekend");
				if (day === todayISO()) button.addClass("is-today");
				if (day === selected) button.addClass("is-selected");
				if (exists && plugin.settings.dailyCalendarShowNoteDots)
					button.createSpan({ cls: "tl-daily-note-dot", attr: { "aria-hidden": "true" } });
				button.onclick = () => {
					busy = true;
					draw();
					void plugin
						.dailyNotes!.open(day)
						.then((opened) => {
							if (opened) {
								selected = day;
								month = monthKey(day);
							}
						})
						.finally(() => {
							busy = false;
							draw();
						});
				};
			}
		}
	};
	draw();
	return draw;
}
