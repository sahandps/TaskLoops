import type { TimeGridViewport } from "../interactions/calendar-viewport";
import type { CalendarScale, ScannedTask, Schedule, TaskLoopsSettings } from "../../core/types";

export interface PlannerOptions {
	scale: CalendarScale;
	anchor: string;
	settings: TaskLoopsSettings;
	/** Unfiltered hierarchy for inherited task colors. */
	allTasks?: ScannedTask[];
	schedule: (task: ScannedTask, schedule: Schedule) => Promise<unknown>;
	complete: (task: ScannedTask) => Promise<boolean>;
	edit: (task: ScannedTask) => void;
	create: (schedule: Schedule, path?: string) => void;
	saveZoom?: (size: number) => void;
	timeViewport?: TimeGridViewport;
	dropTarget?: (element: HTMLElement, scheduleAt: (event: DragEvent) => Schedule | null) => void;
}
