#!/usr/bin/env tsx
/**
 * Clinical String Registry Generator — Phase 0 Localization Infrastructure
 *
 * Reads the Step 1A audit report and extracts all CLINICAL_SAFETY-tagged strings
 * on ACTIVE surfaces into a protected registry.
 *
 * The registry serves as the authoritative list of strings that:
 *   - Cannot be modified by automated migration tooling
 *   - Require qualified clinical/medical review before translation
 *   - Are validated by GATE_07 in the Phase 0 validator
 *
 * Output: docs/localization/clinical-registry.json
 */

import fs from "fs";
import path from "path";

const REPORT_1A = path.resolve("scripts/i18n-audit-report.json");
const REPORT_1B = path.resolve("scripts/i18n-reachability-report.json");
const OUT_DIR = path.resolve("docs/localization");
const OUT_PATH = path.join(OUT_DIR, "clinical-registry.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

const report1A = JSON.parse(fs.readFileSync(REPORT_1A, "utf8"));
const report1B = JSON.parse(fs.readFileSync(REPORT_1B, "utf8"));

const reachMap = new Map(
  (report1B.files ?? []).map((f: { relPath: string; classification: string }) => [f.relPath, f.classification])
);

const clinicalFindings = (report1A.findings ?? []).filter(
  (f: { classification: string; relPath: string }) =>
    f.classification === "CLINICAL_SAFETY" &&
    ["ACTIVE", "CONDITIONAL", "HIDDEN_RESERVED"].includes(reachMap.get(f.relPath) ?? "")
);

// ── Enforce unique key identity ────────────────────────────────────────────
// proposedKey must be a stable, unique identity: one key ↔ one source text.
// Same key + same text (string repeated on multiple lines) shares the key.
// Same key + different text gets a numeric suffix (_2, _3, …).
{
  const keyToText = new Map<string, string>();   // assigned key -> text
  const textToKey = new Map<string, string>();   // "baseKey\u0000text" -> assigned key
  for (const f of clinicalFindings) {
    const base = f.proposedKey;
    const composite = `${base}\u0000${f.original}`;
    const already = textToKey.get(composite);
    if (already) { f.proposedKey = already; continue; }
    let candidate = base;
    let n = 2;
    while (keyToText.has(candidate) && keyToText.get(candidate) !== f.original) {
      candidate = `${base}_${n++}`;
    }
    keyToText.set(candidate, f.original);
    textToKey.set(composite, candidate);
    f.proposedKey = candidate;
  }
  // Hard guarantee: reject any remaining duplicate identity.
  const seen = new Map<string, string>();
  for (const f of clinicalFindings) {
    const prev = seen.get(f.proposedKey);
    if (prev !== undefined && prev !== f.original) {
      console.error(`FATAL: duplicate clinical key "${f.proposedKey}" maps to different source texts.`);
      process.exit(1);
    }
    seen.set(f.proposedKey, f.original);
  }
}

// Group by file
const byFile = new Map<string, typeof clinicalFindings>();
for (const f of clinicalFindings) {
  if (!byFile.has(f.relPath)) byFile.set(f.relPath, []);
  byFile.get(f.relPath)!.push(f);
}

// Categorise
function categorise(text: string): string {
  if (/diabet|glp.?1|insulin|glucose|HbA1c|semaglutide/i.test(text)) return "diabetes_glp1";
  if (/medication|dosage|prescription|drug|treatment/i.test(text)) return "medication";
  if (/pregnan|trimester|infant|toddler|pediatric|newborn/i.test(text)) return "pregnancy_pediatric";
  if (/allerg|anaphyl|contraindication|warning/i.test(text)) return "allergy_safety";
  if (/cholesterol|triglyceride|thyroid|hormone|creatinine|lab|A1c/i.test(text)) return "lab_biometric";
  return "general_clinical";
}

const registry = {
  _meta: {
    description: "Protected clinical/safety string registry. Strings here cannot be auto-migrated. Require qualified medical translator + clinical review.",
    generatedAt: new Date().toISOString(),
    basedOn: "Step 1A audit (CLINICAL_SAFETY class) × Step 1B reachability (ACTIVE/CONDITIONAL surfaces only)",
    governanceRule: "Any change to these strings in any locale file requires a [clinical-translation] PR annotation and clinical reviewer sign-off.",
  },
  totalClinicalStrings: clinicalFindings.length,
  filesWithClinicalStrings: byFile.size,
  byCategory: {} as Record<string, number>,
  byFile: {} as Record<string, Array<{ line: number; text: string; category: string; proposedKey: string }>>,
  allStrings: [] as Array<{ file: string; line: number; text: string; category: string; proposedKey: string }>,
};

const categoryCounts: Record<string, number> = {};

for (const [file, findings] of byFile.entries()) {
  registry.byFile[file] = findings.map((f: { line: number; original: string; proposedKey: string }) => {
    const cat = categorise(f.original);
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    return { line: f.line, text: f.original, category: cat, proposedKey: f.proposedKey };
  });
}

for (const f of clinicalFindings) {
  const cat = categorise(f.original);
  registry.allStrings.push({ file: f.relPath, line: f.line, text: f.original, category: cat, proposedKey: f.proposedKey });
}

registry.byCategory = categoryCounts;

fs.writeFileSync(OUT_PATH, JSON.stringify(registry, null, 2));

console.log("═══════════════════════════════════════════════════════════");
console.log("  CLINICAL STRING REGISTRY GENERATED");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Total protected clinical strings: ${registry.totalClinicalStrings}`);
console.log(`  Files containing clinical copy:   ${registry.filesWithClinicalStrings}`);
console.log("");
console.log("  By category:");
for (const [cat, count] of Object.entries(categoryCounts)) {
  console.log(`    ${cat.padEnd(25)} ${count}`);
}
console.log("");
console.log(`  Output: ${OUT_PATH}`);
console.log("  These strings require clinical review before any translation.");
console.log("═══════════════════════════════════════════════════════════\n");
