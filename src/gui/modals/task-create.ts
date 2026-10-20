import { attachNoteLinkSuggest } from "../components/note-link-suggest";
import { TaskDeferralModal } from "./task-deferral";
import { taskDialog, taskSection } from "./task-dialog";
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
		const { body, actions } = taskDialog(this, "Add a task", this.plugin.settings.theme);
		const label = taskSection(body, "Task");
		const text = label.createEl("input", {
			type: "text",
			cls: "tl-task-input",
			placeholder: "What needs doing?",
			attr: { "aria-label": "Task", autofocus: "" },
		});
		attachNoteLinkSuggest(text, this.app, () => this.path);
		projectDestination(taskSection(body, "Note"), this.app, this.plugin, this.path, (path) => {
			this.path = path;
		});
		const fields = scheduleFields(taskSection(body, "Schedule"), this.initial);
		actions.createEl("button", { text: "Can’t schedule now", cls: "tl-defer-from-dialog" }).onclick =
			() => {
				if (!text.value.trim()) {
					text.focus();
					return;
				}
				new TaskDeferralModal(this.app, this.plugin, undefined, {
					text: text.value,
					path: this.path,
					save: (reason) => this.plugin.createTask(text.value, this.path, {}, reason),
					onSaved: () => this.close(),
				}).open();
			};
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
