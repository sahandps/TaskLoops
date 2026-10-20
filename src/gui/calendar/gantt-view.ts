import { TaskGantt } from "./task-gantt";
import { localDay, localTime, taskInterval, ganttSchedule } from "../../core/planner-schedule";
import type { ScannedTask } from "../../core/types";
import type { PlannerOptions } from "./contracts";

export function renderGantt(root: HTMLElement, tasks: ScannedTask[], options: PlannerOptions): () => void {
	const host = root.createDiv("tl-library-planner");
	const scheduled = tasks.filter((task) => task.due);
	const lookup = new Map<string, ScannedTask>();
	root.createEl("p", {
		cls: "tl-library-hint",
		text: "Drag bars to reschedule; drag their edges to resize. Click a bar to edit. Undated tasks stay in the task list. Progress reflects task completion.",
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
	new TaskGantt(host, bars, {
		view_mode: "Day",
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
	return () => host.remove();
}
