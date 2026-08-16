import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = Date.now().toString();

const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");

// Preserve existing notes so they survive the build stamp.
// Only the version field is updated; everything else is kept.
let existingNotes = [];
try {
  const existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (Array.isArray(existing.notes)) existingNotes = existing.notes;
} catch {}

fs.writeFileSync(
  manifestPath,
  JSON.stringify({ version, notes: existingNotes }, null, 2)
);

const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");
fs.writeFileSync(buildVersionPath, `export const BUILD_VERSION = "${version}";\n`);

console.log("✅ Build version set to:", version);
