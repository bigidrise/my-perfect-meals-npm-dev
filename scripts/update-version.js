/**
 * update-version.js
 *
 * Runs as the first step of `npm run build` (and therefore every Replit deployment).
 *
 * ONLY updates the `version` field (a timestamp used for cache-busting / deployment detection).
 * Never touches `releaseId` or `notes` — those are owned by cut-release.js and only change
 * when a developer intentionally publishes a customer-facing release.
 *
 * This separation means:
 *   • Routine deploy  → new `version`, same `releaseId`/`notes` → no new customer banner
 *   • Customer release → run cut-release.js first → new `releaseId` + notes → banner appears once
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = Date.now().toString();

const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");
const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");

// Read the full existing manifest so we preserve every field we don't own.
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
} catch {
  // No manifest yet — start from scratch; cut-release.js will add releaseId + notes.
}

// Merge: only the version field changes.
const updated = { ...existing, version };

fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");
fs.writeFileSync(buildVersionPath, `export const BUILD_VERSION = "${version}";\n`);

console.log("✅ Build version set to:", version);
if (updated.releaseId) {
  console.log("   Release ID preserved:", updated.releaseId);
  console.log("   Release notes preserved:", (updated.notes ?? []).length, "item(s)");
} else {
  console.log("   ⚠️  No releaseId in manifest — run scripts/cut-release.js before the first customer release.");
}
