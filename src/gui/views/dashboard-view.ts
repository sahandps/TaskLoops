import { setIcon } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import { dashboardData } from "../../core/dashboard";
import { todayISO } from "../../core/dates";
import { localDay, localTime, moveTaskToDay } from "../../core/planner-schedule";
import { formatDate, formatTime } from "../../core/schedule";
import type { ScannedTask } from "../../core/types";
import { renderCompletionCheckbox } from "../components/completion-checkbox";
import { priorityBadge, projectAccent } from "../components/task-appearance";
import type { DashboardPage } from "./view-state";

type Project = ReturnType<typeof dashboardData>["projects"][number];

interface DashboardNavigation {
	page: DashboardPage;
	show: (page: DashboardPage) => void;
	openToday: () => void;
	openPlanner: (day: string) => void;
	edit: (task: ScannedTask) => void;
}

function button(parent: HTMLElement, text: string, click: () => void, cls = "tl-dash-link") {
	const control = parent.createEl("button", { text, cls, type: "button" });
	control.onclick = click;
	return control;
}

function empty(parent: HTMLElement, text: string) {
	parent.createEl("p", { cls: "tl-dash-empty", text });
}

export function renderDashboardView(
	root: HTMLElement,
	actions: TaskActions,
	nav: DashboardNavigation,
	now = new Date(),
): HTMLElement {
	const day = localDay(now);
	const data = dashboardData(actions.allTasks(), day, actions.settings.standaloneNote);
	const pane = root.createEl("main", {
		cls: "tl-dashboard-pane",
		attr: { "aria-label": "TaskLoops dashboard" },
	});
	const body = pane.createDiv("tl-dash-body");
	const path = nav.page.kind === "project" ? nav.page.path : undefined;
	const project = data.projects.find((item) => item.path === path);

	const progress = (parent: HTMLElement, done: number, total: number, label: string) => {
		if (!total || actions.settings.showProgressBars === false) return;
		parent.createEl("progress", {
			cls: "tl-dash-progress",
			attr: { max: String(total), value: String(done), "aria-label": label },
		});
	};
	const heading = (parent: HTMLElement, title: string, subtitle?: string) => {
		const row = parent.createDiv("tl-dash-section-head");
		row.createEl("h2", { text: title });
		if (subtitle) row.createSpan({ cls: "tl-dash-meta", text: subtitle });
		return row;
	};
	const taskRow = (parent: HTMLElement, task: ScannedTask, plan = false) => {
		const row = parent.createDiv("tl-dash-task" + (task.checked ? " is-done" : ""));
		const check = renderCompletionCheckbox(row, task, (item) => actions.complete(item));
		check.setAttribute("data-dash-focus", "complete:" + task.id);
		const copy = row.createDiv("tl-dash-task-copy");
		const title = button(copy, task.text, () => nav.edit(task), "tl-dash-title");
		title.setAttribute("data-dash-focus", "edit:" + task.id);
		title.setAttribute("aria-label", "Edit " + task.text);
		const note = actions.noteName(task.path);
		copy.createDiv({
			cls: "tl-dash-meta",
			text: [
				note,
				task.due ? formatDate(task.due, actions.settings.dateFormat) : "",
				task.parentId ? "Subtask" : "",
			]
				.filter(Boolean)
				.join(" · "),
			attr: { title: task.path },
		});
		if (!task.checked) priorityBadge(row, task, actions.settings);
		if (plan) {
			const control = button(
				row,
				"Plan today",
				() => {
					control.disabled = true;
					void actions.schedule(task, moveTaskToDay(task, todayISO())).finally(() => {
						control.disabled = false;
					});
				},
				"tl-dash-small-button",
			);
			control.setAttribute("aria-label", "Plan today: " + task.text);
			control.setAttribute("data-dash-focus", "plan:" + task.id);
		}
	};
	const projectGrid = (parent: HTMLElement, projects: Project[]) => {
		if (!projects.length) {
			empty(parent, "No project notes to show. Add a task to a note to start tracking it here.");
			return;
		}
		const grid = parent.createDiv("tl-dash-projects");
		for (const item of projects) {
			const name = actions.noteName(item.path);
			const card = grid.createEl("article", { cls: "tl-dash-project" });
			projectAccent(card, item.path, actions.settings);
			const open = card.createEl("button", {
				cls: "tl-dash-project-open",
				type: "button",
				attr: { title: item.path },
			});
			open.onclick = () => nav.show({ kind: "project", path: item.path });
			setIcon(open.createSpan({ cls: "tl-dash-icon", attr: { "aria-hidden": "true" } }), "folder");
			open.createSpan({ text: name });
			open.createSpan({ cls: "tl-dash-arrow", text: "↗", attr: { "aria-hidden": "true" } });
			card.createDiv({ cls: "tl-dash-meta", text: item.folder || "Vault root" });
			progress(card, item.completed, item.tasks.length, name + " progress");
			card.createDiv({
				cls: "tl-dash-meta",
				text: `${item.completed} of ${item.tasks.length} complete`,
			});
		}
	};

	if (nav.page.kind !== "overview") {
		const back = body.createDiv("tl-dash-back");
		button(back, "← Dashboard", () => nav.show({ kind: "overview" }));
		if (nav.page.kind === "project") button(back, "All projects", () => nav.show({ kind: "projects" }));
	}
	const hero = body.createEl("header", { cls: "tl-dash-hero" });
	const intro = hero.createDiv();
	const headline = (title: string, subtitle: string) => {
		intro.createEl("h1", { text: title, attr: { tabindex: "-1", "data-dash-focus": "heading" } });
		intro.createEl("p", { cls: "tl-dash-meta", text: subtitle });
	};

	if (nav.page.kind === "inbox") {
		headline("Inbox", "Open tasks without a scheduled date.");
		button(hero, "+ Capture task", () => actions.newTask(), "mod-cta");
		const panel = body.createEl("section", {
			cls: "tl-dash-panel",
			attr: { "aria-label": "Unscheduled tasks" },
		});
		heading(panel, "Unscheduled tasks", `${data.inbox.length} open`);
		if (!data.inbox.length) empty(panel, "Your inbox is clear.");
		for (const task of data.inbox) taskRow(panel, task, true);
		return pane;
	}
	if (nav.page.kind === "projects" || (nav.page.kind === "project" && !project)) {
		headline("Projects", "Track the tasks in each source note.");
		projectGrid(body, data.projects);
		return pane;
	}
	if (project) {
		const name = actions.noteName(project.path);
		headline(name, project.path);
		button(hero, "+ Add to project", () => actions.newTask(undefined, project.path), "mod-cta");
		const panel = body.createEl("section", {
			cls: "tl-dash-panel",
			attr: { "aria-label": "Project tasks" },
		});
		const summary = heading(
			panel,
			"Project tasks",
			`${project.completed} of ${project.tasks.length} complete`,
		);
		button(summary, "Open note ↗", () => void actions.openNote(project.path));
		progress(panel, project.completed, project.tasks.length, name + " progress");
		for (const task of project.tasks) taskRow(panel, task);
		return pane;
	}

	intro.createEl("time", {
		cls: "tl-dash-date",
		text: now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
		attr: { datetime: day },
	});
	headline("Today at a glance", "Your tasks, time blocks, and projects in one place.");
	const controls = hero.createDiv("tl-dash-actions");
	button(
		controls,
		`Inbox · ${data.inbox.length}`,
		() => nav.show({ kind: "inbox" }),
		"tl-dash-small-button",
	);
	button(controls, "+ Capture task", () => actions.newTask(), "mod-cta");

	const columns = body.createDiv("tl-dash-columns");
	const today = columns.createEl("section", {
		cls: "tl-dash-panel",
		attr: { "aria-label": "Today’s tasks" },
	});
	const todayHead = heading(today, "Today’s tasks");
	button(todayHead, "Open Today →", nav.openToday);
	const { completed, total } = data.agenda.progress;
	today.createDiv({
		cls: "tl-dash-meta",
		text:
			`${completed} of ${total} complete` +
			(data.agenda.overdue.length ? ` · ${data.agenda.overdue.length} overdue` : ""),
	});
	progress(today, completed, total, "Today’s progress");
	const list = [...data.agenda.entries].sort((a, b) => Number(a.task.checked) - Number(b.task.checked));
	for (const entry of list.slice(0, 5)) taskRow(today, entry.task);
	if (!list.length) empty(today, "Nothing scheduled for today.");
	else if (list.length > 5) button(today, `See all ${list.length} in Today →`, nav.openToday);

	const time = columns.createEl("section", { cls: "tl-dash-panel", attr: { "aria-label": "Time blocks" } });
	button(heading(time, "Time blocks"), "Open planner →", () => nav.openPlanner(day));
	for (const entry of data.timeBlocks.slice(0, 5)) {
		const row = time.createDiv("tl-dash-event" + (entry.task.checked ? " is-done" : ""));
		row.createEl("time", {
			cls: "tl-dash-event-time",
			text: entry.continuing
				? "Earlier"
				: formatTime(localTime(entry.start), actions.settings.timeFormat),
			attr: { datetime: entry.start.toISOString() },
		});
		const item = row.createDiv("tl-dash-event-copy");
		projectAccent(item, entry.task.path, actions.settings);
		const title = button(item, entry.task.text, () => nav.edit(entry.task), "tl-dash-title");
		title.setAttribute("data-dash-focus", "time:" + entry.task.id);
		item.createDiv({
			cls: "tl-dash-meta",
			text: `${actions.noteName(entry.task.path)} · Until ${formatTime(localTime(entry.end), actions.settings.timeFormat)}${localDay(entry.end) > day ? " tomorrow or later" : ""}`,
		});
	}
	if (!data.timeBlocks.length) empty(time, "No tasks have a start time today.");
	else if (data.timeBlocks.length > 5)
		button(time, `See all ${data.timeBlocks.length} in Planner →`, () => nav.openPlanner(day));

	const projects = body.createEl("section", { attr: { "aria-label": "Active projects" } });
	button(heading(projects, "Active projects"), "All projects →", () => nav.show({ kind: "projects" }));
	projectGrid(projects, data.activeProjects.slice(0, 3));
	return pane;
}
