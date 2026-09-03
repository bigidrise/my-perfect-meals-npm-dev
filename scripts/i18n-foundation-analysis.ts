#!/usr/bin/env tsx
/**
 * Step 2 — Global Localization Foundation Analysis
 * Read-only. Produces 6 required deliverables from Step 1A/1B reports.
 *
 * Deliverables:
 *   1. Active localization baseline (ACTIVE surfaces with hardcoded strings)
 *   2. Shared components ranked by downstream impact
 *   3. Locale parity status for all 14 languages
 *   4. Clinical/safety translation inventory
 *   5. Proposed automated validation gates
 *   6. Recommended migration batches
 *
 * Output: docs/localization/foundation-report.json + console summary
 */

import fs from "fs";
import path from "path";

const CLIENT_SRC = path.resolve("client/src");
const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const REPORT_1A = path.resolve("scripts/i18n-audit-report.json");
const REPORT_1B = path.resolve("scripts/i18n-reachability-report.json");
const OUT_DIR = path.resolve("docs/localization");
const OUT_JSON = path.join(OUT_DIR, "foundation-report.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Load Step 1A / 1B reports ─────────────────────────────────────────────
const report1A = JSON.parse(fs.readFileSync(REPORT_1A, "utf8"));
const report1B = JSON.parse(fs.readFileSync(REPORT_1B, "utf8"));

const findings1A: Array<{
  relPath: string; line: number; original: string;
  classification: string; reason: string; proposedKey: string;
  isSharedComponent: boolean; inJSX: boolean; inConfig: boolean;
}> = report1A.findings || [];

const files1B: Array<{
  relPath: string; classification: string; confidence: string;
  reason: string; gate: string; importerCount: number; importedCount: number;
}> = report1B.files || [];

// Build lookup: relPath → reachability
const reachMap = new Map(files1B.map(f => [f.relPath, f]));

// ── DELIVERABLE 1: Active localization baseline ────────────────────────────
console.log("═══════════════════════════════════════════════════════════");
console.log("  STEP 2 — GLOBAL LOCALIZATION FOUNDATION ANALYSIS");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("── [1/6] Active Localization Baseline ──────────────────────");

const activeFindings = findings1A.filter(f => {
  const r = reachMap.get(f.relPath);
  return r && (r.classification === "ACTIVE" || r.classification === "CONDITIONAL");
});

const activeByClass = {
  SAFE_AUTOMATION: activeFindings.filter(f => f.classification === "SAFE_AUTOMATION"),
  REVIEW_REQUIRED: activeFindings.filter(f => f.classification === "REVIEW_REQUIRED"),
  CLINICAL_SAFETY: activeFindings.filter(f => f.classification === "CLINICAL_SAFETY"),
};

// Files with hardcoded strings on ACTIVE surfaces
const activeFilesWithStrings = new Set(activeFindings.map(f => f.relPath));
const activeSharedWithStrings = activeFindings.filter(f => f.isSharedComponent);

console.log(`  Active surfaces with hardcoded strings: ${activeFilesWithStrings.size} files`);
console.log(`  Total active hardcoded strings:        ${activeFindings.length}`);
console.log(`    SAFE_AUTOMATION:                     ${activeByClass.SAFE_AUTOMATION.length}`);
console.log(`    REVIEW_REQUIRED:                     ${activeByClass.REVIEW_REQUIRED.length}`);
console.log(`    CLINICAL_SAFETY:                     ${activeByClass.CLINICAL_SAFETY.length}`);
console.log(`    In shared components:                ${activeSharedWithStrings.length}`);

// ── DELIVERABLE 2: Shared components ranked by downstream impact ───────────
console.log("\n── [2/6] Shared Component Impact Ranking ───────────────────");

// Count hardcoded findings per shared component file
const sharedComponentCounts = new Map<string, { findings: number; importerCount: number; impact: number }>();

for (const f of activeFindings.filter(f => f.isSharedComponent)) {
  const info = reachMap.get(f.relPath);
  const importers = info?.importerCount ?? 0;
  if (!sharedComponentCounts.has(f.relPath)) {
    sharedComponentCounts.set(f.relPath, { findings: 0, importerCount: importers, impact: 0 });
  }
  const entry = sharedComponentCounts.get(f.relPath)!;
  entry.findings++;
  entry.impact = entry.findings * (entry.importerCount + 1); // weighted score
}

const rankedShared = [...sharedComponentCounts.entries()]
  .sort((a, b) => b[1].impact - a[1].impact)
  .slice(0, 25);

console.log("  (findings × importers = impact score)");
console.log("");
for (const [file, data] of rankedShared) {
  const short = file.replace("client/src/", "");
  console.log(`  ${String(data.impact).padStart(5)}  ${String(data.findings).padStart(3)} findings × ${String(data.importerCount).padStart(2)} importers  │  ${short}`);
}

// ── DELIVERABLE 3: Locale parity status ───────────────────────────────────
console.log("\n── [3/6] Locale Parity Status ──────────────────────────────");

function flattenKeys(obj: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") keys.add(full);
      else for (const sub of flattenKeys(v, full)) keys.add(sub);
    }
  }
  return keys;
}

const locales = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith(".json"))
  .map(f => f.replace(".json", ""));

const enKeys = flattenKeys(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8")));

const parityData: Record<string, {
  total: number; missing: number; missingPct: string;
  extra: number; emptyValues: number; status: string;
  sampleMissing: string[];
}> = {};

for (const locale of locales) {
  if (locale === "en") continue;
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
  const keys = flattenKeys(raw);

  // Find empty/untranslated values
  function countEmpty(obj: unknown): number {
    let count = 0;
    if (typeof obj === "object" && obj !== null) {
      for (const v of Object.values(obj as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim() === "") count++;
        else count += countEmpty(v);
      }
    }
    return count;
  }

  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));
  const empty = countEmpty(raw);
  const pct = ((missing.length / enKeys.size) * 100).toFixed(1);
  const status = missing.length === 0 ? "✅ COMPLETE" : missing.length <= 20 ? "⚠️  MINOR GAP" : "❌ MISSING";

  parityData[locale] = {
    total: keys.size,
    missing: missing.length,
    missingPct: pct,
    extra: extra.length,
    emptyValues: empty,
    status,
    sampleMissing: missing.slice(0, 5),
  };

  console.log(`  ${locale.padEnd(4)}  ${status.padEnd(14)}  ${keys.size.toString().padStart(5)} keys  ${missing.length.toString().padStart(4)} missing (${pct}%)  ${empty} empty values`);
}

// ── DELIVERABLE 4: Clinical/safety translation inventory ──────────────────
console.log("\n── [4/6] Clinical/Safety Translation Inventory ─────────────");

const clinicalFindings = activeFindings.filter(f => f.classification === "CLINICAL_SAFETY");

// Group by file
const clinicalByFile = new Map<string, typeof clinicalFindings>();
for (const f of clinicalFindings) {
  if (!clinicalByFile.has(f.relPath)) clinicalByFile.set(f.relPath, []);
  clinicalByFile.get(f.relPath)!.push(f);
}

// Categorise clinical strings
const clinicalCategories = {
  diabetes_glp1: clinicalFindings.filter(f =>
    /diabet|glp.?1|insulin|glucose|HbA1c|semaglutide|ozempic|wegovy/i.test(f.original)),
  medication: clinicalFindings.filter(f =>
    /medication|dose|prescription|drug|treatment|therapy/i.test(f.original)),
  pregnancy_pediatric: clinicalFindings.filter(f =>
    /pregnan|trimester|infant|toddler|pediatric|newborn/i.test(f.original)),
  allergy_safety: clinicalFindings.filter(f =>
    /allerg|anaphyl|epinephrine|contraindication|warning|danger/i.test(f.original)),
  lab_biometric: clinicalFindings.filter(f =>
    /lab|blood|cholesterol|triglyceride|thyroid|hormone|creatinine|A1c/i.test(f.original)),
  general_clinical: [] as typeof clinicalFindings,
};
// General = anything not caught above
const categorised = new Set([
  ...clinicalCategories.diabetes_glp1,
  ...clinicalCategories.medication,
  ...clinicalCategories.pregnancy_pediatric,
  ...clinicalCategories.allergy_safety,
  ...clinicalCategories.lab_biometric,
].map(f => `${f.relPath}:${f.line}`));
clinicalCategories.general_clinical = clinicalFindings.filter(
  f => !categorised.has(`${f.relPath}:${f.line}`)
);

console.log(`  Total CLINICAL_SAFETY strings on active surfaces: ${clinicalFindings.length}`);
console.log(`  Files containing clinical copy: ${clinicalByFile.size}`);
console.log("");
console.log(`  By category:`);
console.log(`    Diabetes / GLP-1:          ${clinicalCategories.diabetes_glp1.length}`);
console.log(`    Medication / Dosing:       ${clinicalCategories.medication.length}`);
console.log(`    Pregnancy / Pediatric:     ${clinicalCategories.pregnancy_pediatric.length}`);
console.log(`    Allergy / Safety warnings: ${clinicalCategories.allergy_safety.length}`);
console.log(`    Lab / Biometric values:    ${clinicalCategories.lab_biometric.length}`);
console.log(`    General clinical:          ${clinicalCategories.general_clinical.length}`);
console.log("");
console.log("  Top files requiring clinical translation governance:");
const topClinicalFiles = [...clinicalByFile.entries()]
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 10);
for (const [file, findings] of topClinicalFiles) {
  console.log(`    ${findings.length.toString().padStart(3)}  ${file.replace("client/src/", "")}`);
}

// ── DELIVERABLE 5: Proposed automated validation gates ────────────────────
console.log("\n── [5/6] Proposed Automated Validation Gates ───────────────");

const gates = [
  {
    id: "GATE_01",
    name: "Hardcoded string lint gate",
    tool: "eslint-plugin-i18next",
    scope: "ACTIVE surfaces that have been migrated",
    trigger: "pre-commit / CI",
    severity: "ERROR — blocks merge",
    status: "NOT INSTALLED",
    effort: "Low — npm install + .eslintrc config",
  },
  {
    id: "GATE_02",
    name: "Key parity check",
    tool: "scripts/i18n-foundation-analysis.ts (this script)",
    scope: "All 14 locales vs en.json baseline",
    trigger: "CI on every locale file change",
    severity: "ERROR if any ACTIVE-surface key missing from ≥1 locale",
    status: "LOGIC EXISTS — needs CI wiring",
    effort: "Low — add as CI step",
  },
  {
    id: "GATE_03",
    name: "Reachability classification",
    tool: "scripts/i18n-reachability-audit.ts",
    scope: "All 690 .tsx files",
    trigger: "Weekly or on new file added",
    severity: "WARN for new ORPHAN_DEAD files, ERROR for new hardcoded strings on ACTIVE",
    status: "SCRIPT EXISTS — needs CI wiring",
    effort: "Low",
  },
  {
    id: "GATE_04",
    name: "Pseudo-localization expansion test",
    tool: "Playwright — load app with expanded strings",
    scope: "All ACTIVE shared components",
    trigger: "CI on component changes",
    severity: "ERROR for overflow / clipping / inaccessible controls",
    status: "NOT BUILT",
    effort: "Medium — requires Playwright setup + pseudo-locale",
  },
  {
    id: "GATE_05",
    name: "RTL layout validation",
    tool: "Playwright — Arabic locale at 375px",
    scope: "All ACTIVE shared components + navigation",
    trigger: "CI on component/layout changes",
    severity: "ERROR for mirroring failures, missing direction-aware icons",
    status: "NOT BUILT",
    effort: "Medium",
  },
  {
    id: "GATE_06",
    name: "Fallback-to-English detector",
    tool: "Runtime detection script",
    scope: "All active pages at non-English locale",
    trigger: "E2E test run",
    severity: "WARN per missing key, ERROR if >5% of page strings are English fallback",
    status: "NOT BUILT",
    effort: "Medium",
  },
  {
    id: "GATE_07",
    name: "Clinical string change gate",
    tool: "Git diff checker on CLINICAL_SAFETY-tagged strings",
    scope: "130 clinical strings on active surfaces",
    trigger: "pre-commit when clinical files change",
    severity: "WARN — require clinical review annotation in PR",
    status: "NOT BUILT",
    effort: "Low — git diff + annotation check",
  },
];

for (const g of gates) {
  console.log(`\n  ${g.id}  ${g.name}`);
  console.log(`    Status:   ${g.status}`);
  console.log(`    Trigger:  ${g.trigger}  |  Severity: ${g.severity}`);
  console.log(`    Effort:   ${g.effort}`);
}

// ── DELIVERABLE 6: Recommended migration batches ─────────────────────────
console.log("\n── [6/6] Recommended Migration Batches ─────────────────────");

// Batch A: Shared components (fix once, impact everywhere)
const batchA = rankedShared.slice(0, 10).map(([file]) => file);

// Batch B: High-traffic pages with only SAFE_AUTOMATION strings
const highTrafficSafePages = [...activeFilesWithStrings]
  .filter(f => {
    const r = reachMap.get(f);
    if (!r || r.classification !== "ACTIVE") return false;
    const fileFindings = activeFindings.filter(x => x.relPath === f);
    const hasClinical = fileFindings.some(x => x.classification === "CLINICAL_SAFETY");
    const hasReview = fileFindings.some(x => x.classification === "REVIEW_REQUIRED");
    return !hasClinical && !hasReview && fileFindings.length > 5;
  })
  .sort((a, b) => {
    const aC = activeFindings.filter(f => f.relPath === a).length;
    const bC = activeFindings.filter(f => f.relPath === b).length;
    return bC - aC;
  })
  .slice(0, 15);

// Batch C: Pages with mixed content (safe + review)
const batchC = [...activeFilesWithStrings]
  .filter(f => {
    if (batchA.includes(f) || highTrafficSafePages.includes(f)) return false;
    const fileFindings = activeFindings.filter(x => x.relPath === f);
    const hasReview = fileFindings.some(x => x.classification === "REVIEW_REQUIRED");
    const hasClinical = fileFindings.some(x => x.classification === "CLINICAL_SAFETY");
    return hasReview && !hasClinical;
  })
  .slice(0, 15);

// Batch D: Clinical files
const batchD = [...clinicalByFile.keys()].slice(0, 10);

console.log("\n  BATCH A — Shared Components (fix once, widest impact)");
console.log("           Prerequisite: key parity sync + eslint gate installed");
for (const f of batchA) console.log(`    ${f.replace("client/src/", "")}`);

console.log("\n  BATCH B — High-traffic pages, safe-automation only");
console.log("           Can be scripted with mechanical extraction");
for (const f of highTrafficSafePages) {
  const count = activeFindings.filter(x => x.relPath === f).length;
  console.log(`    ${count.toString().padStart(3)}  ${f.replace("client/src/", "")}`);
}

console.log("\n  BATCH C — Mixed pages (safe + review-required strings)");
console.log("           Require human review for interpolated/conditional copy");
for (const f of batchC.slice(0, 10)) {
  const count = activeFindings.filter(x => x.relPath === f).length;
  console.log(`    ${count.toString().padStart(3)}  ${f.replace("client/src/", "")}`);
}

console.log("\n  BATCH D — Clinical/safety strings (controlled translation path)");
console.log("           Require clinical review. Do NOT automate.");
for (const f of batchD) {
  const count = clinicalByFile.get(f)?.length ?? 0;
  console.log(`    ${count.toString().padStart(3)}  ${f.replace("client/src/", "")}`);
}

// ── Write JSON report ─────────────────────────────────────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  step1A_summary: report1A.summary,
  step1B_summary: report1B.summary,
  deliverable1_activeBaseline: {
    activeFilesWithHardcodedStrings: activeFilesWithStrings.size,
    totalActiveHardcodedStrings: activeFindings.length,
    safeAutomation: activeByClass.SAFE_AUTOMATION.length,
    reviewRequired: activeByClass.REVIEW_REQUIRED.length,
    clinicalSafety: activeByClass.CLINICAL_SAFETY.length,
    inSharedComponents: activeSharedWithStrings.length,
  },
  deliverable2_sharedComponentRanking: rankedShared.map(([file, data]) => ({
    file,
    findings: data.findings,
    importerCount: data.importerCount,
    impactScore: data.impact,
  })),
  deliverable3_localeParity: parityData,
  deliverable4_clinicalInventory: {
    total: clinicalFindings.length,
    byCategory: Object.fromEntries(
      Object.entries(clinicalCategories).map(([k, v]) => [k, v.length])
    ),
    topFiles: topClinicalFiles.map(([file, findings]) => ({
      file,
      count: findings.length,
      samples: findings.slice(0, 3).map(f => f.original),
    })),
    allFindings: clinicalFindings,
  },
  deliverable5_validationGates: gates,
  deliverable6_migrationBatches: {
    batchA_sharedComponents: batchA,
    batchB_highTrafficSafePages: highTrafficSafePages,
    batchC_mixedPages: batchC,
    batchD_clinicalFiles: batchD,
    sequencing: [
      "1. Install eslint-plugin-i18next gate (GATE_01) — no app changes, just tooling",
      "2. Run key parity sync on all 13 locales for ALREADY-TRANSLATED keys only",
      "3. Migrate Batch A shared components (highest ROI per string fixed)",
      "4. Wire GATE_02 key parity into CI",
      "5. Migrate Batch B high-traffic safe pages",
      "6. Build pseudo-localization test suite (GATE_04)",
      "7. Build RTL validation (GATE_05)",
      "8. Migrate Batch C mixed pages (human review required)",
      "9. Migrate Batch D clinical strings (clinical review required)",
      "10. Address AI locale propagation (separate track — 30+ bypass openaiSafe.ts)",
    ],
  },
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  Foundation report written to: ${OUT_JSON}`);
console.log("  Zero production files modified.");
console.log("═══════════════════════════════════════════════════════════\n");
