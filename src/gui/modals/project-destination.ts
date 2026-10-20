import { App, TFile } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import { NotePicker } from "./note-picker";

export function projectDestination(
	root: HTMLElement,
	app: App,
	plugin: TaskActions,
	initial: string,
	onPick: (path: string) => void,
): void {
	const destination = root.createDiv("tl-destination");
	destination.createSpan({ text: "Project / note" });
	const pick = destination.createEl("button", {
		text: "Choose project note…",
		attr: { "aria-label": "Pick project note", title: "Search existing notes in your vault" },
	});
	const selected = destination.createDiv("tl-selected-project");
	const projectLink = destination.createEl("button", {
		cls: "tl-open-project",
		text: "Open project note ↗",
	});
	const hint = destination.createEl("small");
	const update = (path: string) => {
		selected.setText("Selected note: " + path);
		const exists = app.vault.getAbstractFileByPath(path) instanceof TFile;
		projectLink.disabled = !exists;
		projectLink.title = exists
			? "Open the selected note in a new tab. Unsaved edits stay in this dialog."
			: "Save the task before opening this note.";
		projectLink.onclick = () => void plugin.openNote(path);
		hint.setText(
			exists
				? "Save to add or move the task into this note's Tasks section. If there is no Tasks section, # Tasks is appended at the bottom."
				: path === plugin.settings.standaloneNote
					? "No project selected. Saving creates the standalone note with # Tasks. Choose project note to use an existing note instead."
					: "This note is unavailable. Choose another project note before saving.",
		);
	};
	pick.onclick = () =>
		new NotePicker(app, plugin.settings.standaloneNote, (path) => {
			onPick(path);
			update(path);
		}).open();
	update(initial);
}
