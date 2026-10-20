import Gantt, { type GanttTask } from "frappe-gantt";

/** Frappe treats midnight ends as inclusive; TaskLoops stores exclusive ends. */
export class TaskGantt extends Gantt {
	/** Keep normal header offsets in a variable so the sticky class wins without important. */
	override create_el(options: { left?: number; classes?: string; [key: string]: unknown }): HTMLElement {
		const element = super.create_el(options);
		if (options.classes === "upper-text") {
			element.style.setProperty("--tl-gantt-label-left", element.style.left);
			element.style.removeProperty("left");
		}
		return element;
	}
	override setup_tasks(tasks: GanttTask[]): void {
		const ends = new Map(tasks.map((task) => [task.id, new Date(task.end.replace(" ", "T"))]));
		super.setup_tasks(tasks);
		for (const task of this.tasks) task._end = ends.get(task.id);
	}
}
