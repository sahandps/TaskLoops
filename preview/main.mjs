import { TaskLoopsView } from "../src/gui/views/taskloops-view.ts";
import { TFile, Notice } from "./obsidian.mjs";
import { PreviewTaskStore } from "./task-store.mjs";
import { createPreviewActions } from "./task-actions.mjs";

const store = new PreviewTaskStore();
const app = {
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

document.getElementById("reset").onclick = () => {
	store.reset();
	location.reload();
};
window.addEventListener(
	"unhandledrejection",
	(event) => new Notice("Preview error: " + String(event.reason)),
);
