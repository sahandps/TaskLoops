import { localCalendarPlugin } from "./calendar-build.mjs";
import esbuild from "esbuild";
import { buildStyles } from "./styles.mjs";
import { resolve } from "node:path";
buildStyles();
const context = await esbuild.context({
	entryPoints: ["preview/main.mjs"],
	bundle: true,
	plugins: [localCalendarPlugin()],
	format: "esm",
	outfile: "preview/app.js",
	sourcemap: true,
	alias: { obsidian: resolve("preview/obsidian.mjs") },
	logLevel: "info",
});
await context.watch();
const { host, port } = await context.serve({
	servedir: ".",
	host: "127.0.0.1",
	port: Number(process.env.TASKLOOPS_PREVIEW_PORT ?? 5173),
});
console.log(`TaskLoops preview: http://${host}:${port}/preview/`);
