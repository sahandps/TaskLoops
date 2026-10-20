import { setIcon } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { todayISO } from "../../core/dates";
import { noteFolder, noteGroups } from "../../core/note-grid";
import type { TaskViewState } from "./view-state";

export function renderNotesView(
	root: HTMLElement,
	actions: TaskActions,
	state: TaskViewState,
	renderCard: (parent: HTMLElement, task: ScannedTask) => HTMLElement,
	onChange: () => void,
): void {
	const tasks = actions.allTasks();
	const pane = root.createDiv(
		"tl-notes-pane" + (actions.settings.noteDensity === "compact" ? " is-compact-grid" : ""),
	);
	const controls = pane.createDiv("tl-notes-controls");
	const search = controls.createEl("input", {
		cls: "tl-search",
		type: "search",
		placeholder: "Search notes and tasks…",
		attr: { "aria-label": "Search notes and tasks" },
	});
	search.value = state.query;
	search.oninput = () => {
		state.query = search.value;
		onChange();
	};
	const folders = [...new Set(tasks.map((task) => noteFolder(task.path)))].sort();
	if (state.folder !== null && !folders.includes(state.folder)) state.folder = null;
	const folder = controls.createEl("select", { attr: { "aria-label": "Filter notes by folder" } });
	folder.createEl("option", { text: "All folders", value: "all" });
	folders.forEach((path, i) => folder.createEl("option", { text: path || "Vault root", value: String(i) }));
	folder.value = state.folder === null ? "all" : String(folders.indexOf(state.folder));
	folder.onchange = () => {
		state.folder = folder.value === "all" ? null : folders[Number(folder.value)];
		onChange();
	};
	const filters = pane.createDiv("tl-note-filters");
	for (const [value, text] of [
		["all", "All task notes"],
		["open", "With open tasks"],
		["today", "Due today"],
		["undated", "Undated tasks"],
	] as const) {
		filters.createEl("button", {
			text,
			attr: { "aria-pressed": String(state.noteFilter === value) },
		}).onclick = () => {
			state.noteFilter = value;
			onChange();
		};
	}
	const groups = noteGroups(tasks, state.query, state.folder, state.noteFilter, todayISO());
	pane.createDiv({
		cls: "tl-notes-count",
		text: `${groups.length} ${groups.length === 1 ? "note" : "notes"}`,
		attr: { "aria-live": "polite" },
	});
	const grid = pane.createDiv("tl-notes-grid");
	for (const group of groups) {
		const note = grid.createEl("article", { cls: "tl-note-card" });
		const heading = note.createDiv("tl-note-heading");
		heading.createEl("button", {
			cls: "tl-note-name",
			text: actions.noteName(group.path),
			attr: { title: "Open note in a new tab" },
		}).onclick = () => void actions.reveal(group.tasks[0]);
		const jump = heading.createEl("button", {
			cls: "tl-open-note",
			attr: { "aria-label": "Open " + group.path + " in a new tab", title: "Open note in a new tab" },
		});
		setIcon(jump, "square-arrow-out-up-right");
		jump.onclick = () => void actions.reveal(group.tasks[0]);
		note.createDiv({ cls: "tl-note-path", text: group.path });
		const expanded = state.expandedNotes.has(group.path);
		const limit = actions.settings.notePreviewLimit ?? 5;
		const preview = note.createDiv("tl-note-preview");
		for (const task of expanded ? group.tasks : group.tasks.slice(0, limit)) {
			const card = renderCard(preview, task);
			if (!task.due && !task.time && !task.duration) card.querySelector(".tl-task-meta")?.remove();
		}
		if (group.tasks.length > limit)
			note.createEl("button", {
				cls: "tl-note-expand",
				text: expanded ? "Show less" : `Show all ${group.tasks.length} tasks`,
				attr: { "aria-expanded": String(expanded) },
			}).onclick = () => {
				if (expanded) state.expandedNotes.delete(group.path);
				else state.expandedNotes.add(group.path);
				onChange();
			};
		const footer = note.createDiv("tl-note-footer");
		footer.createSpan({ text: `${group.open} open · ${group.tasks.length} total` });
		footer.createEl("button", {
			text: "+ Task",
			attr: { "aria-label": "Add task to " + group.path },
		}).onclick = () => actions.newTask({}, group.path);
	}
	if (!groups.length)
		grid.createEl("p", {
			cls: "tl-empty",
			text: tasks.length
				? "No notes match these filters."
				: "No task notes yet. Add a task or write a Markdown checkbox in a note.",
		});
}
