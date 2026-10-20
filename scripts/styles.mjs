import { readFileSync, writeFileSync } from "node:fs";

/** Both the plugin build and browser preview use the same stylesheet sources. */
export function buildStyles() {
	const sources = [
		"node_modules/@event-calendar/core/dist/index.css",
		"node_modules/frappe-gantt/dist/frappe-gantt.css",
		"src/gui/styles.css",
	];
	writeFileSync("styles.css", sources.map((path) => readFileSync(path, "utf8")).join("\n"));
}
