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
	const selected = destination.createDiv("tl-selected-project");
	const name = selected.createDiv("tl-selected-project-name");
	const location = selected.createDiv("tl-selected-project-path");
	const controls = destination.createDiv("tl-note-actions");
	const pick = controls.createEl("button", {
		text: "Change note…",
		cls: "tl-quiet-button",
		attr: { "aria-label": "Pick project note", title: "Search existing notes in your vault" },
	});
	const projectLink = controls.createEl("button", {
		cls: "tl-open-project tl-quiet-button",
		text: "Open note ↗",
	});
	const hint = destination.createEl("small", { cls: "tl-field-hint" });
	const update = (path: string) => {
		name.setText(plugin.noteName(path));
		location.setText(path);
		const exists = app.vault.getAbstractFileByPath(path) instanceof TFile;
		projectLink.disabled = !exists;
		projectLink.title = exists
			? "Open the selected note in a new tab. Unsaved edits stay in this dialog."
			: "Save the task before opening this note.";
		projectLink.onclick = () => void plugin.openNote(path);
		hint.setText(
			exists
				? "Saves directly to this note."
				: path === plugin.settings.standaloneNote
					? "This note will be created when you save."
					: "Note unavailable. Choose another note before saving.",
		);
	};
	pick.onclick = () =>
		new NotePicker(app, plugin.settings.standaloneNote, (path) => {
			onPick(path);
			update(path);
		}).open();
	update(initial);
}
