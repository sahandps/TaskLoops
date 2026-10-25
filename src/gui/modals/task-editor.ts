import { taskColorResolver } from "../../core/task-colors";
import { calendarColorField } from "./calendar-color-field";
import { priorityField } from "./priority-field";
import { attachNoteLinkSuggest } from "../components/note-link-suggest";
import { TaskDeferralModal } from "./task-deferral";
import { taskDialog, taskSection } from "./task-dialog";
import { renderCompletionCheckbox } from "../components/completion-checkbox";
import { renderSubtaskEditor } from "../components/subtask-editor";
import { App, Modal, normalizePath } from "obsidian";
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
		const { body, actions } = taskDialog(this, "Edit task", this.plugin.settings.theme);
		const details = taskSection(body, "Task");
		const text = details.createEl("input", {
			type: "text",
			cls: "tl-task-input",
			attr: { "aria-label": "Task", autofocus: "" },
		});
		text.value = taskWording(this.task.raw);
		attachNoteLinkSuggest(text, this.app, () => this.path);
		const meta = details.createDiv("tl-task-detail-actions");
		const status = meta.createDiv("tl-task-status");
		const statusLabel = status.createEl("label");
		const statusText = statusLabel.createSpan({
			text: this.task.checked ? "Completed" : "Mark complete",
		});
		const check = renderCompletionCheckbox(
			statusLabel,
			this.task,
			(task) => this.plugin.complete(task),
			() => {
				statusText.textContent = "Completed";
			},
		);
		statusLabel.prepend(check);
		status.title = "Completion saves immediately. Other edits use Save changes.";
		meta.createEl("button", {
			text: "View in note ↗",
			cls: "tl-quiet-button",
			attr: { title: "Open the task in its note. Your draft stays open." },
		}).onclick = () => void this.plugin.reveal(this.task);
		details.createEl("small", {
			cls: "tl-field-hint",
			text: "Completion and deletion save immediately. Other edits save below.",
		});
		const note = taskSection(body, "Note");
		const destination = projectDestination(note, this.app, this.plugin, this.path, (path) => {
			this.path = path;
		});
		const readPriority = priorityField(details, this.plugin.settings, this.task.priority);
		const readColor = calendarColorField(
			details,
			this.task.color,
			() => this.plugin.settings.projectColors?.[this.path],
			() => taskColorResolver(this.plugin.allTasks()).inherited(this.task),
		);
		const schedule = taskSection(body, "Schedule");
		const fields = scheduleFields(schedule, this.task);
		schedule.createEl("button", {
			text: "Clear schedule",
			cls: "tl-clear-schedule tl-quiet-button",
		}).onclick = () => fields.clear();
		let previousPath = this.path;
		let followingSubtasks = false;
		const subtasks = renderSubtaskEditor(
			taskSection(body, "Subtasks"),
			this.app,
			this.plugin,
			this.task,
			(child, onUpdated) => new TaskEditorModal(this.app, this.plugin, child, onUpdated).open(),
			() => this.path,
			(selected) => {
				if (this.task.path !== normalizePath(this.plugin.settings.standaloneNote)) return;
				const target = selected[0]?.path;
				if (target) {
					if (!followingSubtasks) previousPath = this.path;
					this.path = target;
					destination.update(
						target,
						"This parent moves here when you save. Existing subtasks stay in this note. Remove the selections to choose another destination.",
					);
				} else if (followingSubtasks) {
					this.path = previousPath;
					destination.update(this.path);
				}
				followingSubtasks = !!target;
			},
		);
		const defer = actions.createEl("button", { text: "Can’t schedule now", cls: "tl-defer-from-dialog" });
		defer.disabled = this.task.checked;
		defer.onclick = () => {
			if (!text.value.trim()) {
				text.focus();
				return;
			}
			new TaskDeferralModal(this.app, this.plugin, this.task, {
				text: text.value,
				path: this.path,
				save: (reason) => {
					subtasks.flushDraft();
					return this.plugin.editTask(
						this.task,
						text.value,
						this.path,
						{ priority: readPriority(), color: readColor() },
						subtasks.drafts,
						subtasks.selected,
						reason,
					);
				},
				onSaved: () => this.close(),
			}).open();
		};
		const remove = actions.createEl("button", {
			text: "Delete task",
			cls: "tl-delete-task mod-warning",
			attr: {
				title: "Removes this task’s line from its source note. Subtasks and other note content remain.",
			},
		});
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save changes", cls: "mod-cta" });
		const setBusy = (busy: boolean) => {
			save.disabled = busy;
			remove.disabled = busy;
			defer.disabled = busy || this.task.checked;
			check.disabled = busy || this.task.checked;
		};
		remove.onclick = () => {
			setBusy(true);
			void this.plugin
				.deleteTask(this.task)
				.then((deleted) => {
					if (deleted) this.close();
					else setBusy(false);
				})
				.catch(() => setBusy(false));
		};
		save.onclick = () => {
			const schedule = fields.read();
			if (schedule) {
				schedule.priority = readPriority();
				schedule.color = readColor();
			}
			if (!schedule) return;
			if (!text.value.trim()) {
				text.focus();
				return;
			}
			subtasks.flushDraft();
			setBusy(true);
			void this.plugin
				.editTask(this.task, text.value, this.path, schedule, subtasks.drafts, subtasks.selected)
				.then((ok) => {
					if (ok) this.close();
					else setBusy(false);
				})
				.catch(() => setBusy(false));
		};
		text.focus();
	}
	onClose(): void {
		this.contentEl.empty();
		this.onUpdated?.();
	}
}
