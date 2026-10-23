import type { ScannedTask, TaskLoopsSettings } from "../../core/types";

export function priorityBadge(parent: HTMLElement, task: ScannedTask, settings: TaskLoopsSettings): void {
	if (!task.priority) return;
	const priority = settings.priorities?.find((item) => item.id === task.priority);
	const badge = parent.createSpan({ cls: "tl-priority-badge", text: priority?.name ?? task.priority });
	badge.style.setProperty("--priority-color", priority?.color ?? "#777777");
	badge.setAttribute("aria-label", "Priority: " + (priority?.name ?? task.priority));
}

export function projectAccent(element: HTMLElement, path: string, settings: TaskLoopsSettings): void {
	const color = settings.projectColors?.[path];
	if (color) {
		element.classList.add("tl-project-colored");
		element.style.setProperty("--project-color", color);
	}
}

/** Keep calendar text readable for both light and dark user-selected colors. */
export function projectTextColor(color?: string): string | undefined {
	if (!color) return undefined;
	const rgb = [1, 3, 5]
		.map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
		.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
	const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
	return luminance > 0.179 ? "#000000" : "#ffffff";
}
