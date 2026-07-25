/**
 * Keeps manifest.json and versions.json in step with package.json.
 *
 * Runs automatically as part of `npm version`, which is the supported way to
 * cut a release: the new version lands in the manifest, and versions.json gains
 * a row mapping it to the minimum Obsidian version it needs, so older Obsidian
 * installs keep resolving to a release they can actually run.
 */
import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

if (!targetVersion) {
	console.error("No npm_package_version — run this via `npm version`.");
	process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Set version ${targetVersion} (requires Obsidian ${minAppVersion}).`);
