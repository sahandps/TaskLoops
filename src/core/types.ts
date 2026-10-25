export type TaskSource = "checkboxes" | "tagged" | "both";
export type CalendarScale = "day" | "week" | "month" | "year" | "timeline" | "gantt";
export type DateFormat =
	| "YYYY-MM-DD"
	| "DD/MM/YYYY"
	| "DD.MM.YYYY"
	| "YYYY/MM/DD"
	| "YYYY.MM.DD"
	| "YYYYMMDD"
	| "DD-MM-YYYY"
	| "D/M/YYYY"
	| "D.M.YYYY"
	| "D-M-YYYY"
	| "D MMM YYYY"
	| "DD MMM YYYY"
	| "D MMMM YYYY"
	| "MMM D, YYYY"
	| "MMMM D, YYYY";

export interface PriorityDefinition {
	id: string;
	name: string;
	color: string;
}

export interface Schedule {
	/** Stable priority ID; empty string explicitly clears it. */
	priority?: string;
	/** Optional calendar bar color; empty string restores the project color. */
	color?: string;
	/** Calendar day, always ISO internally. */
	due?: string;
	/** Inclusive final calendar day; must be on or after due. */
	deadline?: string;
	/** Local start time, HH:mm. */
	time?: string;
	/** Positive whole minutes. */
	duration?: number;
}

export interface TaskDeferral {
	reason: string;
	scheduledOn?: string;
	scheduledFor?: string;
}

export interface ScannedTask extends Schedule {
	deferral?: TaskDeferral;
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

export type PlannerTheme = "inherit" | "light" | "dark";

export interface TaskLoopsSettings {
	priorities: PriorityDefinition[];
	projectColors: Record<string, string>;
	theme: PlannerTheme;
	showWeekNumbers: boolean;
	showProgressBars: boolean;
	timeSlotHeight: number;
	defaultView: "planner" | "notes" | "today";
	timeFormat: "24h" | "12h";
	weekStart: number;
	dailyCalendarWeekStart: number;
	dailyCalendarShowWeekNumbers: boolean;
	dailyCalendarHighlightWeekends: boolean;
	dailyCalendarShowNoteDots: boolean;
	startHour: number;
	defaultDuration: number;
	showCompleted: boolean;
	noteDensity: "comfortable" | "compact";
	notePreviewLimit: number;
	scanFolder: string;
	panelWidth: number;
	panelHeight: number;
	standaloneNote: string;
	standaloneDestination: "note" | "daily";
	dateFormat: DateFormat;
	lastScale: CalendarScale;
}

export const DEFAULT_SETTINGS: TaskLoopsSettings = {
	priorities: [
		{ id: "low", name: "Low", color: "#397a56" },
		{ id: "medium", name: "Medium", color: "#a56b16" },
		{ id: "high", name: "High", color: "#bf4545" },
	],
	projectColors: {},
	theme: "inherit",
	showWeekNumbers: true,
	showProgressBars: true,
	timeSlotHeight: 24,
	defaultView: "planner",
	timeFormat: "24h",
	weekStart: 1,
	dailyCalendarWeekStart: 1,
	dailyCalendarShowWeekNumbers: true,
	dailyCalendarHighlightWeekends: true,
	dailyCalendarShowNoteDots: true,
	startHour: 8,
	defaultDuration: 30,
	showCompleted: false,
	noteDensity: "comfortable",
	notePreviewLimit: 5,
	scanFolder: "",
	panelWidth: 260,
	panelHeight: 220,
	standaloneNote: "Standalone Tasks.md",
	standaloneDestination: "note",
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
