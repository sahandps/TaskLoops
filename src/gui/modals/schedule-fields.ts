import { Notice } from "obsidian";
import type { Schedule } from "../../core/types";
import { validSchedule } from "../../core/schedule";

export function scheduleFields(
	parent: HTMLElement,
	initial: Schedule,
): { read: () => Schedule | null; clear: () => void } {
	const fields = parent.createDiv("tl-schedule-fields");
	const field = (label: string, type: string, value: string) => {
		const wrap = fields.createEl("label");
		wrap.createSpan({ text: label });
		const input = wrap.createEl("input", { type });
		input.value = value;
		return input;
	};
	const due = field("Due date", "date", initial.due ?? "");
	const deadline = field("Deadline", "date", initial.deadline ?? "");
	deadline.min = due.value;
	due.oninput = () => {
		deadline.min = due.value;
	};
	fields.createEl("small", {
		text: "The deadline includes the selected day. Multi-day tasks stretch across the top of the calendar.",
		cls: "tl-deadline-hint",
	});
	const time = field("Time", "time", initial.time ?? "");
	const hours = field(
		"Duration · hours",
		"number",
		initial.duration ? String(Math.floor(initial.duration / 60)) : "",
	);
	const minutes = field(
		"Duration · minutes",
		"number",
		initial.duration ? String(initial.duration % 60) : "",
	);
	hours.min = minutes.min = "0";
	hours.step = minutes.step = "1";
	minutes.max = "59";
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
		},
	};
}
