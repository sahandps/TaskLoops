import { attachNoteLinkSuggest } from "./note-link-suggest";
import { App, Notice, normalizePath } from "obsidian";
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
	source: () => string = () => task.path,
	onSelectionChange: (selected: ScannedTask[]) => void = () => {},
): { flushDraft: () => void; drafts: string[]; selected: ScannedTask[] } {
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
	attachNoteLinkSuggest(subtask, app, source);
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
	const standalone = task.path === normalizePath(actions.settings.standaloneNote);
	const candidates = () =>
		existingSubtaskCandidates(actions.allTasks(), task, selected).filter(
			(child) => !standalone || !selected.length || child.path === selected[0].path,
		);
	const selectionHint = () =>
		standalone
			? selected.length
				? "Parent moves to " + selected[0].path + " when you save. Selected tasks stay in that note."
				: "Choose tasks from one note. This standalone parent will move into that note on save."
			: "Selected tasks move here when you save.";
	const selectedList = root.createDiv("tl-selected-subtasks");
	const existingButton = root.createEl("button", {
		cls: "tl-choose-existing tl-quiet-button",
		text: "Choose an existing task…",
	});
	const hint = root.createEl("small", {
		cls: "tl-subtask-hint",
		text: selectionHint(),
	});
	const drawSelected = () => {
		selectedList.empty();
		for (const [index, child] of selected.entries()) {
			const item = selectedList.createDiv("tl-selected-subtask");
			const label = item.createDiv();
			label.createDiv({ text: child.text });
			label.createDiv({
				cls: "tl-picker-meta",
				text: "From " + child.path + (standalone ? " · Stays in this note" : " · Added on save"),
			});
			item.createEl("button", {
				text: "×",
				attr: { "aria-label": "Remove selection " + child.text },
			}).onclick = () => {
				selected.splice(index, 1);
				drawSelected();
			};
		}
		onSelectionChange(selected);
		existingButton.disabled = !candidates().length;
		hint.setText(
			existingButton.disabled
				? standalone && selected.length
					? "No more available tasks in this note. " + selectionHint()
					: "No other open tasks available. Create a subtask above, or add a checkbox in another note."
				: selectionHint(),
		);
	};
	existingButton.onclick = () => {
		const notes = [...new Set(candidates().map((task) => task.path))];
		new NotePicker(
			app,
			actions.settings.standaloneNote,
			(path) => {
				const tasks = candidates().filter((task) => task.path === path);
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
