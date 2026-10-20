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
				contents: localOnlyCalendar(await readFile(args.path, "utf8")),
				loader: "js",
			}));
		},
	};
}
