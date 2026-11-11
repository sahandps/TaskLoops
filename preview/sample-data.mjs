import { todayISO, shiftISO } from "../src/core/dates.ts";
import { writeSchedule } from "../src/core/schedule.ts";

const SAMPLE_TASKS = [
	["Define project scope", "Projects/Website.md", -1, undefined, 120, 0, true],
	["Design review", "Projects/Website.md", 0, "10:00", 60],
	["Review release checklist", "Projects/TaskLoops.md", 0, "09:30", 45],
	["Draft changelog", "Projects/TaskLoops.md", 0, "13:00", 30],
	["Capture release screenshots", "Projects/TaskLoops.md", 0, undefined, undefined, undefined, true],
	["Build calendar integration", "Projects/TaskLoops.md", 1, "10:00", 90, 2],
	["Team planning", "Projects/TaskLoops.md", 1, "09:30", 45],
	["Test timeline interactions", "Projects/TaskLoops.md", 3, undefined, 60, 4],
	["Release checklist", "Projects/Website.md", 5, undefined, 1440],
	["Read accessibility guidelines", "Personal.md"],
	["Draft next sprint goals", "Projects/TaskLoops.md"],
	["Measure the desk", "Home/Home office reset.md", -2, undefined, undefined, undefined, true],
	["Order cable clips", "Home/Home office reset.md", 0],
	["Mount the power strip", "Home/Home office reset.md", 4],
	["Book bike service", "Standalone Tasks.md"],
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
	return SAMPLE_TASKS.map(([text, path, offset, time, duration, deadlineOffset, checked]) => {
		const task = makeTask(
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
		);
		if (checked) {
			task.checked = true;
			task.raw = task.raw.replace("- [ ]", "- [x]");
		}
		return task;
	});
}
