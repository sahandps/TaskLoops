import type { TaskActions } from "../../application/task-actions";
import type { TaskViewState } from "../views/view-state";

export function renderViewHeader(
	root: HTMLElement,
	actions: TaskActions,
	state: TaskViewState,
	onChange: () => void,
): void {
	const header = root.createDiv("tl-header");
	header.createEl("h2", { text: "TaskLoops" });
	const views = header.createDiv({ cls: "tl-view-switch", attr: { "aria-label": "TaskLoops views" } });
	for (const [value, label] of [
		["planner", "Planner"],
		["notes", "Notes"],
	] as const) {
		const button = views.createEl("button", {
			text: label,
			attr: { "aria-pressed": String(state.mode === value) },
		});
		button.onclick = () => {
			state.mode = value;
			onChange();
		};
	}
	header.createEl("button", { text: "+ Task", cls: "mod-cta" }).onclick = () => actions.newTask();
	header.createEl("button", { text: "Refresh" }).onclick = () => void actions.rescan();
}
