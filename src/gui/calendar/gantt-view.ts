import { taskColorResolver } from "../../core/task-colors";
import { priorityBadge, projectAccent } from "../components/task-appearance";
import { attachGanttPan } from "../interactions/gantt-pan";
import { TaskGantt } from "./task-gantt";
import { localDay, localTime, taskInterval, ganttSchedule } from "../../core/planner-schedule";
import type { ScannedTask } from "../../core/types";
import type { PlannerOptions } from "./contracts";

export function renderGantt(root: HTMLElement, tasks: ScannedTask[], options: PlannerOptions): () => void {
	const host = root.createDiv("tl-library-planner");
	const colors = taskColorResolver(options.allTasks ?? tasks, options.settings.projectColors);
	const scheduled = tasks.filter((task) => task.due);
	const lookup = new Map<string, ScannedTask>();
	root.createEl("p", {
		cls: "tl-library-hint",
		text: "Hold the left mouse button on empty chart space to scroll. Drag bars to reschedule; drag their edges to resize. Click a bar to edit. Undated tasks stay in the task list. Progress reflects task completion.",
	});
	if (!scheduled.length) {
		host.createEl("p", { text: "Schedule a task to see it in Gantt." });
		return () => host.remove();
	}
	// Isolate Frappe's markup from note titles: its SVG labels accept HTML.
	const escape = (text: string) =>
		text.replace(
			/[&<>"']/g,
			(ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
		);
	const bars = scheduled.map((task, index) => {
		const id = "tl-" + index;
		lookup.set(id, task);
		const interval = taskInterval(task)!;
		const stamp = (date: Date) => localDay(date) + " " + localTime(date) + ":00";
		return {
			id,
			name: escape(task.text),
			start: stamp(interval.start),
			end: stamp(interval.end),
			progress: task.checked ? 100 : 0,
		};
	});
	const layout = host.createDiv("tl-gantt-layout");
	const names = layout.createDiv({ cls: "tl-gantt-names", attr: { "aria-label": "Gantt tasks" } });
	names.createDiv({ cls: "tl-gantt-names-header", text: "Tasks · click to edit" });
	for (const task of scheduled) {
		const button = names.createEl("button", {
			text: task.text,
			attr: { title: task.text, "aria-label": "Edit Gantt task " + task.text },
		});
		projectAccent(button, task.path, options.settings);
		priorityBadge(button, task, options.settings);
		button.onclick = () => options.edit(task);
	}
	const chart = layout.createDiv("tl-gantt-chart");
	new TaskGantt(chart, bars, {
		view_mode: "Day",
		// Match the fixed name column's 85px header and 48px rows.
		upper_header_height: 45,
		lower_header_height: 30,
		bar_height: 30,
		padding: 18,
		view_mode_select: true,
		readonly_progress: true,
		// Completed tasks remain viewable; editing is guarded in callbacks.
		move_dependencies: false,
		popup: false,
		scroll_to: options.anchor,
		container_height: 520,
		on_click: (bar) => {
			const task = lookup.get(bar.id);
			if (task) options.edit(task);
		},
		on_date_change: (bar, start, end) => {
			const task = lookup.get(bar.id);
			if (task && !task.checked) void options.schedule(task, ganttSchedule(start, end, task));
		},
	});
	for (const group of chart.querySelectorAll<SVGElement>(".bar-wrapper[data-id]")) {
		const task = lookup.get(group.getAttribute("data-id") ?? "");
		const color = task && colors.color(task);
		if (color) {
			group.style.setProperty("--project-color", color);
			group.classList.add("tl-gantt-project-colored");
		}
	}
	const scroller = chart.querySelector<HTMLElement>(".gantt-container")!;
	const content = names.createDiv();
	content.style.setProperty(
		"--tl-gantt-footer-height",
		Math.max(8, scroller.scrollHeight - 85 - scheduled.length * 48) +
			(scroller.offsetHeight - scroller.clientHeight) +
			"px",
	);
	content.className = "tl-gantt-names-footer";
	const sync = () => {
		names.scrollTop = scroller.scrollTop;
	};
	const syncChart = () => {
		scroller.scrollTop = names.scrollTop;
	};
	scroller.addEventListener("scroll", sync);
	names.addEventListener("scroll", syncChart);
	const pan = attachGanttPan(scroller);
	return () => {
		pan();
		scroller.removeEventListener("scroll", sync);
		names.removeEventListener("scroll", syncChart);
		host.remove();
	};
}
