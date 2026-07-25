/**
 * Copy the built plugin into an Obsidian vault.
 *
 * The source lives outside the vault, so the vault only ever receives the three
 * files Obsidian actually loads. data.json is never touched — that is your
 * sorting state and it belongs to the vault, not to this repo.
 */
import { copyFile, mkdir, access } from "fs/promises";
import { join } from "path";
import process from "process";

const DEFAULT_VAULT =
	process.env.HOME + "/Desktop/Test Vault/test";

const vault = process.env.OBSIDIAN_VAULT || DEFAULT_VAULT;
const target = join(vault, ".obsidian", "plugins", "taskloops");
const files = ["main.js", "manifest.json", "styles.css"];

try {
	await access(join(vault, ".obsidian"));
} catch {
	console.error(`No .obsidian folder at:\n  ${vault}\n`);
	console.error("Set the vault explicitly:");
	console.error("  OBSIDIAN_VAULT='/path/to/vault' npm run deploy");
	process.exit(1);
}

await mkdir(target, { recursive: true });

for (const file of files) {
	try {
		await copyFile(file, join(target, file));
	} catch (err) {
		console.error(`Could not copy ${file}: ${err.message}`);
		console.error("Run `npm run build` first.");
		process.exit(1);
	}
}

console.log(`Deployed ${files.length} files to:\n  ${target}`);
console.log("Reload the plugin in Obsidian to pick up the change.");
