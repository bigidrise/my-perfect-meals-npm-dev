#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const baselinePath = path.resolve("scripts/release-typecheck-baseline.json");
const tscPath = path.resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
);

function fail(message, output = "") {
  console.error(`\nRelease typecheck failed: ${message}`);
  if (output) {
    console.error("\nTypeScript output:");
    console.error(output.trim().split("\n").slice(0, 80).join("\n"));
  }
  process.exit(1);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch (error) {
  fail(
    `could not read ${path.relative(process.cwd(), baselinePath)}. ` +
      "Restore the reviewed baseline before releasing.",
    error instanceof Error ? error.message : String(error),
  );
}

if (
  !Number.isInteger(baseline.diagnosticCount) ||
  typeof baseline.diagnosticsSha256 !== "string"
) {
  fail("the reviewed typecheck baseline is malformed.");
}

const result = spawnSync(
  tscPath,
  ["--pretty", "false", "--incremental", "false", "--project", "tsconfig.json"],
  { encoding: "utf8" },
);

if (result.error) {
  fail("could not run the root TypeScript check.", result.error.message);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const diagnostics = [
  ...output.matchAll(/^(.+?\(\d+,\d+\): error TS\d+: .+)$/gm),
].map((match) => match[1]).sort();

if (result.status !== 0 && diagnostics.length === 0) {
  fail(`TypeScript exited with status ${result.status}.`, output);
}

if (diagnostics.length === 0) {
  console.log("Root strict TypeScript check is clean.");
  process.exit(0);
}

const fingerprint = createHash("sha256")
  .update(diagnostics.join("\n"))
  .digest("hex");

if (
  diagnostics.length !== baseline.diagnosticCount ||
  fingerprint !== baseline.diagnosticsSha256
) {
  fail(
    `diagnostic set changed from the reviewed baseline ` +
      `(${baseline.diagnosticCount} / ${baseline.diagnosticsSha256}) to ` +
      `(${diagnostics.length} / ${fingerprint}). ` +
      "Resolve the new diagnostics, or deliberately refresh the baseline after " +
      "reviewing a focused debt-reduction change.",
    output,
  );
}

console.log(
  `Root strict TypeScript debt matches the reviewed baseline ` +
    `(${diagnostics.length} diagnostics).`,
);