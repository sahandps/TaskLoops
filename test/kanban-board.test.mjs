import { createSuite } from "./harness.mjs";

export default function run({ kanbanBoard, normalizeSettings, parseSchedule, writeTaskPriority }) {
	const { eq, results } = createSuite("kanban schedule and priority grouping");
	const start = "2026-12-28";
	const settings = normalizeSettings({ defaultView: "kanban" });
	const priorities = [...settings.priorities, { id: "urgent", name: "Urgent", color: "#ae1234" }];
	const filters = { group: "schedule", status: "open", query: "" };
	const tasks = [
		{ text: "Backlog", path: "Home.md" },
		{ text: "Review", due: start, time: "14:00", priority: "high", path: "Work.md" },
		{ text: "Draft", due: start, time: "09:00", priority: "low", path: "Work.md" },
		{ text: "Finish", due: "2027-01-03", priority: "urgent", path: "Work.md" },
		{ text: "Past", due: "2026-12-27", path: "Work.md" },
		{ text: "Future", due: "2027-01-04", priority: "legacy", path: "Home.md" },
		{ text: "Done", due: start, priority: "medium", checked: true, path: "Work.md" },
	].map((task) => ({ checked: false, ...task }));
	const board = (filters) => kanbanBoard(tasks, priorities, start, filters);
	const names = (column) => column.tasks.map(({ text }) => text);
	const scheduled = board(filters);
	eq(settings.defaultView, "kanban", "Kanban can be saved as the default view");
	eq(
		normalizeSettings({ showCompleted: true }).kanbanStatus,
		"open",
		"Kanban hides completed tasks by default, even when Planner shows them",
	);
	eq(
		normalizeSettings({ kanbanStatus: "all" }).kanbanStatus,
		"all",
		"Kanban remembers an explicit choice to show all tasks",
	);
	eq(
		normalizeSettings({ kanbanStatus: "invalid" }).kanbanStatus,
		"open",
		"invalid Kanban filters fall back to open tasks",
	);
	eq(
		normalizeSettings({ defaultView: "canvas" }).defaultView,
		"kanban",
		"the old Canvas default migrates to Kanban",
	);
	eq(
		scheduled.columns.map(({ schedule }) => schedule.due ?? ""),
		[
			"",
			"2026-12-28",
			"2026-12-29",
			"2026-12-30",
			"2026-12-31",
			"2027-01-01",
			"2027-01-02",
			"2027-01-03",
		],
		"one unscheduled column and seven consecutive dates across a year boundary",
	);
	eq(
		scheduled.columns.map(names),
		[["Backlog"], ["Draft", "Review"], [], [], [], [], [], ["Finish"]],
		"each task appears on its date, with timed tasks in chronological order",
	);
	eq(scheduled.outsideRange, 2, "past and future tasks outside the range are counted");
	eq(
		board({ ...filters, priority: "high", query: "  WORK " }).columns.flatMap(names),
		["Review"],
		"priority and case-insensitive note search combine",
	);
	eq(
		board({ ...filters, priority: "" }).columns.flatMap(names),
		["Backlog"],
		"no-priority filter keeps only unprioritized tasks",
	);
	eq(
		board({ ...filters, status: "completed" }).columns.flatMap(names),
		["Done"],
		"completed filter selects completed tasks",
	);
	const grouped = board({ ...filters, group: "priority", status: "all", priority: "high" });
	eq(
		grouped.columns.map(({ label }) => label),
		["Low", "Medium", "High", "Urgent", "No priority", "legacy (archived)"],
		"custom and archived priorities have columns",
	);
	eq(
		grouped.columns.map(names),
		[["Draft"], ["Done"], ["Review"], ["Finish"], ["Backlog", "Past"], ["Future"]],
		"priority grouping ignores the date window and schedule-only priority filter",
	);
	const raw =
		"- [ ] Review date: 28/12/2026 Time: 09:30 Deadline: 31/12/2026 <!-- taskloops-priority:low --> <!-- taskloops-color:#123456 --> <!-- taskloops-repeat:FREQ=DAILY --> ^review  \r";
	const moved = writeTaskPriority(raw, "urgent");
	eq(
		moved,
		raw.replace("priority:low", "priority:urgent"),
		"reprioritizing preserves handwritten dates, repeat metadata, block ID, and whitespace",
	);
	eq(
		parseSchedule(moved).schedule.priority,
		"urgent",
		"reprioritized Markdown parses into the destination lane",
	);
	const deferred = "- [ ] Call partner  \r";
	eq(
		writeTaskPriority(writeTaskPriority(deferred, "high"), ""),
		deferred,
		"priority updates preserve the Markdown line break used for deferral reasons",
	);
	return results;
}
