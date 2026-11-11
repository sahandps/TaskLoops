import { longDayLabel, shiftISO } from "./dates";
import type { KanbanStatus, PriorityDefinition, ScannedTask, Schedule } from "./types";

export const KANBAN_DAYS = 7;

export interface KanbanFilters {
	group: "schedule" | "priority";
	status: KanbanStatus;
	query: string;
	/** Undefined shows all priorities; an empty string shows unprioritized tasks. */
	priority?: string;
}

interface KanbanColumn {
	label: string;
	schedule: Schedule;
	color?: string;
	archived?: boolean;
	tasks: ScannedTask[];
}

export function kanbanBoard(
	tasks: ScannedTask[],
	priorities: PriorityDefinition[],
	start: string,
	filters: KanbanFilters,
) {
	const columns = new Map<string, KanbanColumn>();
	if (filters.group === "schedule") {
		columns.set("", { label: "Unscheduled", schedule: {}, tasks: [] });
		for (let offset = 0; offset < KANBAN_DAYS; offset++) {
			const due = shiftISO(start, offset);
			columns.set(due, { label: longDayLabel(due), schedule: { due }, tasks: [] });
		}
	} else {
		for (const { id, name, color } of priorities)
			columns.set(id, { label: name, schedule: { priority: id }, color, tasks: [] });
		columns.set("", { label: "No priority", schedule: {}, tasks: [] });
	}

	let outsideRange = 0;
	const query = filters.query.trim().toLowerCase();
	for (const task of tasks) {
		if (filters.status !== "all" && task.checked !== (filters.status === "completed")) continue;
		if (query && !task.text.toLowerCase().includes(query) && !task.path.toLowerCase().includes(query))
			continue;
		const priority = task.priority ?? "";
		if (filters.group === "schedule") {
			if (filters.priority !== undefined && priority !== filters.priority) continue;
			const column = columns.get(task.due ?? "");
			if (column) column.tasks.push(task);
			else outsideRange++;
		} else {
			const column = columns.get(priority);
			if (column) column.tasks.push(task);
			else
				columns.set(priority, {
					label: priority + " (archived)",
					schedule: {},
					archived: true,
					tasks: [task],
				});
		}
	}
	if (filters.group === "schedule")
		for (const [due, column] of columns)
			if (due) column.tasks.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
	return { columns: [...columns].map(([id, column]) => ({ id, ...column })), outsideRange };
}
