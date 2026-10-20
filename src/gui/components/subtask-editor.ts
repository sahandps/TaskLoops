import { App, Notice } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { existingSubtaskCandidates } from "../../core/existing-tasks";
import { NotePicker } from "../modals/note-picker";
import { ExistingTaskPicker } from "../modals/existing-task-picker";

/** Collect drafts and selections; only the parent's Save action persists them. */
export function renderSubtaskEditor(
	root: HTMLElement,
	app: App,
	actions: TaskActions,
	task: ScannedTask,
	openEditor: (task: ScannedTask, onUpdated: () => void) => void,
): { flushDraft: () => void; drafts: string[]; selected: ScannedTask[] } {
	root.createEl("h3", { text: "Subtasks" });
	const children = root.createDiv("tl-existing-subtasks");
	const drawChildren = () => {
		children.empty();
		for (const child of actions
			.allTasks()
			.filter((child) => child.path === task.path && child.parentId === task.id)) {
			const button = children.createEl("button", {
				cls: "tl-existing-subtask",
				attr: { "aria-label": "Open subtask " + child.text },
			});
			button.createSpan({ cls: "tl-subtask-state", text: child.checked ? "✓" : "○" });
			button.createSpan({ text: child.text });
			button.createSpan({ cls: "tl-subtask-open", text: "↗" });
			button.onclick = () => openEditor(child, drawChildren);
		}
	};
	drawChildren();
	const drafts: string[] = [];
	const list = root.createDiv("tl-subtask-drafts");
	const row = root.createDiv("tl-subtask-entry");
	const subtask = row.createEl("input", {
		type: "text",
		placeholder: "Add a subtask…",
		attr: { "aria-label": "New subtask" },
	});
	const add = () => {
		const value = subtask.value.trim();
		if (!value) return;
		drafts.push(value);
		subtask.value = "";
		drawDrafts();
		subtask.focus();
	};
	const drawDrafts = () => {
		list.empty();
		drafts.forEach((value, index) => {
			const item = list.createDiv("tl-subtask-draft");
			item.createSpan({ text: value });
			item.createEl("button", {
				text: "×",
				attr: { "aria-label": "Remove subtask " + value },
			}).onclick = () => {
				drafts.splice(index, 1);
				drawDrafts();
			};
		});
	};
	row.createEl("button", { text: "Add subtask" }).onclick = add;
	subtask.onkeydown = (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			add();
		}
	};
	const selected: ScannedTask[] = [];
	const selectedList = root.createDiv("tl-selected-subtasks");
	const existingButton = root.createEl("button", {
		cls: "tl-choose-existing",
		text: "Choose existing task…",
	});
	const hint = root.createEl("small", {
		cls: "tl-subtask-hint",
		text: "Find a task in your notes. It and its subtasks will move here when you save.",
	});
	const drawSelected = () => {
		selectedList.empty();
		for (const [index, child] of selected.entries()) {
			const item = selectedList.createDiv("tl-selected-subtask");
			const label = item.createDiv();
			label.createDiv({ text: child.text });
			label.createDiv({ cls: "tl-picker-meta", text: "From " + child.path + " · Added on save" });
			item.createEl("button", {
				text: "×",
				attr: { "aria-label": "Remove selection " + child.text },
			}).onclick = () => {
				selected.splice(index, 1);
				drawSelected();
			};
		}
		existingButton.disabled = !existingSubtaskCandidates(actions.allTasks(), task, selected).length;
		hint.setText(
			existingButton.disabled
				? "No other open tasks available. Create a subtask above, or add a checkbox in another note."
				: "Find a task in your notes. It and its subtasks will move here when you save.",
		);
	};
	existingButton.onclick = () => {
		const candidates = existingSubtaskCandidates(actions.allTasks(), task, selected);
		const notes = [...new Set(candidates.map((task) => task.path))];
		new NotePicker(
			app,
			actions.settings.standaloneNote,
			(path) => {
				const tasks = existingSubtaskCandidates(actions.allTasks(), task, selected).filter(
					(task) => task.path === path,
				);
				if (!tasks.length) {
					new Notice("No available open tasks remain in that note.");
					drawSelected();
					return;
				}
				new ExistingTaskPicker(app, tasks, actions, (task) => {
					selected.push(task);
					drawSelected();
				}).open();
			},
			notes,
		).open();
	};
	drawSelected();
	return { flushDraft: add, drafts, selected };
}
