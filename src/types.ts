export type TaskSource = "checkboxes" | "tagged" | "both";
export type CalendarScale = "day" | "week" | "month" | "year";
export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "DD.MM.YYYY" | "YYYY/MM/DD" | "YYYY.MM.DD" | "YYYYMMDD" | "DD-MM-YYYY" | "D/M/YYYY" | "D.M.YYYY" | "D-M-YYYY" | "D MMM YYYY" | "DD MMM YYYY" | "D MMMM YYYY" | "MMM D, YYYY" | "MMMM D, YYYY";

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
	defaultView: "planner" | "notes";
	timeFormat: "24h" | "12h";
	weekStart: number;
	startHour: number;
	defaultDuration: number;
	showCompleted: boolean;
	noteDensity: "comfortable" | "compact";
	notePreviewLimit: number;
	scanFolder: string;
	standaloneNote: string;
	dateFormat: DateFormat;
	lastScale: CalendarScale;
}

export const DEFAULT_SETTINGS: TaskLoopsSettings = {
	defaultView: "planner",
	timeFormat: "24h",
	weekStart: 1,
	startHour: 8,
	defaultDuration: 30,
	showCompleted: false,
	noteDensity: "comfortable",
	notePreviewLimit: 5,
	scanFolder: "",
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
