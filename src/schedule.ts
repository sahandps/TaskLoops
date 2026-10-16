import type { DateFormat, Schedule } from "./types";

export const DATE_FORMATS: DateFormat[] = ["YYYY-MM-DD", "DD/MM/YYYY", "DD.MM.YYYY", "YYYY/MM/DD"];

export function validDate(iso: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
	const d = new Date(iso + "T12:00:00");
	return !isNaN(d.getTime()) && d.getFullYear() === Number(iso.slice(0, 4)) &&
		d.getMonth() + 1 === Number(iso.slice(5, 7)) && d.getDate() === Number(iso.slice(8, 10));
}

export function formatDate(iso: string, format: DateFormat): string {
	return format.replace("YYYY", iso.slice(0, 4)).replace("MM", iso.slice(5, 7)).replace("DD", iso.slice(8, 10));
}

export function parseDate(value: string): string | undefined {
	let iso: string;
	if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value)) iso = value.replace(/\//g, "-");
	else if (/^\d{2}([/.])\d{2}\1\d{4}$/.test(value)) iso = value.slice(6) + "-" + value.slice(3, 5) + "-" + value.slice(0, 2);
	else return;
	return validDate(iso) ? iso : undefined;
}

export function validTime(value: string): boolean {
	return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return [hours ? `${hours} ${hours === 1 ? "Hour" : "Hours"}` : "", rest ? `${rest} ${rest === 1 ? "Minute" : "Minutes"}` : ""].filter(Boolean).join(" ");
}

/** Read only a complete, valid scheduling suffix, before an optional block id. */
export function parseSchedule(raw: string): { body: string; schedule: Schedule; suffix: string; block: string } {
	const block = raw.match(/(\s+\^[\w-]+)?(\r?)$/)?.[0] ?? "";
	const body = raw.slice(0, raw.length - block.length);
	const match = body.match(/\s+Due date: ([\d./-]+)(?: Time: (\d{2}:\d{2}))?(?: Duration: (?:(\d+) Hours?(?: (\d+) Minutes?)?|(\d+) Minutes?))?\s*$/i);
	if (match) {
		const due = parseDate(match[1]);
		const time = match[2];
		const duration = match[3] !== undefined ? Number(match[3]) * 60 + Number(match[4] ?? 0) : match[5] !== undefined ? Number(match[5]) : undefined;
		if (due && (!time || validTime(time)) && (duration === undefined || (Number.isSafeInteger(duration) && duration > 0))) {
			return { body: body.slice(0, match.index), schedule: { due, ...(time ? { time } : {}), ...(duration ? { duration } : {}) }, suffix: match[0], block };
		}
	}
	// Also accept the originally requested bare ISO date at the end of a task.
	const bare = body.match(/\s+(\d{4}-\d{2}-\d{2})\s*$/);
	if (bare && validDate(bare[1])) return { body: body.slice(0, bare.index), schedule: { due: bare[1] }, suffix: bare[0], block };
	return { body, schedule: {}, suffix: "", block };
}

export function validSchedule(schedule: Schedule): boolean {
	return (!schedule.due || validDate(schedule.due)) && (!schedule.time || validTime(schedule.time)) &&
		(schedule.duration === undefined || (Number.isSafeInteger(schedule.duration) && schedule.duration > 0)) &&
		(!schedule.time && schedule.duration === undefined || !!schedule.due);
}

export function writeSchedule(raw: string, schedule: Schedule, format: DateFormat): string {
	if (!validSchedule(schedule)) throw new Error("A valid date is required for a time or duration.");
	const parsed = parseSchedule(raw);
	const suffix = schedule.due ? ` Due date: ${formatDate(schedule.due, format)}${schedule.time ? " Time: " + schedule.time : ""}${schedule.duration ? " Duration: " + formatDuration(schedule.duration) : ""}` : "";
	return parsed.body + suffix + parsed.block;
}

/** Append inside Tasks:, respecting headings, fenced code and frontmatter. */
export function appendTask(content: string, line: string): string {
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	let fence: { marker: string; length: number } | undefined;
	let frontmatter = lines[0] === "---";
	let start = -1;
	let level = 0;
	let end = lines.length;
	for (let i = 0; i < lines.length; i++) {
		const text = lines[i];
		if (frontmatter) { if (i > 0 && /^(---|\.\.\.)\s*$/.test(text)) frontmatter = false; continue; }
		const marker = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (marker) {
			if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
			else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
			continue;
		}
		if (fence) continue;
		const heading = text.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!heading) continue;
		if (start < 0 && /^Tasks:\s*$/i.test(heading[2])) { start = i; level = heading[1].length; }
		else if (start >= 0 && heading[1].length <= level) { end = i; break; }
	}
	if (start < 0) {
		if (fence || frontmatter) throw new Error("Close the note's code fence or frontmatter before adding a task.");
		return content + (content ? (content.endsWith(eol + eol) ? "" : content.endsWith(eol) ? eol : eol + eol) : "") + "## Tasks:" + eol + line + eol;
	}
	if (fence) throw new Error("Close the code fence in Tasks: before adding a task.");
	while (end > start + 1 && lines[end - 1].trim() === "") end--;
	lines.splice(end, 0, line);
	return lines.join(eol) + (lines[lines.length - 1] === "" ? "" : eol);
}
