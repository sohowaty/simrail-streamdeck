// Writes a release version into the plugin manifest and package.json.
// Usage: node scripts/set-version.mjs v1.2.3   (or 1.2.3, 1.2.3.4, v1.2.3-beta.1)
// Stream Deck wants four numeric parts, so 1.2.3 becomes 1.2.3.0 in the manifest.
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2] ?? "";
const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/.exec(input);
if (!match) {
	console.error(`Not a version tag: "${input}" (expected e.g. v1.2.3)`);
	process.exit(1);
}
const [, major, minor, patch, build = "0", pre] = match;
const manifestVersion = `${major}.${minor}.${patch}.${build}`;
const npmVersion = `${major}.${minor}.${patch}${pre ? `-${pre}` : ""}`;

function update(path, key, value) {
	const text = readFileSync(path, "utf8");
	const pattern = new RegExp(`("${key}"\\s*:\\s*")[^"]*(")`);
	if (!pattern.test(text)) throw new Error(`No "${key}" field in ${path}`);
	// Replace only the first (top-level) occurrence to keep the file's formatting.
	writeFileSync(path, text.replace(pattern, `$1${value}$2`));
	console.log(`${path}: ${key} = ${value}`);
}

update("com.simrailmqtt.streamdeck.sdPlugin/manifest.json", "Version", manifestVersion);
update("package.json", "version", npmVersion);
