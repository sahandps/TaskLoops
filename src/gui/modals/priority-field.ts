import type { TaskLoopsSettings } from "../../core/types";

export function priorityField(parent: HTMLElement, settings: TaskLoopsSettings, initial = ""): () => string {
	const label = parent.createEl("label", { cls: "tl-priority-field" });
	label.createSpan({ text: "Priority" });
	const select = label.createEl("select", { attr: { "aria-label": "Priority" } });
	select.createEl("option", { value: "", text: "No priority" });
	for (const priority of settings.priorities)
		select.createEl("option", { value: priority.id, text: priority.name });
	if (initial && !settings.priorities.some((item) => item.id === initial))
		select.createEl("option", { value: initial, text: initial + " (archived)" });
	select.value = initial;
	return () => select.value;
}
