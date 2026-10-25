import { todayISO } from "../../core/dates";
import { calendarColorField } from "./calendar-color-field";
import { priorityField } from "./priority-field";
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
		const storage = taskSection(body, "Store in");
		const mode = storage.createEl("select", { attr: { "aria-label": "Task storage" } });
		mode.createEl("option", { value: "note", text: "Selected note" });
		const dailyOption = mode.createEl("option", { value: "daily", text: "Daily note" });
		dailyOption.disabled = !this.plugin.dailyNotes?.enabled;
		const dailyDate = storage.createEl("input", {
			type: "date",
			attr: { "aria-label": "Daily note date" },
		});
		dailyDate.value = this.initial.due ?? todayISO();
		dailyDate.hidden = true;
		const dailyHint = storage.createEl("small", { cls: "tl-field-hint" });
		const noteSection = taskSection(body, "Note");
		const updateStorage = () => {
			const daily = mode.value === "daily";
			dailyDate.hidden = !daily;
			noteSection.hidden = daily;
			try {
				dailyHint.setText(
					daily
						? this.plugin.dailyNotes!.path(dailyDate.value) +
								" — opens or creates on save using Daily notes settings."
						: this.plugin.dailyNotes?.enabled
							? "Choose an existing note or your standalone task note."
							: "Enable the core Daily notes plugin to use daily notes.",
				);
			} catch {
				dailyHint.setText("Choose a valid daily note date.");
			}
		};
		mode.onchange = updateStorage;
		dailyDate.onchange = updateStorage;
		updateStorage();
		const create = (schedule: Schedule, reason?: string) =>
			mode.value === "daily"
				? this.plugin.dailyNotes!.createTask(dailyDate.value, text.value, schedule, reason)
				: this.plugin.createTask(text.value, this.path, schedule, reason);
		projectDestination(noteSection, this.app, this.plugin, this.path, (path) => {
			this.path = path;
		});
		const readPriority = priorityField(label, this.plugin.settings, this.initial.priority);
		const readColor = calendarColorField(
			label,
			this.initial.color,
			() => this.plugin.settings.projectColors?.[this.path],
		);
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
					save: (reason) => create({ priority: readPriority(), color: readColor() }, reason),
					onSaved: () => this.close(),
				}).open();
			};
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Add task", cls: "mod-cta" });
		const commit = async () => {
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
			save.disabled = true;
			if (await create(schedule)) this.close();
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
