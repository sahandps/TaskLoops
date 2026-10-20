import { App, Modal } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { Schedule } from "../../core/types";
import { scheduleFields } from "./schedule-fields";
import { projectDestination } from "./project-destination";

export class TaskModal extends Modal {
	private path: string;
	constructor(
		app: App,
		private plugin: TaskActions,
		private initial: Schedule = {},
		path?: string,
	) {
		super(app);
		this.path = path ?? plugin.settings.standaloneNote;
	}
	onOpen(): void {
		const root = this.contentEl;
		root.createEl("h2", { text: "Add a task" });
		const label = root.createEl("label", { text: "Task" });
		const text = label.createEl("input", {
			type: "text",
			cls: "tl-task-input",
			placeholder: "What needs doing?",
		});
		projectDestination(root, this.app, this.plugin, this.path, (path) => {
			this.path = path;
		});
		const fields = scheduleFields(root, this.initial);
		const actions = root.createDiv("tl-dialog-actions");
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Add task", cls: "mod-cta" });
		const commit = async () => {
			const schedule = fields.read();
			if (!schedule) return;
			if (!text.value.trim()) {
				text.focus();
				return;
			}
			save.disabled = true;
			if (await this.plugin.createTask(text.value, this.path, schedule)) this.close();
			else save.disabled = false;
		};
		save.onclick = () => void commit();
		text.onkeydown = (event) => {
			if (event.key === "Enter" && !save.disabled) void commit();
		};
		text.focus();
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
