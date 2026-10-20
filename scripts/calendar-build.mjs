import ts from "typescript";
import { readFile } from "node:fs/promises";

/** Remove the unused remote-feed transport rather than bundling outbound requests. */
export function localOnlyCalendar(source) {
	const ast = ts.createSourceFile("calendar.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
	const calls = [];
	const walk = (node) => {
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "fetch")
			calls.push({ start: node.getStart(ast), end: node.end });
		ts.forEachChild(node, walk);
	};
	walk(ast);
	if (calls.length !== 1)
		throw new Error(
			"Review EventCalendar transport before upgrading: expected exactly one remote-feed request.",
		);
	const { start, end } = calls[0];
	return (
		source.slice(0, start) +
		'Promise.reject(new Error("Remote calendar feeds are disabled in TaskLoops."))' +
		source.slice(end)
	);
}

/** A pinned build-time adaptation shared by production, preview and tests. */
export function localCalendarPlugin() {
	return {
		name: "taskloops-local-calendar",
		setup(build) {
			build.onLoad({ filter: /@event-calendar[\\/]core[\\/]dist[\\/]index\.js$/ }, async (args) => ({
				contents: crossGridCalendar(localOnlyCalendar(await readFile(args.path, "utf8"))),
				loader: "js",
			}));
		},
	};
}

/** Enable cross-grid dragging for TaskLoops events in the pinned 5.17.2 adapter. */
export function crossGridCalendar(source) {
	const replace = (before, after) => {
		if (source.split(before).length !== 2)
			throw new Error(
				"Review EventCalendar cross-grid dragging before upgrading: adapter shape changed.",
			);
		source = source.replace(before, after);
	};
	replace(
		"if (newAllDay === allDay) {",
		`const crossGrid = action === ACTION_DRAG && Number.isFinite(event.extendedProps?.taskloopsTimedMinutes);
				if (newAllDay === allDay || crossGrid) {`,
	);
	replace(
		"let candidate = copyIEventData({}, iEvent);",
		"let candidate = copyIEventData({}, iEvent);\n\t\t\t\t\tcandidate.allDay = crossGrid ? newAllDay : event.allDay;",
	);
	replace(
		"\t\t\t\t\trefused = false;",
		`					if (crossGrid && newAllDay !== allDay) {
						candidate.start = cloneDate(newDate);
						candidate.end = newAllDay
							? addDay(setMidnight(cloneDate(newDate)))
							: addDuration(cloneDate(newDate), createDuration({minutes: event.extendedProps.taskloopsTimedMinutes}));
					}
					refused = false;`,
	);
	replace(
		"function copyIEventData(target, source) {",
		"function copyIEventData(target, source) {\n\t\ttarget.allDay = source.allDay;",
	);
	replace(
		"function findDayEl() {",
		`function findDayEl() {
		if (action === ACTION_DRAG && Number.isFinite(event.extendedProps?.taskloopsTimedMinutes)) {
			const direct = getElementWithPayload(toX, toY);
			if (direct && $.get(mainEl).contains(direct)) return direct;
		}`,
	);
	replace(
		"if (!allDaySlot) {",
		"if (!allDaySlot || (action === ACTION_DRAG && Number.isFinite(event.extendedProps?.taskloopsTimedMinutes))) {",
	);
	// Extend only the vertical drag viewport; selection and resize keep their original grid limits.
	const viewportEnd = "\n\t}\n\tfunction createIEvent(jsEvent, callback) {";
	replace(
		viewportEnd,
		`
		if (action === ACTION_DRAG && Number.isFinite(event.extendedProps?.taskloopsTimedMinutes)) {
			viewport.top = max(0, mainRect.top);
			viewport.bottom = min(document.documentElement.clientHeight, mainRect.bottom) - 2;
		}
	}
	function createIEvent(jsEvent, callback) {`,
	);
	return source;
}
