import { taskColorResolver } from "../../core/task-colors";
import { calendarColorField } from "./calendar-color-field";
import { priorityField } from "./priority-field";
import { attachNoteLinkSuggest } from "../components/note-link-suggest";
import { TaskDeferralModal } from "./task-deferral";
import { mountTaskDialog, taskSection } from "./task-dialog";
import { renderCompletionCheckbox } from "../components/completion-checkbox";
import { renderSubtaskEditor } from "../components/subtask-editor";
import { App, normalizePath } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { taskWording } from "../../core/task-edits";
import { scheduleFields } from "./schedule-fields";
import { projectDestination } from "./project-destination";

let titleSequence = 0;

/** Build the edit form into a panel. `close` dismisses this frame; `openChild` stacks a subtask. */
export function renderTaskEditor(
	panel: HTMLElement,
	app: App,
	plugin: TaskActions,
	task: ScannedTask,
	close: () => void,
	openChild: (task: ScannedTask, onUpdated: () => void) => void,
): HTMLElement {
	panel.addClass("tl-task-editor", "tl-task-modal");
	const dialog = panel.createDiv();
	const { header, heading, body, actions } = mountTaskDialog(dialog, "Edit task");
	heading.id = "tl-editor-title-" + String(++titleSequence);
	const dismiss = header.createEl("button", {
		text: "×",
		cls: "tl-editor-close",
		attr: { type: "button", "aria-label": "Close", title: "Close" },
	});
	dismiss.onclick = () => close();
	let path = task.path;
	const details = taskSection(body, "Task");
	const text = details.createEl("input", {
		type: "text",
		cls: "tl-task-input",
		attr: { "aria-label": "Task", autofocus: "" },
	});
	text.value = taskWording(task.raw);
	attachNoteLinkSuggest(text, app, () => path);
	const meta = details.createDiv("tl-task-detail-actions");
	const status = meta.createDiv("tl-task-status");
	const statusLabel = status.createEl("label");
	const statusText = statusLabel.createSpan({
		text: task.checked ? "Completed" : "Mark complete",
	});
	const check = renderCompletionCheckbox(
		statusLabel,
		task,
		(item) => plugin.complete(item),
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
	}).onclick = () => void plugin.reveal(task);
	details.createEl("small", {
		cls: "tl-field-hint",
		text: "Completion and deletion save immediately. Other edits save below.",
	});
	const note = taskSection(body, "Note");
	const destination = projectDestination(note, app, plugin, path, (next) => {
		path = next;
	});
	const readPriority = priorityField(details, plugin.settings, task.priority);
	const readColor = calendarColorField(
		details,
		task.color,
		() => plugin.settings.projectColors?.[path],
		() => taskColorResolver(plugin.allTasks()).inherited(task),
	);
	const scheduleSection = taskSection(body, "Schedule");
	const fields = scheduleFields(scheduleSection, task);
	scheduleSection.createEl("button", {
		text: "Clear schedule",
		cls: "tl-clear-schedule tl-quiet-button",
	}).onclick = () => fields.clear();
	let previousPath = path;
	let followingSubtasks = false;
	const subtasks = renderSubtaskEditor(
		taskSection(body, "Subtasks"),
		app,
		plugin,
		task,
		(child, onUpdated) => openChild(child, onUpdated),
		() => path,
		(selected) => {
			if (task.path !== normalizePath(plugin.settings.standaloneNote)) return;
			const target = selected[0]?.path;
			if (target) {
				if (!followingSubtasks) previousPath = path;
				path = target;
				destination.update(
					target,
					"This parent moves here when you save. Existing subtasks stay in this note. Remove the selections to choose another destination.",
				);
			} else if (followingSubtasks) {
				path = previousPath;
				destination.update(path);
			}
			followingSubtasks = !!target;
		},
	);
	const defer = actions.createEl("button", { text: "Can’t schedule now", cls: "tl-defer-from-dialog" });
	defer.disabled = task.checked;
	defer.onclick = () => {
		if (!text.value.trim()) {
			text.focus();
			return;
		}
		new TaskDeferralModal(app, plugin, task, {
			text: text.value,
			path,
			save: (reason) => {
				subtasks.flushDraft();
				return plugin.editTask(
					task,
					text.value,
					path,
					{ priority: readPriority(), color: readColor() },
					subtasks.drafts,
					subtasks.selected,
					reason,
				);
			},
			onSaved: () => close(),
		}).open();
	};
	const remove = actions.createEl("button", {
		text: "Delete task",
		cls: "tl-delete-task mod-warning",
		attr: {
			title: "Removes this task’s line from its source note. Subtasks and other note content remain.",
		},
	});
	actions.createEl("button", { text: "Cancel" }).onclick = () => close();
	const save = actions.createEl("button", { text: "Save changes", cls: "mod-cta" });
	const setBusy = (busy: boolean) => {
		save.disabled = busy;
		remove.disabled = busy;
		defer.disabled = busy || task.checked;
		check.disabled = busy || task.checked;
	};
	remove.onclick = () => {
		setBusy(true);
		void plugin
			.deleteTask(task)
			.then((deleted) => {
				if (deleted) close();
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
		void plugin
			.editTask(task, text.value, path, schedule, subtasks.drafts, subtasks.selected)
			.then((ok) => {
				if (ok) close();
				else setBusy(false);
			})
			.catch(() => setBusy(false));
	};
	text.focus();
	return heading;
}
