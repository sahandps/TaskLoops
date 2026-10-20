import type { ScannedTask } from "../../core/types";
import type { PlannerOptions } from "./contracts";
import { renderGantt } from "./gantt-view";
import { renderEventCalendar } from "./event-calendar-view";

/** Choose a renderer; each adapter owns its library instance and cleanup. */
export function renderLibraryPlanner(
	root: HTMLElement,
	tasks: ScannedTask[],
	options: PlannerOptions,
): () => void {
	return options.scale === "gantt"
		? renderGantt(root, tasks, options)
		: renderEventCalendar(root, tasks, options);
}
