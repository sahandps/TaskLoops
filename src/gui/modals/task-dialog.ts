import { applyPlannerTheme } from "../components/planner-theme";
import type { PlannerTheme } from "../../core/types";
import type { Modal } from "obsidian";

/** Header, scrolling body and pinned footer shared by task dialogs and the editor panel. */
export function mountTaskDialog(
	root: HTMLElement,
	title: string,
): {
	header: HTMLElement;
	heading: HTMLElement;
	body: HTMLElement;
	actions: HTMLElement;
} {
	root.addClass("tl-task-dialog");
	const header = root.createDiv("tl-dialog-header");
	header.createDiv({ cls: "tl-dialog-eyebrow", text: "TaskLoops" });
	const heading = header.createEl("h2", { text: title });
	const body = root.createDiv("tl-dialog-body");
	const actions = root.createDiv("tl-dialog-actions");
	return { header, heading, body, actions };
}

/** Shared visual structure for task creation and editing modals. */
export function taskDialog(
	modal: Modal,
	title: string,
	theme?: PlannerTheme,
): {
	body: HTMLElement;
	actions: HTMLElement;
} {
	modal.modalEl.addClass("tl-task-modal");
	applyPlannerTheme(modal.modalEl, theme);
	const { body, actions } = mountTaskDialog(modal.contentEl, title);
	return { body, actions };
}

export function taskSection(parent: HTMLElement, title: string): HTMLElement {
	const section = parent.createEl("section", { cls: "tl-dialog-section", attr: { "aria-label": title } });
	section.createEl("h3", { text: title, cls: "tl-section-title" });
	return section;
}
