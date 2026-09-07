import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type TaskLoopsPlugin from "./main";
import type { TaskSource } from "./types";

/** The plugin's settings pane. */
export class TaskLoopsSettingTab extends PluginSettingTab {
	plugin: TaskLoopsPlugin;

	constructor(app: App, plugin: TaskLoopsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Task discovery").setHeading();

		new Setting(containerEl)
			.setName("Find tasks from")
			.setDesc(
				"Markdown checkboxes work automatically. You can also include tagged lines for older workflows."
			)
			.addDropdown((d) =>
				d
					.addOption("checkboxes", "Markdown checkboxes")
					.addOption("both", "Checkboxes and a tag")
					.addOption("tagged", "Tag only")
					.setValue(this.plugin.settings.taskSource)
					.onChange(async (value) => {
						this.plugin.settings.taskSource = value as TaskSource;
						await this.plugin.saveData_();
						await this.plugin.rescan();
					})
			);

		new Setting(containerEl)
			.setName("Optional task tag")
			.setDesc(
				"Used when the source above includes tags. Child tags such as #task/work count too."
			)
			.addText((t) =>
				t
					.setPlaceholder("#task")
					.setValue(this.plugin.settings.tag)
					.onChange(async (v) => {
						const tag = v.trim() || "#task";
						this.plugin.settings.tag = tag.startsWith("#") ? tag : "#" + tag;
						await this.plugin.saveData_();
						await this.plugin.rescan();
					})
			);

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "TaskLoops never adds status markers or rewrites task text. Completing a checkbox changes only [ ] to [x].",
		});

		new Setting(containerEl)
			.setName("Capture note")
			.setDesc(
				"Quick capture appends new tasks to this note, creating it if needed. It is the only note the plugin adds lines to, and it only ever appends."
			)
			.addText((t) =>
				t
					.setPlaceholder("TaskLoops Inbox.md")
					.setValue(this.plugin.settings.captureNote)
					.onChange(async (v) => {
						const path = v.trim() || "TaskLoops Inbox.md";
						this.plugin.settings.captureNote = path.endsWith(".md")
							? path
							: path + ".md";
						await this.plugin.saveData_();
					})
			);

		new Setting(containerEl)
			.setName("Contexts")
			.setDesc("Offered when filing a next action. One per line.")
			.addTextArea((t) => {
				t.setValue(this.plugin.settings.contexts.join("\n")).onChange(
					async (v) => {
						this.plugin.settings.contexts = v
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						await this.plugin.saveData_();
						this.plugin.refreshViews();
					}
				);
				t.inputEl.rows = 6;
			});

		new Setting(containerEl)
			.setName("Show parent folder")
			.setDesc("Display the containing folder next to the note name.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.showFolder).onChange(async (v) => {
					this.plugin.settings.showFolder = v;
					await this.plugin.saveData_();
					this.plugin.refreshViews();
				})
			);

		new Setting(containerEl)
			.setName("Forget all sorting")
			.setDesc(
				"Clears TaskLoops filing, dates, priorities, and project links. Your notes and checkbox states are not touched."
			)
			.addButton((b) => {
				b.setButtonText("Reset").onClick(() => {
					void (async () => {
						this.plugin.items = {};
						await this.plugin.saveData_();
						await this.plugin.rescan();
						new Notice("TaskLoops: sorting data cleared.");
					})();
				});
				// setWarning() is deprecated and setDestructive() needs 1.13.0;
				// the class both of them apply works on every supported version.
				b.buttonEl.addClass("mod-warning");
			});
	}
}
