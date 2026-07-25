import { App, FuzzySuggestModal, Modal, Setting, TFolder } from "obsidian";
import { JoinedTask } from "./types";

export const CAPTURE_BASENAME = "TaskLoops Inbox.md";

/**
 * Choose the folder captures live in. Dismissing without choosing is a valid
 * answer — it means "just put it somewhere sensible" — so the caller gets null
 * and falls back to the vault root.
 */
export class FolderPicker extends FuzzySuggestModal<string> {
	private folders: string[];
	private picked = false;
	private onDone: (folder: string | null) => void;

	constructor(app: App, onDone: (folder: string | null) => void) {
		super(app);
		this.onDone = onDone;

		const found: string[] = ["/"];
		for (const file of app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder && file.path !== "/") found.push(file.path);
		}
		this.folders = found.sort((a, b) => a.localeCompare(b));

		this.setPlaceholder("Where should captured tasks go?");
		this.setInstructions([
			{ command: "↵", purpose: "put " + CAPTURE_BASENAME + " here" },
			{ command: "esc", purpose: "use the vault root" },
		]);
	}

	getItems(): string[] {
		return this.folders;
	}

	getItemText(folder: string): string {
		return folder === "/" ? "Vault root" : folder;
	}

	onChooseItem(folder: string): void {
		this.picked = true;
		this.onDone(folder);
	}

	onClose(): void {
		super.onClose();
		if (!this.picked) this.onDone(null);
	}
}

export function todayISO(): string {
	const d = new Date();
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 10);
}

export function shiftISO(iso: string, days: number): string {
	const d = new Date(iso + "T00:00:00");
	d.setDate(d.getDate() + days);
	d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
	return d.toISOString().slice(0, 10);
}

interface ProjectChoice {
	uid: string | null;
	label: string;
}

/** Pick the project a task belongs to, or detach it. */
export class ProjectPicker extends FuzzySuggestModal<ProjectChoice> {
	private choices: ProjectChoice[];
	private onPick: (uid: string | null) => void;

	constructor(
		app: App,
		projects: JoinedTask[],
		onPick: (uid: string | null) => void
	) {
		super(app);
		this.onPick = onPick;
		this.choices = [
			...projects.map((p) => ({ uid: p.item.uid, label: p.text })),
			{ uid: null, label: "— Standalone —" },
		];
		this.setPlaceholder("Which project does this belong to?");
	}

	getItems(): ProjectChoice[] {
		return this.choices;
	}

	getItemText(choice: ProjectChoice): string {
		return choice.label;
	}

	onChooseItem(choice: ProjectChoice): void {
		this.onPick(choice.uid);
	}
}

/** Pick an existing task to file under a project. */
export class TaskPicker extends FuzzySuggestModal<JoinedTask> {
	private tasks: JoinedTask[];
	private onPick: (task: JoinedTask) => void;

	constructor(app: App, tasks: JoinedTask[], onPick: (t: JoinedTask) => void) {
		super(app);
		this.tasks = tasks;
		this.onPick = onPick;
		this.setPlaceholder("Search tasks to file under this project…");
	}

	getItems(): JoinedTask[] {
		return this.tasks;
	}

	getItemText(task: JoinedTask): string {
		return task.text + " " + task.path;
	}

	renderSuggestion(match: { item: JoinedTask }, el: HTMLElement): void {
		const task = match.item;
		el.createDiv({ cls: "tl-suggest-text", text: task.text });
		el.createDiv({
			cls: "tl-suggest-meta",
			text: task.path.replace(/\.md$/, ""),
		});
	}

	onChooseItem(task: JoinedTask): void {
		this.onPick(task);
	}
}

/** Set, change or clear a task's date. */
export class DateModal extends Modal {
	private value: string;
	private title: string;
	private allowClear: boolean;
	private onPick: (iso: string | null) => void;

	constructor(
		app: App,
		opts: {
			title?: string;
			initial?: string;
			allowClear?: boolean;
			onPick: (iso: string | null) => void;
		}
	) {
		super(app);
		this.title = opts.title ?? "When does it happen?";
		this.value = opts.initial || todayISO();
		this.allowClear = opts.allowClear ?? false;
		this.onPick = opts.onPick;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("tl-date-modal");
		contentEl.createEl("h3", { text: this.title });

		const quick = contentEl.createDiv("tl-chips");
		const today = todayISO();
		const presets: Array<[string, string]> = [
			["Today", today],
			["Tomorrow", shiftISO(today, 1)],
			["In a week", shiftISO(today, 7)],
		];
		for (const [label, iso] of presets) {
			const b = quick.createEl("button", { cls: "tl-chip-btn", text: label });
			b.onclick = () => this.commit(iso);
		}

		const input = contentEl.createEl("input", {
			cls: "tl-input",
			type: "date",
		});
		input.value = this.value;
		input.oninput = () => (this.value = input.value);
		input.onkeydown = (e) => {
			if (e.key === "Enter") this.commit(this.value);
		};

		const buttons = new Setting(contentEl);
		if (this.allowClear) {
			buttons.addButton((b) =>
				b.setButtonText("Clear date").onClick(() => this.commit(null))
			);
		}
		buttons.addButton((b) =>
			b
				.setButtonText("Save")
				.setCta()
				.onClick(() => this.commit(this.value))
		);

		window.setTimeout(() => input.focus(), 0);
	}

	private commit(iso: string | null): void {
		this.close();
		this.onPick(iso);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Ask for a single line of text. */
export class TextPromptModal extends Modal {
	private value: string;
	private title: string;
	private placeholder: string;
	private cta: string;
	private onSubmit: (value: string) => void;

	constructor(
		app: App,
		opts: {
			title: string;
			placeholder?: string;
			initial?: string;
			cta?: string;
			onSubmit: (value: string) => void;
		}
	) {
		super(app);
		this.title = opts.title;
		this.placeholder = opts.placeholder ?? "";
		this.value = opts.initial ?? "";
		this.cta = opts.cta ?? "Save";
		this.onSubmit = opts.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("tl-date-modal");
		contentEl.createEl("h3", { text: this.title });

		const input = contentEl.createEl("input", {
			cls: "tl-input",
			attr: { placeholder: this.placeholder, spellcheck: "false" },
		});
		input.value = this.value;
		input.oninput = () => (this.value = input.value);
		input.onkeydown = (e) => {
			if (e.key === "Enter") this.commit();
		};

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText(this.cta)
				.setCta()
				.onClick(() => this.commit())
		);

		window.setTimeout(() => input.focus(), 0);
	}

	private commit(): void {
		const value = this.value.trim();
		if (!value) return;
		this.close();
		this.onSubmit(value);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
