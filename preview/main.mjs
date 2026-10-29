import { renderDailyCalendar } from "../src/gui/components/daily-calendar.ts";
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
const dailyDates = new Set(JSON.parse(window.localStorage.getItem("taskloops-preview-daily-notes") || "[]"));
let redrawDaily;
const saveDaily = (date) => {
	dailyDates.add(date);
	window.localStorage.setItem("taskloops-preview-daily-notes", JSON.stringify([...dailyDates]));
	redrawDaily?.();
};
let view;
const actions = createPreviewActions(app, store, () => view.render());
actions.dailyNotes = {
	enabled: true,
	path: (date) => `Daily/${date}.md`,
	exists: (date) => dailyDates.has(date) || store.tasks.some((task) => task.path === `Daily/${date}.md`),
	open: async (date) => {
		saveDaily(date);
		return actions.openNote(`Daily/${date}.md`);
	},
	createTask: async (date, text, schedule, reason) => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
		saveDaily(date);
		return actions.createTask(text, `Daily/${date}.md`, schedule, reason);
	},
};
redrawDaily = renderDailyCalendar(document.getElementById("daily-calendar"), actions);
view = new TaskLoopsView({ app }, actions);
await view.onOpen();
const previewLayout = document.querySelector(".preview-layout");
const previewApp = document.getElementById("app");
const syncPreviewEditor = () => {
	if (!previewApp || !previewLayout) return;
	const docked = previewApp.classList.contains("tl-editor-docked");
	const page = previewApp.classList.contains("tl-editor-page");
	previewLayout.classList.toggle("preview-editor-open", docked || page);
	previewLayout.classList.toggle("preview-editor-page", page);
	document.body.classList.toggle("preview-editor-page", page);
};
if (previewApp)
	new MutationObserver(syncPreviewEditor).observe(previewApp, {
		attributes: true,
		attributeFilter: ["class"],
	});
actions.refreshViews = () => {
	view.render();
	redrawDaily?.();
};
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
