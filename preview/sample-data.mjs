import { todayISO, shiftISO } from "../src/core/dates.ts";
import { writeSchedule } from "../src/core/schedule.ts";

const SAMPLE_TASKS = [
	["Define project scope", "Projects/Website.md", -1, undefined, 120, 0],
	["Design review", "Projects/Website.md", 0, "10:00", 60],
	["Build calendar integration", "Projects/TaskLoops.md", 0, "10:00", 90, 2],
	["Team planning", "Projects/TaskLoops.md", 1, "09:30", 45],
	["Test timeline interactions", "Projects/TaskLoops.md", 3, undefined, 60, 4],
	["Release checklist", "Projects/Website.md", 5, undefined, 1440],
	["Read accessibility guidelines", "Personal.md"],
	["Draft next sprint goals", "Projects/TaskLoops.md"],
];
export function makeTask(text, path, schedule = {}, id = crypto.randomUUID()) {
	const raw = writeSchedule("- [ ] " + text, schedule, "YYYY-MM-DD");
	return {
		id,
		text,
		path,
		line: 0,
		raw,
		indent: 0,
		handled: false,
		checkbox: true,
		checked: false,
		...schedule,
	};
}

export function createSampleTasks() {
	const today = todayISO();
	return SAMPLE_TASKS.map(([text, path, offset, time, duration, deadlineOffset]) =>
		makeTask(
			text,
			path,
			offset === undefined
				? {}
				: {
						due: shiftISO(today, offset),
						...(deadlineOffset !== undefined
							? { deadline: shiftISO(today, deadlineOffset) }
							: {}),
						...(time ? { time } : {}),
						...(duration ? { duration } : {}),
					},
		),
	);
}
