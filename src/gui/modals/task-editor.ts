import { renderSubtaskEditor } from "../components/subtask-editor";
import { App, Modal } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { taskWording } from "../../core/task-edits";
import { scheduleFields } from "./schedule-fields";
import { projectDestination } from "./project-destination";

export class TaskEditorModal extends Modal {
	private path: string;
	constructor(
		app: App,
		private plugin: TaskActions,
		private task: ScannedTask,
		private onUpdated?: () => void,
	) {
		super(app);
		this.path = task.path;
	}
	onOpen(): void {
		const root = this.contentEl;
		root.createEl("h2", { text: "Edit task" });
		const label = root.createEl("label", { text: "Task" });
		const text = label.createEl("input", { type: "text", cls: "tl-task-input" });
		text.value = taskWording(this.task.raw);
		const links = root.createDiv("tl-note-links");
		links.createEl("button", {
			text: "Jump to task in note ↗",
			attr: {
				title: "Open the source note at this task in a new tab. Unsaved edits stay in this dialog.",
			},
		}).onclick = () => void this.plugin.reveal(this.task);
		projectDestination(root, this.app, this.plugin, this.path, (path) => {
			this.path = path;
		});
		const fields = scheduleFields(root, this.task);
		root.createEl("button", { text: "Remove schedule", cls: "tl-clear-schedule" }).onclick = () =>
			fields.clear();
		const subtasks = renderSubtaskEditor(root, this.app, this.plugin, this.task, (child, onUpdated) =>
			new TaskEditorModal(this.app, this.plugin, child, onUpdated).open(),
		);
		const actions = root.createDiv("tl-dialog-actions");
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save changes", cls: "mod-cta" });
		save.onclick = () => {
			const schedule = fields.read();
			if (!schedule) return;
			if (!text.value.trim()) {
				text.focus();
				return;
			}
			subtasks.flushDraft();
			save.disabled = true;
			void this.plugin
				.editTask(this.task, text.value, this.path, schedule, subtasks.drafts, subtasks.selected)
				.then((ok) => {
					if (ok) this.close();
					else save.disabled = false;
				});
		};
		text.focus();
	}
	onClose(): void {
		this.contentEl.empty();
		this.onUpdated?.();
	}
}
