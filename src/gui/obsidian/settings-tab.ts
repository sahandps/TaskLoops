import { slotHeight } from "../../core/calendar-zoom";
import { App, normalizePath, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type TaskLoopsPlugin from "../../main";
import type { DateFormat } from "../../core/types";
import { DATE_FORMATS, formatDate } from "../../core/schedule";

/** Shared definitions keep settings searchable on 1.13+ and usable on 1.7.2+. */
export class TaskLoopsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: TaskLoopsPlugin,
	) {
		super(app, plugin);
	}
	private definitions(): { name: string; desc: string; render: (setting: Setting) => void }[] {
		const save = async () => {
			await this.plugin.saveSettings();
			this.plugin.refreshViews();
		};
		return [
			{
				name: "Default view",
				desc: "Choose the view shown when opening a new TaskLoops panel.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("today", "Today · daily agenda")
							.addOption("planner", "Planner")
							.addOption("notes", "Notes · task grid")
							.setValue(this.plugin.settings.defaultView)
							.onChange(async (value) => {
								this.plugin.settings.defaultView =
									value === "today" ? "today" : value === "notes" ? "notes" : "planner";
								await save();
							}),
					);
				},
			},
			{
				name: "Tasks per note card",
				desc: "Preview 3, 5 or 10 tasks. Use Show all on a card to see the rest.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("3", "3 tasks")
							.addOption("5", "5 tasks")
							.addOption("10", "10 tasks")
							.setValue(String(this.plugin.settings.notePreviewLimit))
							.onChange(async (value) => {
								this.plugin.settings.notePreviewLimit = Number(value);
								await save();
							}),
					);
				},
			},
			{
				name: "Date format",
				desc: "Used for displayed dates and new schedules. Includes padded, compact and English month-name formats. Numeric day-first dates stay day-first. Changing this never rewrites existing notes.",
				render: (setting) => {
					setting.addDropdown((dropdown) => {
						for (const format of DATE_FORMATS)
							dropdown.addOption(format, format + " · " + formatDate("2026-01-05", format));
						dropdown.setValue(this.plugin.settings.dateFormat).onChange(async (value) => {
							this.plugin.settings.dateFormat = value as DateFormat;
							await save();
						});
					});
				},
			},
			{
				name: "Time display",
				desc: "Choose 24-hour time or AM/PM. Markdown schedules and time inputs keep HH:mm for reliable parsing.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("24h", "24-hour · 14:05")
							.addOption("12h", "12-hour · 2:05 PM")
							.setValue(this.plugin.settings.timeFormat)
							.onChange(async (value) => {
								this.plugin.settings.timeFormat = value === "12h" ? "12h" : "24h";
								await save();
							}),
					);
				},
			},
			{
				name: "Week starts on",
				desc: "Applies to week, month and year calendars.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("1", "Monday")
							.addOption("0", "Sunday")
							.addOption("6", "Saturday")
							.setValue(String(this.plugin.settings.weekStart))
							.onChange(async (value) => {
								this.plugin.settings.weekStart = Number(value);
								await save();
							}),
					);
				},
			},
			{
				name: "Calendar scale",
				desc: "Choose day, week, month, year, resource timeline or Gantt. New panels use this scale; switching scale in the planner also updates it.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("day", "Day")
							.addOption("week", "Week")
							.addOption("month", "Month")
							.addOption("year", "Year")
							.addOption("timeline", "Timeline")
							.addOption("gantt", "Gantt")
							.setValue(this.plugin.settings.lastScale)
							.onChange(async (value) => {
								this.plugin.settings.lastScale =
									value as typeof this.plugin.settings.lastScale;
								await save();
							}),
					);
				},
			},
			{
				name: "Timeline opening hour",
				desc: "Scroll to this hour when opening a day or week. All 24 hours remain available.",
				render: (setting) => {
					setting.addDropdown((dropdown) => {
						for (let hour = 0; hour < 24; hour++)
							dropdown.addOption(String(hour), String(hour).padStart(2, "0") + ":00");
						dropdown.setValue(String(this.plugin.settings.startHour)).onChange(async (value) => {
							this.plugin.settings.startHour = Number(value);
							await save();
						});
					});
				},
			},
			{
				name: "Default task duration",
				desc: "Used when scheduling a new timed task without a duration. Existing schedules keep their duration. Dragging and resizing still snap to five minutes.",
				render: (setting) => {
					setting.addDropdown((dropdown) => {
						for (const minutes of [5, 15, 30, 45, 60, 90, 120])
							dropdown.addOption(String(minutes), String(minutes) + " minutes");
						dropdown
							.setValue(String(this.plugin.settings.defaultDuration))
							.onChange(async (value) => {
								this.plugin.settings.defaultDuration = Number(value);
								await save();
							});
					});
				},
			},
			{
				name: "Show completed by default",
				desc: "Include completed tasks when opening a new Planner panel. Its Show completed filter can still be changed independently.",
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
							this.plugin.settings.showCompleted = value;
							await save();
						}),
					);
				},
			},
			{
				name: "Note card spacing",
				desc: "Comfortable spacing or a denser grid for smaller screens.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("comfortable", "Comfortable")
							.addOption("compact", "Compact")
							.setValue(this.plugin.settings.noteDensity)
							.onChange(async (value) => {
								this.plugin.settings.noteDensity =
									value === "compact" ? "compact" : "comfortable";
								await save();
							}),
					);
				},
			},
			{
				name: "Standalone tasks note",
				desc: "Vault-relative Markdown path, created when needed. Existing tasks stay in their notes when this changes.",
				render: (setting) => {
					setting.addText((text) => {
						text.setValue(this.plugin.settings.standaloneNote);
						text.inputEl.onblur = () => {
							const value = normalizePath(text.getValue().trim() || "Standalone Tasks.md");
							this.plugin.settings.standaloneNote = value.endsWith(".md")
								? value
								: value + ".md";
							void save();
						};
					});
				},
			},
			{
				name: "Task scan folder",
				desc: "Leave blank to gather tasks across your vault. Enter a folder path to read tasks only in that folder and its subfolders. New tasks outside this folder stay in their notes but are hidden here.",
				render: (setting) => {
					setting.addText((text) => {
						text.setPlaceholder("All Markdown notes").setValue(this.plugin.settings.scanFolder);
						text.inputEl.onblur = () => {
							this.plugin.settings.scanFolder = text.getValue().trim()
								? normalizePath(text.getValue().trim()).replace(/^\/+|\/+$/g, "")
								: "";
							void this.plugin.saveSettings().then(() => this.plugin.rescan());
						};
					});
				},
			},
			{
				name: "Planner theme",
				desc: "Follow the active Obsidian theme, or use a light or dark TaskLoops palette. Applies only to TaskLoops and its task dialogs.",
				render: (setting) => {
					setting.addDropdown((dropdown) =>
						dropdown
							.addOption("inherit", "Follow Obsidian")
							.addOption("light", "Light")
							.addOption("dark", "Dark")
							.setValue(this.plugin.settings.theme)
							.onChange(async (value) => {
								this.plugin.settings.theme =
									value === "light" || value === "dark" ? value : "inherit";
								await save();
							}),
					);
				},
			},
			{
				name: "Show week numbers",
				desc: "Show ISO week numbers in Today and calendar headings, Month/Timeline and the Year overview.",
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(this.plugin.settings.showWeekNumbers).onChange(async (value) => {
							this.plugin.settings.showWeekNumbers = value;
							await save();
						}),
					);
				},
			},
			{
				name: "Show progress bars",
				desc: "Show checkbox progress for each note in Planner and Notes, and for tasks scheduled in Today. Includes subtasks. Calculated from existing tasks without saving progress data.",
				render: (setting) => {
					setting.addToggle((toggle) =>
						toggle.setValue(this.plugin.settings.showProgressBars).onChange(async (value) => {
							this.plugin.settings.showProgressBars = value;
							await save();
						}),
					);
				},
			},
			{
				name: "Calendar zoom",
				desc: "Day/Week zoom percentage; 100 is the standard scale. Hold left-click on the time labels and drag up/down to zoom. Arrow keys adjust; Home resets.",
				render: (setting) => {
					setting.addSlider((slider) =>
						slider
							.setLimits(50, 333, 1)
							.setValue(Math.round((this.plugin.settings.timeSlotHeight / 24) * 100))
							.onChange(async (value) => {
								this.plugin.settings.timeSlotHeight = slotHeight((24 * value) / 100);
								await save();
							}),
					);
				},
			},
		];
	}
	getSettingDefinitions(): SettingDefinitionItem[] {
		return this.definitions();
	}
	// Older Obsidian versions call display(); 1.13+ renders the definitions above.
	display(): void {
		this.containerEl.empty();
		for (const definition of this.definitions()) {
			const setting = new Setting(this.containerEl)
				.setName(definition.name)
				.setDesc(definition.desc ?? "");
			definition.render(setting);
		}
		this.containerEl.createEl("p", {
			text: "TaskLoops reads Markdown checkboxes locally. It does not upload your notes or edit note properties. Vault file paths are listed to discover notes and search project destinations; folder scope limits task content reads.",
		});
	}
}
