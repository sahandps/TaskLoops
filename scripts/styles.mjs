import { readFileSync, writeFileSync } from "node:fs";
import { scopeVendorStyles } from "./vendor-styles.mjs";

/** Shared, scoped vendor CSS followed by TaskLoops' theme-aware overrides. */
export function buildStyles() {
	const vendors = [
		"node_modules/@event-calendar/core/dist/index.css",
		"node_modules/frappe-gantt/dist/frappe-gantt.css",
	];
	const css = vendors.map((path) => scopeVendorStyles(readFileSync(path, "utf8")));
	css.push(readFileSync("src/gui/styles.css", "utf8"));
	writeFileSync("styles.css", css.join("\n"));
}
