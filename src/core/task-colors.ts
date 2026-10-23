import type { ScannedTask } from "./types";

/** Resolve colors through the full hierarchy, including unscheduled or filtered parents. */
export function taskColorResolver(tasks: ScannedTask[], projectColors: Record<string, string> = {}) {
	const byId = new Map(tasks.map((task) => [task.id, task]));
	const inherited = (task: ScannedTask): string | undefined => {
		let parent = task.parentId;
		const seen = new Set([task.id]);
		while (parent && !seen.has(parent)) {
			seen.add(parent);
			const ancestor = byId.get(parent);
			if (!ancestor) break;
			if (ancestor.color) return ancestor.color;
			parent = ancestor.parentId;
		}
		return undefined;
	};
	return {
		inherited,
		color: (task: ScannedTask): string | undefined =>
			task.color || inherited(task) || projectColors[task.path],
	};
}
