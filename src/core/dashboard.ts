import { noteFolder } from "./note-grid";
import { todayAgenda } from "./today-agenda";
import type { ScannedTask } from "./types";

/** The dashboard is a read model over the same scanned checkboxes as Planner. */
export function dashboardData(tasks: readonly ScannedTask[], day: string, projectNotes: readonly string[]) {
	const checkboxes = tasks.filter((task) => task.checkbox);
	const agenda = todayAgenda(checkboxes, day);
	const selected = new Map<string, ScannedTask[]>(projectNotes.map((path) => [path, []]));
	for (const task of checkboxes) selected.get(task.path)?.push(task);
	const projects = [...selected]
		.sort(
			([a], [b]) =>
				(a.split("/").pop() ?? a).localeCompare(b.split("/").pop() ?? b) || a.localeCompare(b),
		)
		.map(([path, tasks]) => {
			const completed = tasks.filter((task) => task.checked).length;
			return { path, tasks, completed, folder: noteFolder(path), open: tasks.length - completed };
		});
	return {
		agenda,
		timeBlocks: agenda.entries.filter((entry) => !entry.allDay),
		inbox: checkboxes.filter((task) => !task.checked && !task.due),
		projects,
		activeProjects: projects.filter((project) => !project.tasks.length || project.open > 0),
	};
}

/** Follow vault moves, including notes inside a renamed folder. */
export function movedProjectNotes(
	paths: readonly string[],
	oldPath: string,
	newPath: string | undefined,
	folder: boolean,
): string[] {
	return [
		...new Set(
			paths.flatMap((path) => {
				if (!(folder ? path.startsWith(oldPath + "/") : path === oldPath)) return [path];
				if (!newPath || (!folder && !/\.md$/i.test(newPath))) return [];
				return [newPath + path.slice(oldPath.length)];
			}),
		),
	];
}
