import { slotHeight } from "./calendar-zoom";
import { DEFAULT_SETTINGS, type TaskLoopsSettings } from "./types";
import { DATE_FORMATS } from "./schedule";

/** Validate persisted settings without involving plugin lifecycle or GUI code. */
export function normalizeSettings(saved?: Partial<TaskLoopsSettings>): TaskLoopsSettings {
	const settings = { ...DEFAULT_SETTINGS, ...saved };
	if (settings.standaloneDestination !== "daily") settings.standaloneDestination = "note";
	const validColor = (color: unknown): color is string =>
		typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
	const ids = new Set<string>();
	settings.priorities = (Array.isArray(saved?.priorities) ? saved.priorities : DEFAULT_SETTINGS.priorities)
		.filter((item) => {
			if (
				!item ||
				typeof item.id !== "string" ||
				!/^[a-zA-Z0-9_-]+$/.test(item.id) ||
				ids.has(item.id) ||
				typeof item.name !== "string" ||
				!item.name.trim() ||
				!validColor(item.color)
			)
				return false;
			ids.add(item.id);
			return true;
		})
		.map((item) => ({ id: item.id, name: item.name.trim(), color: item.color }));
	settings.projectColors = Object.fromEntries(
		Object.entries(
			saved?.projectColors && typeof saved.projectColors === "object" ? saved.projectColors : {},
		).filter(([, color]) => validColor(color)),
	);
	settings.timeSlotHeight = slotHeight(settings.timeSlotHeight);
	if (!["inherit", "light", "dark"].includes(settings.theme)) settings.theme = "inherit";
	if (typeof settings.showWeekNumbers !== "boolean") settings.showWeekNumbers = true;
	if (typeof settings.showProgressBars !== "boolean") settings.showProgressBars = true;
	if (!DATE_FORMATS.includes(settings.dateFormat)) settings.dateFormat = DEFAULT_SETTINGS.dateFormat;
	if (!["day", "week", "month", "year", "timeline", "gantt"].includes(settings.lastScale))
		settings.lastScale = "week";
	if (!["planner", "notes", "today"].includes(settings.defaultView)) settings.defaultView = "planner";
	if (![3, 5, 10].includes(settings.notePreviewLimit)) settings.notePreviewLimit = 5;
	if (typeof settings.scanFolder !== "string") settings.scanFolder = "";
	if (!Number.isFinite(settings.panelWidth)) settings.panelWidth = 260;
	if (!Number.isFinite(settings.panelHeight)) settings.panelHeight = 220;
	if (!["12h", "24h"].includes(settings.timeFormat)) settings.timeFormat = "24h";
	if (![0, 1, 6].includes(settings.weekStart)) settings.weekStart = 1;
	if (!Number.isInteger(settings.startHour) || settings.startHour < 0 || settings.startHour > 23)
		settings.startHour = 8;
	if (![5, 15, 30, 45, 60, 90, 120].includes(settings.defaultDuration)) settings.defaultDuration = 30;
	if (typeof settings.showCompleted !== "boolean") settings.showCompleted = false;
	if (!["compact", "comfortable"].includes(settings.noteDensity)) settings.noteDensity = "comfortable";
	if (![0, 1, 6].includes(settings.dailyCalendarWeekStart)) settings.dailyCalendarWeekStart = 1;
	if (saved?.dailyCalendarWeekStart === undefined) settings.dailyCalendarWeekStart = settings.weekStart;
	if (typeof settings.dailyCalendarShowWeekNumbers !== "boolean")
		settings.dailyCalendarShowWeekNumbers = true;
	if (saved?.dailyCalendarShowWeekNumbers === undefined)
		settings.dailyCalendarShowWeekNumbers = settings.showWeekNumbers;
	if (typeof settings.dailyCalendarHighlightWeekends !== "boolean")
		settings.dailyCalendarHighlightWeekends = true;
	if (typeof settings.dailyCalendarShowNoteDots !== "boolean") settings.dailyCalendarShowNoteDots = true;
	return settings;
}
