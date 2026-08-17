#!/usr/bin/env node
/**
 * cut-release.js
 *
 * Run this BEFORE pushing when you have actual customer-facing changes to announce.
 * It bumps `releaseId` and sets `notes` in release-manifest.json.
 *
 * Usage:
 *   node scripts/cut-release.js "Note one" "Note two" "Note three"
 *
 *   Or set RELEASE_NOTES env var (newline-separated):
 *   RELEASE_NOTES="Note one\nNote two" node scripts/cut-release.js
 *
 * The script REFUSES to create a release with zero valid notes.
 * A new releaseId is never generated without at least one non-blank note — this is intentional:
 * an empty What's New banner should never reach users.
 *
 * After running this script, commit the updated release-manifest.json alongside your code.
 * The next deployment will then show the banner to users who haven't seen this releaseId yet.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "../client/public/release-manifest.json");

// ── Collect notes ──────────────────────────────────────────────────────────
let notes = [];

// Priority 1: command-line args
if (process.argv.length > 2) {
  notes = process.argv.slice(2);
}
// Priority 2: RELEASE_NOTES env var (newline or semicolon separated)
else if (process.env.RELEASE_NOTES) {
  notes = process.env.RELEASE_NOTES
    .split(/[\n;]/)
    .map((s) => s.trim());
}

// Strip blank entries
notes = notes.map((n) => n.trim()).filter(Boolean);

// ── Validation: refuse empty releases ─────────────────────────────────────
if (notes.length === 0) {
  console.error("");
  console.error("❌  cut-release: REFUSED — no release notes provided.");
  console.error("");
  console.error("    A new releaseId must never be created without at least one");
  console.error("    non-blank customer-facing note. An empty What's New banner");
  console.error("    should never reach users.");
  console.error("");
  console.error("    Usage:");
  console.error('      node scripts/cut-release.js "What changed" "Another change"');
  console.error('      RELEASE_NOTES="What changed\\nAnother change" node scripts/cut-release.js');
  console.error("");
  process.exit(1);
}

// ── Load existing manifest ─────────────────────────────────────────────────
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
} catch {
  // Fresh manifest — that's fine.
}

// ── Generate new release ID: YYYY-MM-DD plus an auto-incrementing suffix ──
const today = new Date().toISOString().slice(0, 10); // e.g. "2026-08-17"
const prevId = existing.releaseId ?? "";
let suffix = 1;

// If there was already a release today, increment the suffix.
if (prevId.startsWith(today + "-")) {
  const prevSuffix = parseInt(prevId.slice(today.length + 1), 10);
  if (!isNaN(prevSuffix)) suffix = prevSuffix + 1;
}

const releaseId = `${today}-${suffix}`;

// ── Write ──────────────────────────────────────────────────────────────────
const updated = { ...existing, releaseId, notes };
fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2) + "\n");

console.log("");
console.log("✅  cut-release: new customer release created.");
console.log("    Release ID  :", releaseId);
console.log("    Notes       :", notes.length, "item(s)");
notes.forEach((n, i) => console.log(`      ${i + 1}. ${n}`));
console.log("");
console.log("    Next steps:");
console.log("      1. git add client/public/release-manifest.json");
console.log('      2. git commit -m "release: ' + releaseId + '"');
console.log("      3. git push + deploy");
console.log("    Users who haven't seen this releaseId will get the What's New banner.");
console.log("");
