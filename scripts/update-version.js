import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = Date.now().toString();

// Read existing semver so it is preserved across timestamp-only updates
let semver = "1.0.0";
const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");
try {
  const existing = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (existing.semver) semver = existing.semver;
} catch {}

fs.writeFileSync(manifestPath, JSON.stringify({ version, semver }, null, 2));

const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");
fs.writeFileSync(
  buildVersionPath,
  `export const BUILD_VERSION = "${version}";\nexport const APP_SEMVER = "${semver}";\n`
);

console.log(`✅ Build version set to: ${version} (v${semver})`);
