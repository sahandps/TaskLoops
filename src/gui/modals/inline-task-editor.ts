import { App, Modal } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { applyPlannerTheme } from "../components/planner-theme";
import { renderTaskEditor } from "./task-editor";

/** Note buttons use a modal so scheduling stays visible over the source note. */
export class InlineTaskEditorModal extends Modal {
	constructor(
		app: App,
		private actions: TaskActions,
		private task: ScannedTask,
		private onUpdated?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		applyPlannerTheme(this.modalEl, this.actions.settings.theme);
		this.modalEl.addClass("tl-task-modal", "tl-inline-task-modal");
		const heading = renderTaskEditor(
			this.contentEl,
			this.app,
			this.actions,
			this.task,
			() => this.close(),
			(child, updated) => new InlineTaskEditorModal(this.app, this.actions, child, updated).open(),
			true,
		);
		this.modalEl.setAttribute("aria-labelledby", heading.id);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onUpdated?.();
	}
}
