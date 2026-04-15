import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const version = Date.now().toString();

const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify({ version }, null, 2));

const buildVersionPath = path.join(__dirname, "../client/src/buildVersion.ts");
fs.writeFileSync(buildVersionPath, `export const BUILD_VERSION = "${version}";\n`);

console.log("✅ Build version set to:", version);
