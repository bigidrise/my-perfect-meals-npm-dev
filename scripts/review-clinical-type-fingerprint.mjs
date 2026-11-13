/**
 * Read-only diagnostic comparison. Never changes the baseline or compiler.
 * Retains complete current and historical evidence in a temporary directory.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clinical-type-review-"));
const revision = execFileSync("git", ["log", "-1", "--format=%H", "--", "scripts/release-typecheck-baseline.json"], { encoding: "utf8" }).trim();
const reviewed = JSON.parse(execFileSync("git", ["show", `${revision}:scripts/release-typecheck-baseline.json`], { encoding: "utf8" }));
const paths = execFileSync("git", ["ls-tree", "-r", "--name-only", revision], { encoding: "utf8" }).split("\n")
  .filter(p => /^(client\/src\/|server\/|shared\/|scripts\/|config\/)/.test(p) || /^[^/]+\.(ts|json)$/.test(p) && p !== "package-lock.json");
const snapshot = path.join(dir, "reviewed");
fs.mkdirSync(snapshot);
const archive = spawnSync("git", ["archive", revision, ...paths], { maxBuffer: 150 * 1024 * 1024 });
if (archive.status !== 0) throw new Error(archive.stderr.toString());
const extract = spawnSync("tar", ["-x", "-C", snapshot], { input: archive.stdout });
if (extract.status !== 0) throw new Error(extract.stderr.toString());
fs.symlinkSync(path.join(root, "node_modules"), path.join(snapshot, "node_modules"), "dir");
fs.writeFileSync(path.join(snapshot, "client/src/buildVersion.ts"), 'export const BUILD_VERSION = "dev";\nexport const BUILD_RELEASE_ID = "dev";\n');
const tsc = path.join(root, "node_modules/typescript/bin/tsc");
const old = spawnSync(process.execPath, ["--max-old-space-size=4096", tsc, "--pretty", "false", "--incremental", "false", "-p", "tsconfig.json"],
  { cwd: snapshot, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const oldOutput = (old.stdout ?? "") + (old.stderr ?? "");
fs.writeFileSync(path.join(dir, "reviewed.txt"), oldOutput);
const diagnostics = text => [...text.matchAll(/^(.+?\(\d+,\d+\): error TS\d+: .+)$/gm)].map(m => m[1]).sort();
const hash = rows => createHash("sha256").update(rows.join("\n")).digest("hex");
const oldRows = diagnostics(oldOutput);
console.log(JSON.stringify({ evidence: dir, reviewedRevision: revision, historicalCount: oldRows.length, historicalHash: hash(oldRows), baseline: reviewed }, null, 2));
if (oldRows.length !== reviewed.diagnosticCount || hash(oldRows) !== reviewed.diagnosticsSha256) {
  throw new Error("Historical source did not reproduce the reviewed baseline. No equivalence or baseline change is authorized.");
}
const capture = path.join(dir, "capture.mjs");
fs.writeFileSync(capture, `import cp from 'node:child_process'; import fs from 'node:fs'; import { syncBuiltinESMExports } from 'node:module'; const original = cp.spawnSync; cp.spawnSync = (...args) => { const r = original(...args); if (String(args[0]).includes('tsc')) fs.writeFileSync(${JSON.stringify(path.join(dir, "current.txt"))}, (r.stdout ?? '') + (r.stderr ?? '')); return r; }; syncBuiltinESMExports();`);
const current = spawnSync(process.execPath, ["--max-old-space-size=4096", "--import", capture, "scripts/check-release-type-baseline.mjs"],
  { cwd: root, env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" }, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
fs.writeFileSync(path.join(dir, "gate.txt"), (current.stdout ?? "") + (current.stderr ?? ""));
const currentRows = diagnostics(fs.readFileSync(path.join(dir, "current.txt"), "utf8"));
const withoutLocation = row => row.replace(/\(\d+,\d+\)(?=: error)/, "");
const before = oldRows.map(withoutLocation).sort();
const after = currentRows.map(withoutLocation).sort();
const locationOnly = JSON.stringify(before) === JSON.stringify(after);
// Do not merely discard locations: map every current error through unchanged
// source lines and reconstruct the exact previously reviewed raw fingerprint.
const diffs = new Map();
const mappingFailures = [];
const reconstructed = currentRows.map(row => {
  const match = row.match(/^(.*?)\((\d+),(\d+)\)(: error .*)$/);
  if (!match) { mappingFailures.push(row); return row; }
  const [, file, lineText, column, message] = match;
  if (!diffs.has(file)) {
    const diff = execFileSync("git", ["diff", "--no-ext-diff", "--unified=0", revision, "--", file], { cwd: root, encoding: "utf8" });
    diffs.set(file, [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)]
      .map(h => ({ oldStart: +h[1], oldCount: h[2] === undefined ? 1 : +h[2], newStart: +h[3], newCount: h[4] === undefined ? 1 : +h[4] })));
  }
  const line = +lineText;
  let delta = 0;
  for (const h of diffs.get(file)) {
    if (h.newCount && line >= h.newStart && line < h.newStart + h.newCount) {
      mappingFailures.push({ file, line, reason: "Diagnostic lies inside edited source; requires manual review." });
      return row;
    }
    if (h.newCount ? line >= h.newStart + h.newCount : line > h.newStart) delta += h.newCount - h.oldCount;
  }
  return `${file}(${line - delta},${column})${message}`;
}).sort();
const reconstructedHash = hash(reconstructed);
const exactReconstruction = mappingFailures.length === 0 && reconstructedHash === reviewed.diagnosticsSha256;
const added = after.filter((row, index) => after.slice(0, index + 1).filter(r => r === row).length > before.filter(r => r === row).length);
const removed = before.filter((row, index) => before.slice(0, index + 1).filter(r => r === row).length > after.filter(r => r === row).length);
const result = { evidence: dir, locationOnly, exactReconstruction, reconstructedHash, mappingFailures, historicalCount: oldRows.length, currentCount: currentRows.length, currentHash: hash(currentRows), added, removed };
fs.writeFileSync(path.join(dir, "comparison.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!locationOnly || !exactReconstruction) process.exitCode = 1;
