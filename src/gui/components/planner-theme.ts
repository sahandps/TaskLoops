import type { PlannerTheme } from "../../core/types";

/** Theme only this planner/dialog; never mutate Obsidian's body or other views. */
export function applyPlannerTheme(root: HTMLElement, theme?: PlannerTheme): void {
	if (theme === "light" || theme === "dark") root.setAttribute("data-tl-theme", theme);
	else root.removeAttribute("data-tl-theme");
}
