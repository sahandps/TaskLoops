import { TaskLoopsSettingTab } from "../src/gui/obsidian/settings-tab.ts";
import { Modal } from "./obsidian.mjs";
import { installThemeControl } from "./theme-control.mjs";
import { TaskLoopsView } from "../src/gui/views/taskloops-view.ts";
import { TFile, Notice } from "./obsidian.mjs";
import { PreviewTaskStore } from "./task-store.mjs";
import { createPreviewActions } from "./task-actions.mjs";

installThemeControl();

const store = new PreviewTaskStore();
const app = {
	metadataCache: { fileToLinktext: (file) => file.path.replace(/\.md$/, "") },
	vault: {
		getMarkdownFiles: () =>
			[...new Set(store.tasks.map((task) => task.path))].map((path) => new TFile(path)),
		getAbstractFileByPath: (path) => new TFile(path),
	},
};
let view;
const actions = createPreviewActions(app, store, () => view.render());
view = new TaskLoopsView({ app }, actions);
await view.onOpen();
actions.refreshViews = () => view.render();
document.getElementById("settings").onclick = () => {
	const modal = new Modal(app);
	modal.onOpen = () => {
		modal.contentEl.createEl("h2", { text: "TaskLoops settings" });
		const tab = new TaskLoopsSettingTab(app, actions);
		tab.containerEl = modal.contentEl.createDiv("tl-preview-settings");
		tab.display();
		modal.contentEl.createEl("button", { text: "Close settings" }).onclick = () => modal.close();
	};
	modal.open();
};

document.getElementById("reset").onclick = () => {
	store.reset();
	location.reload();
};
window.addEventListener(
	"unhandledrejection",
	(event) => new Notice("Preview error: " + String(event.reason)),
);
