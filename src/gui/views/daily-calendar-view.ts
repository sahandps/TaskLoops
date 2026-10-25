import { ItemView, WorkspaceLeaf } from "obsidian";
import type { TaskActions } from "../../application/task-actions";
import { renderDailyCalendar } from "../components/daily-calendar";
import { applyPlannerTheme } from "../components/planner-theme";

export const VIEW_TYPE_DAILY_CALENDAR = "taskloops-daily-calendar";

export class DailyCalendarView extends ItemView {
	private redraw?: () => void;
	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TaskActions,
	) {
		super(leaf);
	}
	getViewType(): string {
		return VIEW_TYPE_DAILY_CALENDAR;
	}
	getDisplayText(): string {
		return "Daily note calendar";
	}
	getIcon(): string {
		return "calendar";
	}
	onOpen(): Promise<void> {
		applyPlannerTheme(this.contentEl, this.plugin.settings.theme);
		this.redraw = renderDailyCalendar(this.contentEl, this.plugin);
		this.registerEvent(this.app.vault.on("create", () => this.redraw?.()));
		this.registerEvent(this.app.vault.on("delete", () => this.redraw?.()));
		this.registerEvent(this.app.vault.on("rename", () => this.redraw?.()));

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.redraw?.()));
		this.registerInterval(window.setInterval(() => this.redraw?.(), 60000));
		return Promise.resolve();
	}
	render(): void {
		applyPlannerTheme(this.contentEl, this.plugin.settings.theme);
		this.redraw?.();
	}
	onClose(): Promise<void> {
		this.redraw = undefined;
		this.contentEl.empty();
		return Promise.resolve();
	}
}
