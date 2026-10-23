import { mkdirSync, lstatSync, existsSync, openSync, writeFileSync, closeSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { MODELS, RECIPES } from "./recipes.mjs";

// Private local files only, outside app public paths and all application storage APIs.
export function privateDirectory(root) {
  const target = resolve(root), parts = target.split(sep).filter(Boolean);
  let current = sep;
  for (const part of parts) {
    current = join(current, part);
    if (existsSync(current)) {
      const stat = lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Unsafe review directory");
    } else mkdirSync(current, { mode: 0o700 });
  }
  return target;
}
export function writePrivate(file, value) {
  const fd = openSync(file, "wx", 0o600);
  try { writeFileSync(fd, value); } finally { closeSync(fd); }
}
export function createReviewSink(root, runId) {
  if (!/^[a-z0-9-]{8,64}$/.test(runId)) throw new Error("Invalid review run ID");
  const parent = privateDirectory(root), dir = join(parent, runId);
  // No overwrite, resume, public URL, upload or automatic retention extension.
  mkdirSync(dir, { mode: 0o700 });
  writePrivate(join(dir,"RETENTION.txt"),
    "Private review only. Delete this run directory after review (recommended within 24 hours). No automatic upload or application association. Retain the authorization-consumed marker to prevent replay.\n");
  return {
    directory: dir,
    save(cell, bytes) {
      if (!MODELS.includes(cell.model) || !RECIPES.some(r=>r.id===cell.recipeId)) throw new Error("Unapproved artifact identity");
      const file = `${String(cell.id.split(":")[0]).replace(/[^a-z0-9-]/g,"")}-${cell.model}.png`;
      if (!file || !Buffer.isBuffer(bytes)) throw new Error("Invalid review artifact");
      writePrivate(join(dir,file), bytes);
      return file;
    },
    report(report) { writePrivate(join(dir,"report.json"), JSON.stringify(report,null,2)+"\n"); },
  };
}
