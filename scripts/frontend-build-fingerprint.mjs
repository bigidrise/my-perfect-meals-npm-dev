import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "buffer" },
).toString("utf8").split("\0").filter(Boolean);

const rootInputs = new Set([
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
]);

function isFrontendInput(file) {
  return (
    file.startsWith("client/src/") ||
    file.startsWith("client/public/") ||
    file.startsWith("shared/") ||
    file.startsWith("config/") ||
    (file.startsWith("client/") && !file.slice(7).includes("/")) ||
    rootInputs.has(file)
  );
}

export function calculateFrontendFingerprint() {
  const hash = createHash("sha256");

  for (const file of tracked.filter(isFrontendInput).sort()) {
    hash.update(file);
    hash.update("\0");

    if (!existsSync(file)) {
      hash.update("MISSING");
    } else {
      hash.update(readFileSync(file));
    }

    hash.update("\0");
  }

  return hash.digest("hex");
}

if (process.argv[1]?.endsWith("frontend-build-fingerprint.mjs")) {
  console.log(calculateFrontendFingerprint());
}
