import type { TaskProgress } from "../../core/task-progress";

/** A read-only summary; there is no progress store or note/property write. */
export function renderTaskProgress(root: HTMLElement, path: string, value?: TaskProgress): void {
	const { total, completed, percent } = value ?? { total: 0, completed: 0, percent: 0 };
	const progress = root.createDiv({
		cls: "tl-task-progress",
		attr: {
			title: "All checkbox tasks in this note, including every subtask. Independent of list filters.",
		},
	});
	const summary = progress.createDiv("tl-progress-summary");
	summary.createSpan({ text: `${completed} / ${total} complete`, cls: "tl-progress-count" });
	summary.createSpan({ text: percent + "%", cls: "tl-progress-percent" });
	progress.createEl("progress", {
		attr: {
			max: String(Math.max(1, total)),
			value: String(completed),
			"aria-label": "Task progress in " + path,
			"aria-valuetext": `${completed} of ${total} tasks complete (${percent}%). Includes subtasks.`,
		},
	});
}
