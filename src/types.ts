export type TaskSource = "checkboxes" | "tagged" | "both";
export type CalendarScale = "day" | "week" | "month" | "year";
export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "DD.MM.YYYY" | "YYYY/MM/DD";

export interface Schedule {
	/** Calendar day, always ISO internally. */
	due?: string;
	/** Local start time, HH:mm. */
	time?: string;
	/** Positive whole minutes. */
	duration?: number;
}

export interface ScannedTask extends Schedule {
	id: string;
	path: string;
	line: number;
	raw: string;
	text: string;
	indent: number;
	parentId?: string;
	handled: boolean;
	checkbox: boolean;
	checked: boolean;
	/** Explicit fields in Markdown take precedence over legacy saved dates. */
	hasSchedule?: boolean;
}

export interface TaskLoopsSettings {
	standaloneNote: string;
	dateFormat: DateFormat;
	lastScale: CalendarScale;
}

export const DEFAULT_SETTINGS: TaskLoopsSettings = {
	standaloneNote: "Standalone Tasks.md",
	dateFormat: "YYYY-MM-DD",
	lastScale: "week",
};

export interface LegacyItem {
	id: string;
	path: string;
	text: string;
	line?: number;
	due?: string;
	[key: string]: unknown;
}

export interface TaskLoopsData {
	settings: TaskLoopsSettings;
	/** Retained for upgrades; never rewritten into notes automatically. */
	items: Record<string, LegacyItem>;
}
