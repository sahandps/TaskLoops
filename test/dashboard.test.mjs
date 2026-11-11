import { createSuite } from "./harness.mjs";

export default function run({ dashboardData, movedProjectNotes, normalizeSettings }) {
	const { eq, results } = createSuite("dashboard read model");
	const day = "2026-11-11";
	const task = (id, path, fields = {}) => ({
		id,
		text: id,
		path,
		line: 0,
		checkbox: true,
		checked: false,
		...fields,
	});
	const tasks = [
		task("timed", "Work/Launch.md", { due: day, time: "09:30" }),
		task("done", "Work/Launch.md", { due: day, checked: true }),
		task("spanning", "Work/Launch.md", { due: "2026-11-10", deadline: day, time: "10:00" }),
		task("inbox", "Inbox.md"),
		task("done inbox", "Inbox.md", { checked: true }),
		task("other launch", "Personal/Launch.md", { checked: true }),
		task("tagged text", "Work/Launch.md", { checkbox: false, due: day }),
	];
	const selected = ["Work/Launch.md", "Personal/Launch.md", "Work/Reading.md"];
	const data = dashboardData(tasks, day, selected);
	eq(
		data.agenda.progress,
		{ total: 3, completed: 1, percent: 33 },
		"uses Today’s checkbox and overlap rules",
	);
	eq(
		data.timeBlocks.map(({ task }) => task.id),
		["timed"],
		"multi-day deadlines are not time blocks",
	);
	eq(
		data.inbox.map(({ id }) => id),
		["inbox"],
		"only open, unscheduled checkboxes enter the inbox",
	);
	eq(
		data.projects.map(({ path, completed, open }) => [path, completed, open]),
		[
			["Personal/Launch.md", 1, 0],
			["Work/Launch.md", 1, 2],
			["Work/Reading.md", 0, 0],
		],
		"only selected notes appear, including empty notes and distinct notes with the same name",
	);
	eq(
		data.activeProjects.map(({ path }) => path),
		["Work/Launch.md", "Work/Reading.md"],
		"finished projects remain in the full list",
	);
	eq(dashboardData(tasks, day, []).projects, [], "no notes are selected automatically");
	eq(
		dashboardData(tasks, day, ["Personal/Launch.md"]).agenda.progress,
		data.agenda.progress,
		"removing project membership does not remove today's tasks",
	);
	eq(
		normalizeSettings({ projectNotes: ["Work/Launch.md", "Work/Launch.md", "Work", null] }).projectNotes,
		["Work/Launch.md"],
		"project settings keep unique note paths",
	);
	eq(
		movedProjectNotes(selected, "Work", "Archive", true),
		["Archive/Launch.md", "Personal/Launch.md", "Archive/Reading.md"],
		"folder rename follows selected notes",
	);
	eq(
		movedProjectNotes(selected, "Personal/Launch.md", "Personal/News.md", false),
		["Work/Launch.md", "Personal/News.md", "Work/Reading.md"],
		"renaming a selected note keeps it tracked",
	);
	eq(
		movedProjectNotes(selected, "Work/Reading.md", undefined, false),
		["Work/Launch.md", "Personal/Launch.md"],
		"deleted notes leave the project list",
	);
	eq(normalizeSettings().defaultView, "dashboard", "new setups open Dashboard");
	eq(
		normalizeSettings({ defaultView: "planner" }).defaultView,
		"planner",
		"preserves an existing startup preference",
	);
	return results;
}
