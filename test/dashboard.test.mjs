import { createSuite } from "./harness.mjs";

export default function run({ dashboardData, normalizeSettings }) {
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
	const data = dashboardData(tasks, day, "Inbox.md");
	eq(data.agenda.progress, { total: 3, completed: 1, percent: 33 }, "uses Today’s checkbox and overlap rules");
	eq(data.timeBlocks.map(({ task }) => task.id), ["timed"], "multi-day deadlines are not time blocks");
	eq(data.inbox.map(({ id }) => id), ["inbox"], "only open, unscheduled checkboxes enter the inbox");
	eq(
		data.projects.map(({ path, completed, open }) => [path, completed, open]),
		[["Personal/Launch.md", 1, 0], ["Work/Launch.md", 1, 2]],
		"same-named notes stay separate and the standalone note stays out of projects",
	);
	eq(data.activeProjects.map(({ path }) => path), ["Work/Launch.md"], "finished projects remain in the full list");
	eq(normalizeSettings().defaultView, "dashboard", "new setups open Dashboard");
	eq(normalizeSettings({ defaultView: "planner" }).defaultView, "planner", "preserves an existing startup preference");
	return results;
}
