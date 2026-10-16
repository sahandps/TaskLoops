import { App, PluginSettingTab, Setting } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { DateFormat } from "./types";
import { DATE_FORMATS } from "./schedule";

// Keep compatibility with Obsidian 1.7.2; declarative settings require 1.13.0.
export class TaskLoopsSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: TaskLoopsPlugin) { super(app, plugin); }
	display(): void {
		this.containerEl.empty();
		new Setting(this.containerEl).setName("Calendar planner").setHeading();
		new Setting(this.containerEl).setName("Date format").setDesc("Used for displayed dates and new scheduling writes. Existing supported dates remain readable without rewriting notes.")
			.addDropdown((dropdown) => {
				for (const format of DATE_FORMATS) dropdown.addOption(format, format);
				dropdown.setValue(this.plugin.settings.dateFormat).onChange(async (value) => {
					this.plugin.settings.dateFormat = value as DateFormat;
					await this.plugin.saveSettings();
					this.plugin.refreshViews();
				});
			});
		new Setting(this.containerEl).setName("Standalone tasks note").setDesc("Vault-relative Markdown path. Created when you first add a standalone task. Changing this chooses a new destination; existing tasks stay in their notes.")
			.addText((text) => {
				text.setValue(this.plugin.settings.standaloneNote);
				text.inputEl.onblur = () => {
					const value = text.getValue().trim() || "Standalone Tasks.md";
					this.plugin.settings.standaloneNote = value.endsWith(".md") ? value : value + ".md";
					void this.plugin.saveSettings();
				};
			});
		this.containerEl.createEl("p", { text: "TaskLoops gathers Markdown checkboxes. Schedule or resize tasks, edit wording, add subtasks and choose a project note in the task editor. Completing a task changes [ ] to [x]. New and moved tasks use the selected note’s Tasks: section. Note properties and frontmatter are left alone." });
	}
}
