import type { ScannedTask } from "./types";

export type NoteFilter = "all" | "open" | "today" | "undated";
export interface NoteGroup { path: string; tasks: ScannedTask[]; open: number; }
export function noteFolder(path: string): string { return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""; }
export function inScanFolder(path: string, folder = ""): boolean {
	const scope = folder.trim().replace(/^\/+|\/+$/g, "");
	return !scope || path.startsWith(scope + "/");
}
/** Filter groups, keeping the rest of a matching note's tasks visible for context. */
export function noteGroups(tasks: ScannedTask[], query: string, folder: string | null, filter: NoteFilter, today: string): NoteGroup[] {
	const groups = new Map<string, ScannedTask[]>();
	for (const task of tasks) {
		const group = groups.get(task.path) ?? [];
		group.push(task); groups.set(task.path, group);
	}
	const q = query.trim().toLocaleLowerCase();
	return [...groups].filter(([path, entries]) =>
		(folder === null || noteFolder(path) === folder) &&
		(!q || [path, ...entries.map(t => t.text)].join(" ").toLocaleLowerCase().includes(q)) &&
		(filter === "all" || entries.some(t => !t.checked && (filter === "open" || (filter === "today" ? t.due === today : !t.due))))
	).map(([path, entries]) => ({ path, tasks: entries, open: entries.filter(t => !t.checked).length }))
		.sort((a, b) => (a.path.split("/").pop() ?? a.path).localeCompare(b.path.split("/").pop() ?? b.path) || a.path.localeCompare(b.path));
}
