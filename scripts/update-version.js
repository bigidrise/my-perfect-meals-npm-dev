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
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = Date.now().toString();

// ── Release identity fields injected at build time ─────────────────────────
// These travel with the built artifact so the deployed app can identify itself.
let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // Not a git repo or git unavailable — leave as "unknown"
}

const buildTimestamp = new Date().toISOString();
const environment = process.env.NODE_ENV || "development";
// The storage bucket bound to this deployment — travels with the manifest so
// /api/release can report it without hitting the DB or env at read time.
const storageBucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";

const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");
const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");

// Read the full existing manifest so we preserve every field we don't own.
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
} catch {
  // No manifest yet — start from scratch; cut-release.js will add releaseId + notes.
}

// Merge: version + release identity fields change; releaseId/notes are owned by cut-release.js.
const updated = { ...existing, version, gitSha, buildTimestamp, environment, storageBucketId };

fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");
fs.writeFileSync(buildVersionPath, `export const BUILD_VERSION = "${version}";\n`);

console.log("✅ Build version set to:", version);
console.log("   Git SHA         :", gitSha);
console.log("   Build timestamp :", buildTimestamp);
console.log("   Environment     :", environment);
console.log("   Storage bucket  :", storageBucketId || "(not set)");
if (updated.releaseId) {
  console.log("   Release ID preserved:", updated.releaseId);
  console.log("   Release notes preserved:", (updated.notes ?? []).length, "item(s)");
} else {
  console.log("   ⚠️  No releaseId in manifest — run scripts/cut-release.js before the first customer release.");
}
