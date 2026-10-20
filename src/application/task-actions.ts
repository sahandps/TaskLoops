import type { ScannedTask, Schedule, TaskLoopsSettings } from "../core/types";

/** UI-facing actions, shared by the Obsidian plugin and browser preview. */
export interface TaskActions {
	settings: TaskLoopsSettings;
	allTasks(): ScannedTask[];
	noteName(path: string): string;
	saveSettings(): Promise<void>;
	rescan(): Promise<void>;
	newTask(schedule?: Schedule, path?: string): void;
	schedule(task: ScannedTask, schedule: Schedule): Promise<void>;
	complete(task: ScannedTask): Promise<boolean>;
	reveal(task: ScannedTask): Promise<void>;
	openNote(path: string, line?: number): Promise<boolean>;
	deferTask(task: ScannedTask, reason: string): Promise<boolean>;
	createTask(text: string, path: string, schedule: Schedule, reason?: string): Promise<boolean>;
	editTask(
		task: ScannedTask,
		text: string,
		path: string,
		schedule: Schedule,
		subtasks?: string[],
		existing?: ScannedTask[],
		reason?: string,
	): Promise<boolean>;
}
