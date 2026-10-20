import type { ScannedTask } from "./types";

export type CompletionTab = "open" | "completed";

/** Partition the filtered list without changing scan order, tasks or hierarchy. */
export function completionView(tasks: ScannedTask[], preferred: CompletionTab = "open") {
	const open = tasks.filter((task) => !task.checked);
	const completed = tasks.filter((task) => task.checked);
	const selected = !open.length ? "completed" : !completed.length ? "open" : preferred;
	return { open, completed, selected, tasks: selected === "open" ? open : completed };
}
