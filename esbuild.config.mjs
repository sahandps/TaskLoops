import { localCalendarPlugin } from "./scripts/calendar-build.mjs";
import { buildStyles } from "./scripts/styles.mjs";
import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "module";
import { readFileSync } from "fs";

const prod = process.argv[2] === "production";
const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));

buildStyles();

const context = await esbuild.context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	plugins: [localCalendarPlugin()],
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtinModules,
	],
	format: "cjs",
	target: "es2018",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
	banner: {
		js: `/*! TaskLoops ${version} | Copyright (c) 2026 Sahand Poursadeghi Khiavi. GNU GPL v3 only (GPL-3.0-only), without warranty. License: https://github.com/sahandps/TaskLoops/blob/${version}/LICENSE */`,
	},
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
