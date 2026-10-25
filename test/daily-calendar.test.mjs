import { setImmediate } from "node:timers/promises";
import { createSuite } from "./harness.mjs";

export default async function run({ renderDailyCalendar, normalizeSettings, todayISO }) {
	const { eq, results } = createSuite("independent daily calendar preferences");
	const settings = normalizeSettings({ weekStart: 6, showWeekNumbers: false });
	eq(settings.dailyCalendarWeekStart, 6, "first upgrade keeps previous sidebar week start");
	eq(settings.dailyCalendarShowWeekNumbers, false, "first upgrade keeps previous week-number choice");
	const independent = normalizeSettings({
		weekStart: 1,
		showWeekNumbers: true,
		dailyCalendarWeekStart: 0,
		dailyCalendarShowWeekNumbers: false,
	});
	eq(
		[
			independent.weekStart,
			independent.dailyCalendarWeekStart,
			independent.showWeekNumbers,
			independent.dailyCalendarShowWeekNumbers,
		],
		[1, 0, true, false],
		"sidebar preferences are independent from planner",
	);
	const invalid = normalizeSettings({
		dailyCalendarWeekStart: 9,
		dailyCalendarShowWeekNumbers: "yes",
		dailyCalendarHighlightWeekends: null,
		dailyCalendarShowNoteDots: "no",
	});
	eq(
		[
			invalid.dailyCalendarWeekStart,
			invalid.dailyCalendarShowWeekNumbers,
			invalid.dailyCalendarHighlightWeekends,
			invalid.dailyCalendarShowNoteDots,
		],
		[1, true, true, true],
		"invalid persisted preferences normalized",
	);
	class Element {
		children = [];
		classes = new Set();
		attrs = {};
		constructor(tag = "div", options = {}) {
			this.tag = tag;
			this.text = options.text;
			if (options.cls) this.classes.add(options.cls);
			this.attrs = options.attr ?? {};
		}
		empty() {
			this.children = [];
		}
		addClass(name) {
			this.classes.add(name);
		}
		classList = {
			toggle: (name, on) => {
				if (on) this.classes.add(name);
				else this.classes.delete(name);
			},
		};
		setAttribute(name, value) {
			this.attrs[name] = value;
		}
		createEl(tag, options) {
			const node = new Element(tag, options);
			this.children.push(node);
			return node;
		}
		createDiv(cls) {
			return this.createEl("div", { cls });
		}
		createSpan(options) {
			return this.createEl("span", options);
		}
	}
	const all = (root) => [root, ...root.children.flatMap(all)];
	const find = (root, cls) => all(root).filter((node) => node.classes.has(cls));
	const root = new Element();
	const opened = [];
	const actions = {
		settings: normalizeSettings(),
		dailyNotes: {
			enabled: true,
			exists: (day) => day === todayISO(),
			open: async (day) => {
				opened.push(day);
				return true;
			},
		},
	};
	const redraw = renderDailyCalendar(root, actions);
	eq(find(root, "tl-daily-day").length, 42, "six complete weeks rendered");
	eq(find(root, "tl-daily-week-number").length, 6, "week numbers visible");
	eq(find(root, "tl-daily-note-dot").length, 1, "existing daily note gets a dot");
	eq(find(root, "is-weekend").length, 12, "Saturday and Sunday shading");
	eq(
		all(root).some((node) => node.tag === "small"),
		false,
		"no explanation below calendar",
	);
	actions.settings.dailyCalendarShowWeekNumbers = false;
	actions.settings.dailyCalendarWeekStart = 0;
	actions.settings.dailyCalendarHighlightWeekends = false;
	actions.settings.dailyCalendarShowNoteDots = false;
	redraw();
	eq(find(root, "tl-daily-week-number").length, 0, "week numbers can be hidden");
	eq(find(root, "tl-daily-weekday").length, 7, "weekday labels stay visible with week numbers hidden");
	eq(
		find(root, "tl-daily-calendar-grid")[0].classes.has("has-week-numbers"),
		false,
		"hidden week column removed from grid layout",
	);
	eq(
		new Date(find(root, "tl-daily-day")[0].attrs["aria-label"].slice(0, 10) + "T12:00:00").getDay(),
		0,
		"Sunday week start applied",
	);
	eq(find(root, "is-weekend").length, 0, "weekend shading can be disabled");
	eq(find(root, "tl-daily-note-dot").length, 0, "note dots can be disabled");
	const today = find(root, "tl-daily-day").find((node) => node.attrs["aria-label"].startsWith(todayISO()));
	today.onclick();
	await setImmediate();
	eq(opened, [todayISO()], "opening daily notes still works with visual markers disabled");
	eq(actions.settings.weekStart, 1, "sidebar changes leave planner week start alone");
	return results;
}
