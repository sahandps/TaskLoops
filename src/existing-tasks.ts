import type { ScannedTask } from "./types";

/** Avoid self-links, existing descendants, ancestors and overlapping selections. */
export function existingSubtaskCandidates(tasks: ScannedTask[], parent: ScannedTask, selected: ScannedTask[] = []): ScannedTask[] {
	const byId = new Map(tasks.map((task) => [task.id, task]));
	const ancestorOf = (ancestor: ScannedTask, descendant: ScannedTask): boolean => {
		const seen = new Set<string>();
		let current: ScannedTask | undefined = descendant;
		while (current && !seen.has(current.id)) {
			if (current.id === ancestor.id) return true;
			seen.add(current.id);
			current = current.parentId ? byId.get(current.parentId) : undefined;
		}
		return false;
	};
	return tasks.filter((task) => task.checkbox && !task.checked &&
		![parent, ...selected].some((other) => ancestorOf(task, other) || ancestorOf(other, task)))
		.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}
