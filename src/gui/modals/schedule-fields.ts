import { Notice } from "obsidian";
import type { Schedule } from "../../core/types";
import { validSchedule } from "../../core/schedule";
import {
	WEEKDAY_ORDER,
	describeRepeat,
	formatRepeat,
	parseRepeat,
	type RepeatDay,
	type RepeatFreq,
	type RepeatRule,
} from "../../core/repeat";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function chipGroup(
	parent: HTMLElement,
	label: string,
	items: Array<[number, string]>,
	selected: Set<number>,
	changed: () => void,
): HTMLElement {
	const group = parent.createDiv({ cls: "tl-repeat-chips", attr: { role: "group", "aria-label": label } });
	for (const [value, text] of items) {
		const chip = group.createEl("button", {
			text,
			cls: "tl-repeat-chip",
			attr: { type: "button", "aria-pressed": String(selected.has(value)) },
		});
		chip.onclick = () => {
			if (!selected.delete(value)) selected.add(value);
			chip.setAttribute("aria-pressed", String(selected.has(value)));
			changed();
		};
	}
	return group;
}

export function scheduleFields(
	parent: HTMLElement,
	initial: Schedule,
): { read: () => Schedule | null; clear: () => void } {
	const fields = parent.createDiv("tl-schedule-fields");
	const dates = fields.createDiv("tl-date-fields");
	const effort = fields.createDiv("tl-duration-fields");
	const field = (
		parent: HTMLElement,
		label: string,
		type: string,
		value: string,
		accessibleLabel = label,
	) => {
		const wrap = parent.createEl("label");
		wrap.createSpan({ text: label });
		const input = wrap.createEl("input", { type, attr: { "aria-label": accessibleLabel } });
		input.value = value;
		return input;
	};
	const due = field(dates, "Due date", "date", initial.due ?? "");
	const deadline = field(dates, "Deadline", "date", initial.deadline ?? "");
	deadline.min = due.value;
	due.oninput = () => {
		deadline.min = due.value;
	};
	dates.createEl("small", {
		text: "Deadline includes the last day. Multi-day tasks appear above the calendar.",
		cls: "tl-deadline-hint",
	});
	const time = field(effort, "Time", "time", initial.time ?? "");
	const hours = field(
		effort,
		"Hours",
		"number",
		initial.duration ? String(Math.floor(initial.duration / 60)) : "",
		"Duration · hours",
	);
	const minutes = field(
		effort,
		"Minutes",
		"number",
		initial.duration ? String(initial.duration % 60) : "",
		"Duration · minutes",
	);
	hours.min = minutes.min = "0";
	hours.step = minutes.step = "1";
	minutes.max = "59";
	const repeat = repeatFields(fields, initial, () => due.value);
	const read = () => {
		const h = Number(hours.value || 0);
		const m = Number(minutes.value || 0);
		const duration = h * 60 + m;
		const result: Schedule = {
			...(due.value ? { due: due.value } : {}),
			...(deadline.value ? { deadline: deadline.value } : {}),
			...(time.value ? { time: time.value } : {}),
			...(duration ? { duration } : {}),
		};
		const rule = repeat.read(due.value, deadline.value);
		if (rule === null) return null;
		if (rule) result.repeat = rule;
		else if (initial.repeat) result.repeat = "";
		if (
			!due.checkValidity() ||
			!deadline.checkValidity() ||
			!time.checkValidity() ||
			!Number.isInteger(h) ||
			!Number.isInteger(m) ||
			h < 0 ||
			m < 0 ||
			m > 59 ||
			!validSchedule(result)
		) {
			new Notice(
				"Choose a due date and a deadline on or after it. Time and duration need a due date; duration uses whole hours and minutes.",
			);
			return null;
		}
		return result;
	};
	return {
		read,
		clear: () => {
			due.value = deadline.value = time.value = hours.value = minutes.value = "";
			deadline.min = "";
			repeat.clear();
		},
	};
}

function repeatFields(
	parent: HTMLElement,
	initial: Schedule,
	dueValue: () => string,
): { read: (due: string, deadline: string) => string | null; clear: () => void } {
	const start = initial.repeat ? parseRepeat(initial.repeat) : undefined;
	const box = parent.createDiv("tl-repeat-fields");
	const head = box.createDiv("tl-repeat-head");
	const freqLabel = head.createEl("label");
	freqLabel.createSpan({ text: "Repeat" });
	const freq = freqLabel.createEl("select", { attr: { "aria-label": "Repeat" } });
	for (const [value, text] of [
		["", "Does not repeat"],
		["DAILY", "Daily"],
		["WEEKLY", "Weekly"],
		["MONTHLY", "Monthly"],
		["YEARLY", "Yearly"],
	])
		freq.createEl("option", { text, value });
	freq.value = start?.freq ?? "";
	const everyLabel = head.createEl("label", { cls: "tl-repeat-every" });
	const everyText = everyLabel.createSpan({ text: "Every" });
	const every = everyLabel.createEl("input", {
		type: "number",
		attr: { "aria-label": "Repeat every", min: "1", max: "99", step: "1" },
	});
	every.value = String(start?.interval ?? 1);

	const weekdays = new Set<number>((start?.days ?? []).map((d) => d.day));
	const months = new Set<number>(start?.months ?? []);
	const weekdayRow = box.createDiv("tl-repeat-row");
	weekdayRow.createSpan({ text: "On", cls: "tl-repeat-label" });
	const shortcuts = weekdayRow.createDiv("tl-repeat-shortcuts");
	const weekdayChips = chipGroup(
		weekdayRow,
		"Repeat on weekdays",
		WEEKDAY_ORDER.map((d) => [d, WEEKDAY_LABELS[d]]),
		weekdays,
		() => update(),
	);
	const weekdaysButton = shortcuts.createEl("button", {
		text: "Weekdays",
		cls: "tl-quiet-button tl-repeat-shortcut",
		attr: { type: "button" },
	});
	weekdaysButton.onclick = () => {
		weekdays.clear();
		[1, 2, 3, 4, 5].forEach((d) => weekdays.add(d));
		syncChips();
		update();
	};

	const monthRow = box.createDiv("tl-repeat-row");
	monthRow.createSpan({ text: "In months", cls: "tl-repeat-label" });
	const monthChips = chipGroup(
		monthRow,
		"Repeat in months",
		MONTH_LABELS.map((label, index) => [index + 1, label]),
		months,
		() => update(),
	);

	const modeRow = box.createDiv("tl-repeat-row tl-repeat-mode");
	const modeLabel = modeRow.createEl("label");
	modeLabel.createSpan({ text: "On" });
	const mode = modeLabel.createEl("select", { attr: { "aria-label": "Repeat on" } });
	mode.createEl("option", { text: "Day of the month", value: "day" });
	mode.createEl("option", { text: "A weekday", value: "weekday" });
	mode.value = start?.days.length ? "weekday" : "day";
	const monthDaysLabel = modeRow.createEl("label");
	monthDaysLabel.createSpan({ text: "Days (for example 1, 15, last)" });
	const monthDays = monthDaysLabel.createEl("input", {
		type: "text",
		attr: { "aria-label": "Days of the month" },
	});
	monthDays.value = (start?.monthDays ?? []).map((n) => (n === -1 ? "last" : String(n))).join(", ");
	const nthLabel = modeRow.createEl("label");
	nthLabel.createSpan({ text: "Which" });
	const nth = nthLabel.createEl("select", { attr: { "aria-label": "Which weekday of the month" } });
	for (const [value, text] of [
		["", "Every"],
		["1", "1st"],
		["2", "2nd"],
		["3", "3rd"],
		["4", "4th"],
		["-1", "Last"],
	])
		nth.createEl("option", { text, value });
	const startNth = start?.days.find((d) => d.nth !== undefined)?.nth;
	nth.value = startNth === undefined ? "" : String(startNth);

	const endRow = box.createDiv("tl-repeat-row tl-repeat-end");
	const endLabel = endRow.createEl("label");
	endLabel.createSpan({ text: "Ends" });
	const endMode = endLabel.createEl("select", { attr: { "aria-label": "Repeat ends" } });
	endMode.createEl("option", { text: "Never", value: "never" });
	endMode.createEl("option", { text: "On a date", value: "until" });
	endMode.createEl("option", { text: "After a number of times", value: "count" });
	endMode.value = start?.until ? "until" : start?.count !== undefined ? "count" : "never";
	const untilInput = endRow.createEl("input", { type: "date", attr: { "aria-label": "Repeat until" } });
	untilInput.value = start?.until ?? "";
	const countInput = endRow.createEl("input", {
		type: "number",
		attr: { "aria-label": "Number of times", min: "1", max: "999", step: "1" },
	});
	countInput.value = start?.count !== undefined ? String(start.count) : "";
	const summary = box.createEl("small", { cls: "tl-repeat-summary" });
	const hint = box.createEl("small", {
		cls: "tl-repeat-hint",
		text: "Completing the task adds the next occurrence as a new task in the same note.",
	});

	const syncChips = () => {
		for (const [group, set, values] of [
			[weekdayChips, weekdays, WEEKDAY_ORDER],
			[monthChips, months, MONTH_LABELS.map((_l, i) => i + 1)],
		] as const)
			Array.from(group.children).forEach((chip, i) =>
				chip.setAttribute("aria-pressed", String(set.has(values[i]))),
			);
	};

	const build = (due: string, deadline: string): { rule?: RepeatRule; error?: string } => {
		if (!freq.value) return {};
		const kind = freq.value as RepeatFreq;
		const interval = Number(every.value);
		if (!Number.isInteger(interval) || interval < 1 || interval > 99)
			return { error: "Repeat every needs a whole number from 1 to 99." };
		if (!due) return { error: "Choose a due date before making a task repeat." };
		const rule: RepeatRule = { freq: kind, interval, days: [], monthDays: [], months: [] };
		if (kind === "WEEKLY") {
			if (!weekdays.size) return { error: "Choose at least one weekday." };
			rule.days = [...weekdays].map((day) => ({ day }));
		}
		if (kind === "YEARLY") {
			if (!months.size) return { error: "Choose at least one month." };
			rule.months = [...months];
		}
		if (kind === "MONTHLY" || kind === "YEARLY") {
			if (mode.value === "weekday") {
				if (!weekdays.size) return { error: "Choose at least one weekday." };
				const which = nth.value === "" ? undefined : Number(nth.value);
				rule.days = [...weekdays].map((day): RepeatDay => ({ day, nth: which }));
			} else {
				const items = monthDays.value.split(/[\s,]+/).filter(Boolean);
				const numbers = items.map((item) => (/^(last|-1)$/i.test(item) ? -1 : Number(item)));
				if (
					!numbers.length ||
					numbers.some((n) => !Number.isInteger(n) || !((n >= 1 && n <= 31) || n === -1))
				)
					return { error: "Enter days of the month from 1 to 31, or last." };
				rule.monthDays = [...new Set(numbers)];
			}
		}
		if (endMode.value === "until") {
			if (!untilInput.value || untilInput.value < due || (deadline && untilInput.value < deadline))
				return { error: "Choose an end date on or after the task's date." };
			rule.until = untilInput.value;
		} else if (endMode.value === "count") {
			const count = Number(countInput.value);
			if (!Number.isInteger(count) || count < 1 || count > 999)
				return { error: "Enter how many times it repeats, from 1 to 999." };
			rule.count = count;
		}
		const parsed = parseRepeat(formatRepeat(rule));
		return parsed ? { rule: parsed } : { error: "This repeat pattern is not supported." };
	};

	const update = () => {
		const kind = freq.value;
		const on = kind !== "";
		const longer = kind === "MONTHLY" || kind === "YEARLY";
		const weekdayMode = longer && mode.value === "weekday";
		const unit =
			{ DAILY: "day(s)", WEEKLY: "week(s)", MONTHLY: "month(s)", YEARLY: "year(s)" }[kind] ?? "";
		everyLabel.hidden = !on;
		everyText.setText(unit ? `Every (${unit})` : "Every");
		weekdayRow.hidden = !(kind === "WEEKLY" || weekdayMode);
		shortcuts.hidden = kind !== "WEEKLY";
		monthRow.hidden = kind !== "YEARLY";
		modeRow.hidden = !longer;
		monthDaysLabel.hidden = weekdayMode;
		nthLabel.hidden = !weekdayMode;
		endRow.hidden = !on;
		untilInput.hidden = endMode.value !== "until";
		countInput.hidden = endMode.value !== "count";
		hint.hidden = !on;
		const { rule } = build(dueValue() || "0000-00-00", "");
		summary.hidden = !rule;
		summary.setText(rule ? describeRepeat(rule) : "");
	};
	const prefill = () => {
		const due = dueValue();
		if (!due) return;
		const date = new Date(due + "T00:00:00");
		if (freq.value === "WEEKLY" && !weekdays.size) weekdays.add(date.getDay());
		if (freq.value === "YEARLY" && !months.size) months.add(date.getMonth() + 1);
		if (
			(freq.value === "MONTHLY" || freq.value === "YEARLY") &&
			mode.value === "day" &&
			!monthDays.value.trim()
		)
			monthDays.value = String(date.getDate());
		syncChips();
	};
	freq.onchange = () => {
		prefill();
		update();
	};
	mode.onchange = () => {
		prefill();
		update();
	};
	for (const el of [every, monthDays, nth, endMode, untilInput, countInput]) {
		el.oninput = update;
		el.onchange = update;
	}
	update();

	return {
		read: (due, deadline) => {
			const { rule, error } = build(due, deadline);
			if (error) {
				new Notice(error);
				return null;
			}
			return rule ? formatRepeat(rule) : "";
		},
		clear: () => {
			freq.value = "";
			weekdays.clear();
			months.clear();
			monthDays.value = untilInput.value = countInput.value = "";
			every.value = "1";
			endMode.value = "never";
			syncChips();
			update();
		},
	};
}
