import type { Modal } from "obsidian";

/** Shared visual structure for task creation and editing. */
export function taskDialog(
	modal: Modal,
	title: string,
): {
	body: HTMLElement;
	actions: HTMLElement;
} {
	modal.modalEl.addClass("tl-task-modal");
	const root = modal.contentEl;
	root.addClass("tl-task-dialog");
	const header = root.createDiv("tl-dialog-header");
	header.createDiv({ cls: "tl-dialog-eyebrow", text: "TaskLoops" });
	header.createEl("h2", { text: title });
	const body = root.createDiv("tl-dialog-body");
	const actions = root.createDiv("tl-dialog-actions");
	return { body, actions };
}

export function taskSection(parent: HTMLElement, title: string): HTMLElement {
	const section = parent.createEl("section", { cls: "tl-dialog-section", attr: { "aria-label": title } });
	section.createEl("h3", { text: title, cls: "tl-section-title" });
	return section;
}
