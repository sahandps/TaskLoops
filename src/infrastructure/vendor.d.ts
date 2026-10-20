declare module "frappe-gantt" {
	export interface GanttTask {
		id: string;
		name: string;
		start: string;
		end: string;
		progress: number;
		_end?: Date;
	}
	interface Options {
		view_mode?: string;
		upper_header_height?: number;
		lower_header_height?: number;
		bar_height?: number;
		padding?: number;
		view_mode_select?: boolean;
		readonly_progress?: boolean;
		readonly_dates?: boolean;
		move_dependencies?: boolean;
		popup?: boolean;
		scroll_to?: string;
		container_height?: number;
		on_click?: (task: GanttTask) => void;
		on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
	}
	export default class Gantt {
		tasks: GanttTask[];
		setup_tasks(tasks: GanttTask[]): void;
		create_el(options: { left?: number; classes?: string; [key: string]: unknown }): HTMLElement;
		constructor(element: HTMLElement, tasks: GanttTask[], options?: Options);
	}
}
