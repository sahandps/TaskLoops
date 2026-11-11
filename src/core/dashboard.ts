import { noteFolder, noteGroups } from "./note-grid";
import { todayAgenda } from "./today-agenda";
import type { ScannedTask } from "./types";

/** The dashboard is a read model over the same scanned checkboxes as Planner. */
export function dashboardData(tasks: readonly ScannedTask[], day: string, standaloneNote: string) {
	const checkboxes = tasks.filter((task) => task.checkbox);
	const agenda = todayAgenda(checkboxes, day);
	const projects = noteGroups(checkboxes, "", null, "all", day)
		.filter((group) => group.path !== standaloneNote)
		.map((group) => ({
			...group,
			folder: noteFolder(group.path),
			completed: group.tasks.length - group.open,
		}));
	return {
		agenda,
		timeBlocks: agenda.entries.filter((entry) => !entry.allDay),
		inbox: checkboxes.filter((task) => !task.checked && !task.due),
		projects,
		activeProjects: projects.filter((project) => project.open > 0),
	};
}
