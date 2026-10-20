import { App, FuzzySuggestModal } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { formatDate, formatDuration, formatTime } from "../../core/schedule";

/** Choose the actual source task; selection alone never changes Markdown. */
export class ExistingTaskPicker extends FuzzySuggestModal<ScannedTask> {
	constructor(
		app: App,
		private tasks: ScannedTask[],
		private plugin: TaskActions,
		private onPick: (task: ScannedTask) => void,
	) {
		super(app);
		this.setPlaceholder("Search tasks in " + this.plugin.noteName(tasks[0]?.path ?? "this note") + "…");
		this.setInstructions([
			{ command: "↑ ↓", purpose: "navigate tasks" },
			{ command: "↵", purpose: "select subtask" },
			{ command: "esc", purpose: "cancel" },
		]);
	}
	getItems(): ScannedTask[] {
		return this.tasks;
	}
	getItemText(task: ScannedTask): string {
		return task.text;
	}
	renderSuggestion(match: { item: ScannedTask }, el: HTMLElement): void {
		const task = match.item;
		el.createDiv({ cls: "tl-picker-title", text: task.text });
		const schedule = [
			task.due ? formatDate(task.due, this.plugin.settings.dateFormat) : "No date",
			task.deadline
				? "Deadline: " + formatDate(task.deadline, this.plugin.settings.dateFormat)
				: undefined,
			task.time ? formatTime(task.time, this.plugin.settings.timeFormat) : undefined,
			task.duration ? formatDuration(task.duration) : undefined,
		]
			.filter(Boolean)
			.join(" · ");
		el.createDiv({ cls: "tl-picker-meta", text: schedule + " · Line " + (task.line + 1) });
	}
	onChooseItem(task: ScannedTask): void {
		this.onPick(task);
	}
}
