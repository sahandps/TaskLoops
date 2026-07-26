/**
 * Copy the built plugin into an Obsidian vault.
 *
 * The source lives outside the vault, so the vault only ever receives the three
 * files Obsidian actually loads. data.json is never touched — that is your
 * sorting state and it belongs to the vault, not to this repo.
 */
import { copyFile, mkdir, access, readFile } from "fs/promises";
import { join } from "path";
import process from "process";

const HINT = [
	"Point this at your vault, either with an environment variable:",
	"  OBSIDIAN_VAULT='/path/to/vault' npm run deploy",
	"or by writing the path once into a .vault-path file (gitignored):",
	"  echo '/path/to/vault' > .vault-path",
].join("\n");

/** Read the vault path from the environment, else from a local, untracked file. */
async function resolveVault() {
	if (process.env.OBSIDIAN_VAULT) return process.env.OBSIDIAN_VAULT.trim();
	try {
		const file = await readFile(".vault-path", "utf8");
		if (file.trim()) return file.trim();
	} catch {
		// Falls through to the error below.
	}
	return null;
}

const vault = await resolveVault();

if (!vault) {
	console.error("No vault configured.\n");
	console.error(HINT);
	process.exit(1);
}

/*
 * A vault's config folder is usually .obsidian but the user can rename it.
 * Running outside Obsidian there is no Vault#configDir to ask, so allow it to
 * be named explicitly.
 */
const configDir = process.env.OBSIDIAN_CONFIG_DIR || ".obsidian";
const target = join(vault, configDir, "plugins", "taskloops");
const files = ["main.js", "manifest.json", "styles.css"];

try {
	await access(join(vault, configDir));
} catch {
	console.error(`No ${configDir} folder at:\n  ${vault}\n`);
	console.error(HINT);
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
