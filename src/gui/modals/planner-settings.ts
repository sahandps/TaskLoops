import { App, Modal, Notice } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import { normalizeSettings } from "../../core/settings";
import { taskDialog, taskSection } from "./task-dialog";

/** Planner settings shared by Logseq and the local preview. Changes save together. */
export class PlannerSettingsModal extends Modal {
	constructor(
		app: App,
		private actions: TaskActions,
		private refresh: () => void,
		private initialSection = "General",
	) {
		super(app);
	}
	onOpen(): void {
		const draft = normalizeSettings(this.actions.settings);
		const { body, actions } = taskDialog(this, "Settings", draft.theme);
		this.modalEl.classList.add("tl-settings-modal");
		body.createEl("p", {
			text: "Make TaskLoops work the way you plan. Changes apply when you save.",
			cls: "tl-settings-intro",
		});
		const nav = body.createEl("nav", {
			cls: "tl-settings-nav",
			attr: { "aria-label": "Settings sections" },
		});
		const sections = new Map<string, HTMLElement>();
		for (const [name, hint] of [
			["General", "Appearance and your starting view."],
			["Calendar", "Dates, time, and your calendar layout."],
			["Tasks", "Priorities and task defaults."],
			["Projects", "Use a color to recognize each project or page across your planner."],
		]) {
			const section = taskSection(body, name);
			section.createEl("p", { text: hint, cls: "tl-field-hint" });
			sections.set(name, section);
			nav.createEl("button", {
				text: name,
				attr: { "aria-pressed": String(name === this.initialSection) },
			}).onclick = (event) => {
				for (const [key, item] of sections) item.hidden = key !== name;
				for (const button of nav.querySelectorAll("button"))
					button.setAttribute("aria-pressed", String(button === event.currentTarget));
			};
			section.hidden = name !== this.initialSection;
		}
		const general = sections.get("General")!;
		const calendar = sections.get("Calendar")!;
		const tasks = sections.get("Tasks")!;
		const projects = sections.get("Projects")!;
		const select = (
			parent: HTMLElement,
			name: string,
			hint: string,
			initial: string,
			choices: [string, string][],
			set: (value: string) => void,
		) => {
			const row = parent.createEl("label", { cls: "tl-settings-row" });
			const copy = row.createDiv();
			copy.createSpan({ text: name });
			copy.createEl("small", { text: hint });
			const field = row.createEl("select", { attr: { "aria-label": name } });
			for (const [value, text] of choices) field.createEl("option", { value, text });
			field.value = initial;
			field.onchange = () => set(field.value);
		};
		const toggle = (
			parent: HTMLElement,
			name: string,
			hint: string,
			initial: boolean,
			set: (value: boolean) => void,
		) => {
			const row = parent.createEl("label", { cls: "tl-settings-row" });
			const copy = row.createDiv();
			copy.createSpan({ text: name });
			copy.createEl("small", { text: hint });
			const field = row.createEl("input", { type: "checkbox", attr: { "aria-label": name } });
			field.checked = initial;
			field.onchange = () => set(field.checked);
		};
		select(
			general,
			"Theme",
			"Choose the planner’s appearance.",
			draft.theme,
			[
				["inherit", "Follow system"],
				["light", "Light"],
				["dark", "Dark"],
			],
			(v) => {
				draft.theme = v as typeof draft.theme;
			},
		);
		select(
			general,
			"Default view",
			"Shown when TaskLoops starts.",
			draft.defaultView,
			[
				["today", "Today"],
				["planner", "Planner"],
				["notes", "Notes"],
			],
			(v) => {
				draft.defaultView = v as typeof draft.defaultView;
			},
		);
		select(
			calendar,
			"Time display",
			"Display times in the calendar and task cards.",
			draft.timeFormat,
			[
				["24h", "24-hour · 14:00"],
				["12h", "12-hour · 2:00 PM"],
			],
			(v) => {
				draft.timeFormat = v as typeof draft.timeFormat;
			},
		);
		select(
			calendar,
			"Week starts on",
			"Applies to all calendar views.",
			String(draft.weekStart),
			[
				["1", "Monday"],
				["0", "Sunday"],
				["6", "Saturday"],
			],
			(v) => {
				draft.weekStart = Number(v);
			},
		);
		select(
			calendar,
			"Opening hour",
			"First visible hour in Day and Week.",
			String(draft.startHour),
			Array.from({ length: 24 }, (_, h) => [String(h), `${String(h).padStart(2, "0")}:00`]),
			(v) => {
				draft.startHour = Number(v);
			},
		);
		toggle(calendar, "Week numbers", "Show ISO week numbers.", draft.showWeekNumbers, (v) => {
			draft.showWeekNumbers = v;
		});
		select(
			tasks,
			"Default duration",
			"Used for new timed tasks.",
			String(draft.defaultDuration),
			[5, 15, 30, 45, 60, 90, 120].map((n) => [String(n), `${n} minutes`]),
			(v) => {
				draft.defaultDuration = Number(v);
			},
		);
		toggle(
			tasks,
			"Show completed by default",
			"Include completed tasks when opening a planner.",
			draft.showCompleted,
			(v) => {
				draft.showCompleted = v;
			},
		);
		toggle(
			tasks,
			"Progress bars",
			"Show completion progress for each project.",
			draft.showProgressBars,
			(v) => {
				draft.showProgressBars = v;
			},
		);
		tasks.createEl("h3", { text: "Priorities" });
		tasks.createEl("p", {
			text: "Rename levels or choose their colors. Removing a level keeps its ID on existing tasks until you change their priority.",
			cls: "tl-field-hint",
		});
		const priorityList = tasks.createDiv("tl-priority-list");
		const drawPriorities = () => {
			priorityList.empty();
			for (const priority of draft.priorities) {
				const row = priorityList.createDiv("tl-priority-setting");
				const color = row.createEl("input", {
					type: "color",
					attr: { "aria-label": `Color for ${priority.name}` },
				});
				color.value = priority.color;
				color.oninput = () => {
					priority.color = color.value;
				};
				const name = row.createEl("input", {
					type: "text",
					attr: { "aria-label": `Priority name: ${priority.name}`, maxlength: "40" },
				});
				name.value = priority.name;
				name.oninput = () => {
					priority.name = name.value;
				};
				row.createEl("button", {
					text: "Remove",
					attr: { "aria-label": `Remove priority ${priority.name}` },
				}).onclick = () => {
					draft.priorities = draft.priorities.filter((item) => item.id !== priority.id);
					drawPriorities();
				};
			}
		};
		drawPriorities();
		tasks.createEl("button", { text: "+ Add priority" }).onclick = () => {
			draft.priorities.push({
				id: `priority-${crypto.randomUUID()}`,
				name: "New priority",
				color: "#6674bd",
			});
			drawPriorities();
		};
		const paths = [
			...new Set([
				...this.actions.allTasks().map((task) => task.path),
				...Object.keys(draft.projectColors),
			]),
		].sort();
		if (!paths.length)
			projects.createEl("p", { text: "Create a task in a project or page to choose its color here." });
		for (const path of paths) {
			const row = projects.createDiv("tl-settings-row");
			const copy = row.createDiv();
			copy.createSpan({ text: this.actions.noteName(path) });
			copy.createEl("small", { text: path });
			const controls = row.createDiv("tl-project-color-controls");
			const color = controls.createEl("input", {
				type: "color",
				attr: { "aria-label": `Project color: ${path}` },
			});
			color.value = draft.projectColors[path] ?? "#47705a";
			color.oninput = () => {
				draft.projectColors[path] = color.value;
				reset.disabled = false;
			};
			const reset = controls.createEl("button", {
				text: "Reset",
				attr: { "aria-label": `Reset color: ${path}` },
			});
			reset.disabled = !draft.projectColors[path];
			reset.onclick = () => {
				delete draft.projectColors[path];
				color.value = "#47705a";
				reset.disabled = true;
			};
		}
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
		const save = actions.createEl("button", { text: "Save settings", cls: "mod-cta" });
		save.onclick = async () => {
			const names = draft.priorities.map((item) => item.name.trim().toLowerCase());
			if (names.some((name) => !name) || new Set(names).size !== names.length) {
				new Notice("Give each priority a unique, non-empty name.");
				return;
			}
			const previous = this.actions.settings;
			this.actions.settings = normalizeSettings(draft);
			save.disabled = true;
			try {
				await this.actions.saveSettings();
				this.refresh();
				this.close();
			} catch {
				this.actions.settings = previous;
				save.disabled = false;
				new Notice("Settings could not be saved. Please try again.");
			}
		};
	}
	onClose(): void {
		this.contentEl.empty();
	}
}
