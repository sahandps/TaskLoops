import esbuild from "esbuild";
import { buildStyles } from "./styles.mjs";
import { resolve } from "node:path";
buildStyles();
const context = await esbuild.context({
	entryPoints: ["preview/main.mjs"],
	bundle: true,
	format: "esm",
	outfile: "preview/app.js",
	sourcemap: true,
	alias: { obsidian: resolve("preview/obsidian.mjs") },
	logLevel: "info",
});
await context.watch();
await context.serve({ servedir: ".", host: "127.0.0.1", port: 5173 });
console.log("TaskLoops preview: http://127.0.0.1:5173/preview/");
