import { createSampleTasks } from "./sample-data.mjs";

const STORAGE_KEY = "taskloops-preview-v1";

/** Keeps preview persistence separate from GUI rendering and task operations. */
export class PreviewTaskStore {
	constructor() {
		this.tasks = this.load() ?? createSampleTasks();
	}
	load() {
		try {
			return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) ?? null;
		} catch {
			return null;
		}
	}
	save() {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
	}
	reset() {
		window.localStorage.removeItem(STORAGE_KEY);
	}
}
