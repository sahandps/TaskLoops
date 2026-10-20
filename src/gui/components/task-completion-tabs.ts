import { completionView } from "../../core/task-completion-view";
import type { ScannedTask } from "../../core/types";
import type { TaskViewState } from "../views/view-state";

/** Keep completed-only notes out of the active work list. Counts include subtasks. */
export function renderTaskCompletionTabs(
	root: HTMLElement,
	tasks: ScannedTask[],
	state: TaskViewState,
	onChange: () => void,
): ScannedTask[] {
	const view = completionView(tasks, state.completionTab);
	if (!tasks.length) return view.tasks;
	const tabs = root.createDiv({
		cls: "tl-completion-tabs",
		attr: { role: "group", "aria-label": "Task completion" },
	});
	for (const [key, label] of [
		["open", "Unfinished"],
		["completed", "Completed"],
	] as const) {
		const count = view[key].length;
		const button = tabs.createEl("button", {
			text: `${label} ${count}`,
			attr: { "aria-pressed": String(view.selected === key), "data-completion-tab": key },
		});
		button.disabled = count === 0;
		button.onclick = () => {
			state.completionTab = key;
			const scope = root.closest(".tl-view");
			const list = scope?.querySelector<HTMLElement>(".tl-task-list, .tl-notes-pane");
			if (list) list.scrollTop = 0;
			onChange();
			// Render replaces the list controls; retain keyboard focus on the chosen tab.
			scope?.querySelector<HTMLButtonElement>(`[data-completion-tab="${key}"]`)?.focus();
		};
	}
	return view.tasks;
}
