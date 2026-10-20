import type { ScannedTask } from "./types";

export interface TaskProgress {
	total: number;
	completed: number;
	percent: number;
}

/** Derive note progress from the flat scan: each checkbox, at every depth, counts once. */
export function noteProgress(tasks: readonly ScannedTask[]): Map<string, TaskProgress> {
	const progress = new Map<string, TaskProgress>();
	for (const task of tasks) {
		if (!task.checkbox) continue;
		let entry = progress.get(task.path);
		if (!entry) {
			entry = { total: 0, completed: 0, percent: 0 };
			progress.set(task.path, entry);
		}
		entry.total++;
		if (task.checked) entry.completed++;
	}
	for (const entry of progress.values()) entry.percent = Math.round((entry.completed / entry.total) * 100);
	return progress;
}
