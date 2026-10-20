import type { CalendarScale, ScannedTask, Schedule, TaskLoopsSettings } from "../../core/types";

export interface PlannerOptions {
	scale: CalendarScale;
	anchor: string;
	settings: TaskLoopsSettings;
	schedule: (task: ScannedTask, schedule: Schedule) => Promise<unknown>;
	edit: (task: ScannedTask) => void;
	create: (schedule: Schedule) => void;
	dropTarget?: (element: HTMLElement, scheduleAt: (event: DragEvent) => Schedule | null) => void;
}
