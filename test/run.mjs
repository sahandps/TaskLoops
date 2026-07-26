/**
 * Bundles scanner.ts against a stubbed `obsidian` module, then runs every
 * *.test.mjs beside this file. The scanner is where the risky logic lives —
 * finding task lines, deriving identity, and the single write transform — so
 * that is what gets covered.
 */
import esbuild from "esbuild";
import { readdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const bundle = join(here, ".bundle.mjs");

await esbuild.build({
	entryPoints: [join(root, "src", "scanner.ts")],
	bundle: true,
	format: "esm",
	outfile: bundle,
	alias: { obsidian: join(here, "obsidian-stub.mjs") },
	logLevel: "error",
});

/**
 * A dynamic import is untyped by default, which makes every call through it an
 * unsafe call. Naming the shapes keeps the runner type-clean.
 *
 * @typedef {Record<string, (...args: never[]) => unknown>} ScannerModule
 * @typedef {{ name: string, pass: number, fail: number, failures: string[] }} SuiteResult
 * @typedef {{ default: (mod: ScannerModule) => SuiteResult }} Suite
 */

/** @type {ScannerModule} */
const mod = await import(pathToFileURL(bundle).href + "?t=" + Date.now());

const files = (await readdir(here)).filter((f) => f.endsWith(".test.mjs")).sort();

let pass = 0;
let fail = 0;

for (const file of files) {
	/** @type {Suite} */
	const suite = await import(pathToFileURL(join(here, file)).href);
	const result = suite.default(mod);
	pass += result.pass;
	fail += result.fail;

	const status = result.fail === 0 ? "ok  " : "FAIL";
	console.log(`${status} ${result.name}: ${result.pass} passed, ${result.fail} failed`);
	for (const failure of result.failures) console.log(`  ✗ ${failure}`);
}

console.log(`\n${pass} passed, ${fail} failed across ${files.length} suites`);
process.exit(fail === 0 ? 0 : 1);
