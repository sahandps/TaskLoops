import { attachNoteLinkSuggest } from "../components/note-link-suggest";
import { App, Modal, Notice } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import type { ScannedTask } from "../../core/types";
import { validateDeferralReason } from "../../core/task-deferral";
import { ExistingTaskPicker } from "./existing-task-picker";
import { projectDestination } from "./project-destination";
import { taskDialog, taskSection } from "./task-dialog";

export interface DeferralDraft {
	text: string;
	path: string;
	save: (reason: string) => Promise<boolean>;
	onSaved: () => void;
}

/** A reason is saved with the checkbox task, never just in plugin settings. */
export class TaskDeferralModal extends Modal {
	private task?: ScannedTask;
	private mode: "new" | "existing";
	private reason = "";
	private wording = "";
	private path: string;
	constructor(
		app: App,
		private actions: TaskActions,
		task?: ScannedTask,
		private draft?: DeferralDraft,
	) {
		super(app);
		this.task = task;
		this.mode = task ? "existing" : "new";
		this.reason = task?.deferral && !task.deferral.scheduledOn ? task.deferral.reason : "";
		this.path = actions.settings.standaloneNote;
	}
	onOpen(): void {
		this.draw();
	}
	private draw(): void {
		this.contentEl.empty();
		const { body, actions } = taskDialog(this, "Can’t schedule now");
		const section = taskSection(body, "Task");
		if (this.draft) {
			section.createDiv({ text: this.draft.text, cls: "tl-selected-project-name" });
			section.createDiv({ text: this.draft.path, cls: "tl-selected-project-path" });
		} else {
			const choices = section.createDiv("tl-deferral-mode");
			for (const [value, label] of [
				["new", "New task"],
				["existing", "Existing task"],
			] as const) {
				choices.createEl("button", {
					text: label,
					attr: { "aria-pressed": String(this.mode === value) },
				}).onclick = () => {
					this.mode = value;
					this.draw();
				};
			}
			if (this.mode === "new") {
				const input = section.createEl("input", {
					type: "text",
					cls: "tl-task-input",
					placeholder: "What needs doing?",
					attr: { "aria-label": "Task" },
				});
				attachNoteLinkSuggest(input, this.app, () => this.path);
				input.value = this.wording;
				input.oninput = () => {
					this.wording = input.value;
				};
				projectDestination(taskSection(body, "Note"), this.app, this.actions, this.path, (path) => {
					this.path = path;
				});
			} else {
				section.createDiv({
					text: this.task?.text ?? "Choose an unfinished task from your notes.",
					cls: "tl-selected-project-name",
				});
				if (this.task) section.createDiv({ text: this.task.path, cls: "tl-selected-project-path" });
				const pick = section.createEl("button", {
					text: "Choose existing task…",
					cls: "tl-quiet-button",
				});
				pick.onclick = () => {
					const candidates = this.actions.allTasks().filter((task) => !task.checked);
					if (!candidates.length) {
						new Notice("No unfinished tasks are available.");
						return;
					}
					const picker = new ExistingTaskPicker(this.app, candidates, this.actions, (task) => {
						this.task = task;
						this.reason =
							task.deferral && !task.deferral.scheduledOn ? task.deferral.reason : this.reason;
						this.draw();
					});
					picker.setPlaceholder("Search unfinished tasks across your notes…");
					picker.open();
				};
			}
		}
		const reasonSection = taskSection(body, "What’s preventing scheduling?");
		const label = reasonSection.createEl("label");
		const reason = label.createEl("textarea", {
			cls: "tl-deferral-reason-input",
			attr: {
				"aria-label": "Reason",
				rows: "3",
				maxlength: "1000",
				placeholder: "For example: waiting for the supplier to confirm a date.",
			},
		});
		attachNoteLinkSuggest(reason, this.app, () => this.draft?.path ?? this.task?.path ?? this.path);
		reason.value = this.reason;
		reason.oninput = () => {
			this.reason = reason.value;
		};
		reasonSection.createEl("small", {
			cls: "tl-field-hint",
			text: "The reason is saved beneath the task in your note. Any current schedule is removed.",
		});
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save reason", cls: "mod-cta" });
		save.onclick = () => {
			let value: string;
			try {
				value = validateDeferralReason(this.reason);
			} catch {
				new Notice("Enter a reason on one line, up to 1,000 characters.");
				reason.focus();
				return;
			}
			if (!this.draft && this.mode === "existing" && !this.task) {
				new Notice("Choose an existing task first.");
				return;
			}
			if (!this.draft && this.mode === "new" && !this.wording.trim()) {
				new Notice("Enter a task first.");
				return;
			}
			save.disabled = true;
			const write = this.draft
				? this.draft.save(value)
				: this.mode === "existing"
					? this.actions.deferTask(this.task!, value)
					: this.actions.createTask(this.wording, this.path, {}, value);
			void write
				.then((ok) => {
					if (ok) {
						this.close();
						this.draft?.onSaved();
					} else save.disabled = false;
				})
				.catch(() => {
					save.disabled = false;
					new Notice("The task could not be saved. Try again.");
				});
		};
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
