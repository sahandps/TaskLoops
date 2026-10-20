import Gantt, { type GanttTask } from "frappe-gantt";

/** Frappe treats midnight ends as inclusive; TaskLoops stores exclusive ends. */
export class TaskGantt extends Gantt {
	override setup_tasks(tasks: GanttTask[]): void {
		const ends = new Map(tasks.map((task) => [task.id, new Date(task.end.replace(" ", "T"))]));
		super.setup_tasks(tasks);
		for (const task of this.tasks) task._end = ends.get(task.id);
	}
}
