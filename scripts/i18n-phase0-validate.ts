#!/usr/bin/env tsx
/**
 * Phase 0 — Master Localization Validator
 *
 * Runs all localization quality gates in sequence.
 * Exits with code 1 if any required gate fails — suitable for CI/pre-push.
 *
 * Gates:
 *   GATE_02  Key parity — all locales have every English key
 *   GATE_03  Value quality — no empty, placeholder, or interpolation mismatches
 *   GATE_07  Clinical protection — clinical strings flagged, not silently altered
 *   GATE_08  Hardcoded-string count on ACTIVE surfaces (baseline regression)
 *
 * Usage:
 *   npx tsx scripts/i18n-phase0-validate.ts
 *   npx tsx scripts/i18n-phase0-validate.ts --ci   # strict exit codes for CI
 */

import fs from "fs";
import path from "path";

const CI_MODE = process.argv.includes("--ci");
const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const CLINICAL_REGISTRY = path.resolve("docs/localization/clinical-registry.json");
const REPORT_1A = path.resolve("scripts/i18n-audit-report.json");
const REPORT_1B = path.resolve("scripts/i18n-reachability-report.json");

let failures = 0;
let warnings = 0;

function pass(msg: string) { console.log(`  ✅ PASS  ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  WARN  ${msg}`); warnings++; }
function fail(msg: string) { console.log(`  ❌ FAIL  ${msg}`); failures++; }
function section(name: string) { console.log(`\n── ${name} ${"─".repeat(Math.max(4, 50 - name.length))}`); }

// ── Helpers ────────────────────────────────────────────────────────────────
function flattenEntries(obj: unknown, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out.push([full, v]);
      else out.push(...flattenEntries(v, full));
    }
  }
  return out;
}

function extractVars(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\{\{(\w+)\}\}/g)) out.add(m[1]);
  return out;
}

// ── Header ─────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════");
console.log("  PHASE 0 — LOCALIZATION VALIDATION SUITE");
console.log(`  Mode: ${CI_MODE ? "CI (strict)" : "Development"}`);
console.log("  Zero production files modified.");
console.log("═══════════════════════════════════════════════════════════");

// ── GATE 02: Key parity ────────────────────────────────────────────────────
section("GATE_02 — Key Parity (all locales vs en.json)");

const enRaw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const enEntries = flattenEntries(enRaw);
const enMap = new Map(enEntries);

const locales = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith(".json") && !f.startsWith("xq") && !f.startsWith("_"))
  .map(f => f.replace(".json", ""))
  .filter(l => l !== "en");

let parityFailed = false;
for (const locale of locales) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
  const keys = new Set(flattenEntries(raw).map(([k]) => k));
  const missing = [...enMap.keys()].filter(k => !keys.has(k));
  if (missing.length > 0) {
    fail(`[${locale}] ${missing.length} keys missing from en.json baseline: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
    parityFailed = true;
  } else {
    pass(`[${locale}] All ${enMap.size} English keys present`);
  }
}
if (!parityFailed) pass("All 13 non-English locales have complete key coverage");

// ── GATE 03: Value quality ─────────────────────────────────────────────────
section("GATE_03 — Value Quality (no empty/placeholder/interpolation errors)");

const PLACEHOLDER_PATTERNS = [/^TODO$/i, /^FIXME$/i, /^TBD$/i, /^\[missing\]$/i, /^TRANSLATE$/i];

for (const locale of locales) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
  const entries = flattenEntries(raw);
  const localeMap = new Map(entries);

  const empty = entries.filter(([, v]) => v.trim() === "");
  const placeholders = entries.filter(([, v]) => PLACEHOLDER_PATTERNS.some(p => p.test(v.trim())));

  const interpMismatches: string[] = [];
  for (const [k, localeVal] of entries) {
    const enVal = enMap.get(k);
    if (!enVal) continue;
    const enVars = extractVars(enVal);
    const localeVars = extractVars(localeVal);
    if (enVars.size === 0 && localeVars.size === 0) continue;
    const missing = [...enVars].filter(v => !localeVars.has(v));
    const extra = [...localeVars].filter(v => !enVars.has(v));
    if (missing.length > 0 || extra.length > 0) interpMismatches.push(k);
  }

  if (empty.length > 0) fail(`[${locale}] ${empty.length} empty values`);
  if (placeholders.length > 0) fail(`[${locale}] ${placeholders.length} placeholder values`);
  if (interpMismatches.length > 0) {
    fail(`[${locale}] ${interpMismatches.length} interpolation variable mismatches: ${interpMismatches.slice(0, 3).join(", ")}`);
  }

  if (empty.length === 0 && placeholders.length === 0 && interpMismatches.length === 0) {
    pass(`[${locale}] No empty, placeholder, or interpolation errors`);
  }

  // High-identical-rate warning (not failure unless >30%)
  const ALWAYS_SAME = [/^\d+$/, /^https?:\/\//, /^[A-Z]{2,5}$/, /^[a-z]{1,2}$/, /^(My Perfect Meals|MPM|GLP-1|BMI|TDEE|AI™|™|®)$/];
  const suspicious = entries.filter(([, v]) => {
    const enVal = enMap.get(flattenEntries(raw).find(([, val]) => val === v)?.[0] ?? "");
    return v === enVal && !ALWAYS_SAME.some(p => p.test(v));
  });
  const pct = (suspicious.length / enMap.size) * 100;
  if (pct > 30) fail(`[${locale}] ${pct.toFixed(1)}% of values identical to English — likely untranslated`);
  else if (pct > 15) warn(`[${locale}] ${pct.toFixed(1)}% of values identical to English — review recommended`);
}

// ── GATE 07: Clinical string protection ───────────────────────────────────
section("GATE_07 — Clinical String Protection");

if (!fs.existsSync(CLINICAL_REGISTRY)) {
  warn("Clinical registry not yet generated — run: npx tsx scripts/i18n-clinical-registry.ts");
} else {
  const registry = JSON.parse(fs.readFileSync(CLINICAL_REGISTRY, "utf8"));
  const count = registry.totalClinicalStrings ?? 0;
  pass(`Clinical registry loaded — ${count} protected strings on ${registry.filesWithClinicalStrings ?? "?"} active surfaces`);
  pass("Automated migration cannot alter CLINICAL_SAFETY strings (checked by migration engine, not this gate)");

  // Controlled review enforcement:
  // Any clinical key present in a locale file must have an APPROVED entry in
  // docs/localization/clinical-review/<locale>.review.json whose approved
  // translation matches the locale value exactly, and whose sourceText still
  // matches the current registry (stale approvals don't count).
  const REVIEW_DIR = path.resolve("docs/localization/clinical-review");

  // Registry identity must be unique: one key ↔ one source text. A duplicate
  // key mapped to different texts would silently attach approvals to the
  // wrong clinical string.
  const clinicalByKey = new Map<string, { text: string }>();
  let dupIdentity = 0;
  for (const s of (registry.allStrings ?? []) as Array<{ proposedKey: string; text: string }>) {
    const prev = clinicalByKey.get(s.proposedKey);
    if (prev && prev.text !== s.text) {
      dupIdentity++;
      fail(`Registry key "${s.proposedKey}" maps to multiple different source texts — regenerate registry (scripts/i18n-clinical-registry.ts)`);
    }
    clinicalByKey.set(s.proposedKey, { text: s.text });
  }
  if (dupIdentity === 0) pass(`Registry identity check — ${clinicalByKey.size} unique clinical keys, no key/text conflicts`);

  // Source-integrity check: every protected clinical string must still appear
  // verbatim in its source file. A rendered clinical string changed (or
  // removed) without regenerating the registry through the controlled
  // process is a gate failure — this is what protects the strings while they
  // are still hardcoded (pre-migration).
  let sourceMissing = 0;
  const sourceCache = new Map<string, string | null>();
  for (const s of (registry.allStrings ?? []) as Array<{ file: string; line: number; text: string }>) {
    if (!sourceCache.has(s.file)) {
      sourceCache.set(s.file, fs.existsSync(s.file) ? fs.readFileSync(s.file, "utf8") : null);
    }
    const src = sourceCache.get(s.file);
    if (src === null) {
      sourceMissing++;
      fail(`Clinical source file missing: ${s.file} — registry is stale or file deleted without clinical sign-off`);
    } else if (!src!.includes(s.text)) {
      sourceMissing++;
      fail(`Clinical string changed/removed without controlled process: ${s.file}:${s.line} "${s.text.slice(0, 60)}${s.text.length > 60 ? "…" : ""}" — regenerate registry with [clinical-translation] sign-off`);
    }
  }
  if (sourceMissing === 0) pass(`Source integrity — all ${(registry.allStrings ?? []).length} protected strings present verbatim in their source files`);

  // en.json: clinical keys must match the registry source text exactly.
  let enClinical = 0, enMismatch = 0;
  for (const [key, info] of clinicalByKey) {
    const enVal = enMap.get(key);
    if (enVal === undefined) continue;
    enClinical++;
    if (enVal !== info.text) {
      enMismatch++;
      fail(`[en] Clinical key "${key}" differs from registry source text — update registry (with clinical sign-off) or revert`);
    }
  }
  if (enClinical > 0 && enMismatch === 0) pass(`[en] ${enClinical} clinical keys match registry source text`);
  if (enClinical < clinicalByKey.size) {
    warn(`Clinical key migration coverage: ${enClinical}/${clinicalByKey.size} keys in en.json — un-migrated strings are protected by the source-integrity check above`);
  }

  for (const locale of locales) {
    const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
    const localeMap = new Map(flattenEntries(raw));
    const present = [...clinicalByKey.keys()].filter(k => localeMap.has(k));
    if (present.length === 0) continue; // nothing clinical shipped in this locale yet

    const manifestPath = path.join(REVIEW_DIR, `${locale}.review.json`);
    if (!fs.existsSync(manifestPath)) {
      fail(`[${locale}] ${present.length} clinical keys present but no review manifest at docs/localization/clinical-review/${locale}.review.json — run scripts/i18n-clinical-translate.ts --locale ${locale}`);
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const entriesByKey = new Map<string, { sourceText: string; proposedTranslation: string; status: string; reviewer: string | null; reviewedAt: string | null }>(
      (manifest.entries ?? []).map((e: { key: string }) => [e.key, e as never])
    );

    let ok = 0;
    for (const key of present) {
      const localeVal = localeMap.get(key)!;
      const entry = entriesByKey.get(key);
      const src = clinicalByKey.get(key)!.text;
      if (localeVal === src) { ok++; continue; } // untranslated passthrough of English source is allowed
      if (!entry) {
        fail(`[${locale}] Clinical key "${key}" translated without a review manifest entry`);
      } else if (entry.status !== "approved") {
        fail(`[${locale}] Clinical key "${key}" translated but manifest status is "${entry.status}" — requires clinical approval`);
      } else if (!entry.reviewer || !entry.reviewedAt) {
        fail(`[${locale}] Clinical key "${key}" approved but missing reviewer/reviewedAt in manifest`);
      } else if (entry.sourceText !== src) {
        fail(`[${locale}] Clinical key "${key}" approval is stale — registry source text changed since review`);
      } else if (entry.proposedTranslation !== localeVal) {
        fail(`[${locale}] Clinical key "${key}" locale value does not match the approved translation in the manifest`);
      } else {
        ok++;
      }
    }
    if (ok === present.length) pass(`[${locale}] All ${present.length} clinical keys covered by approved review entries (or English passthrough)`);
  }
  pass("GATE_07 controlled-review enforcement active — clinical translations require approved manifest entries");
}

// ── GATE 08: Hardcoded-string baseline regression ─────────────────────────
section("GATE_08 — Hardcoded String Baseline (ACTIVE surfaces)");

const BASELINE_FILE = path.resolve("docs/localization/hardcoded-baseline.json");

if (fs.existsSync(REPORT_1A) && fs.existsSync(REPORT_1B)) {
  const report1A = JSON.parse(fs.readFileSync(REPORT_1A, "utf8"));
  const report1B = JSON.parse(fs.readFileSync(REPORT_1B, "utf8"));

  const reachMap = new Map(
    (report1B.files ?? []).map((f: { relPath: string; classification: string }) => [f.relPath, f.classification])
  );

  const activeFindings = (report1A.findings ?? []).filter((f: { relPath: string }) => {
    const cls = reachMap.get(f.relPath);
    return cls === "ACTIVE";
  });

  const baseline = {
    activeHardcodedStrings: activeFindings.length,
    generatedAt: new Date().toISOString(),
  };

  if (fs.existsSync(BASELINE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    const diff = activeFindings.length - saved.activeHardcodedStrings;
    if (diff > 0) {
      // GATE_08 is a strict ratchet — baseline may only stay the same or decrease.
      // Any increase means a new hardcoded string was added to an ACTIVE surface.
      fail(`Hardcoded-string count on ACTIVE surfaces increased by ${diff} (${saved.activeHardcodedStrings} → ${activeFindings.length}). New user-facing strings must use t() keys. This gate is a ratchet — it never goes up.`);
    } else if (diff < 0) {
      pass(`Hardcoded-string count decreased by ${Math.abs(diff)} — migration progress ✓`);
    } else {
      pass(`Hardcoded-string count stable at ${activeFindings.length} on ACTIVE surfaces`);
    }
  } else {
    // First run — save baseline
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
    pass(`Baseline established: ${activeFindings.length} hardcoded strings on ACTIVE surfaces`);
    pass(`Saved to ${BASELINE_FILE} — future runs will detect regressions`);
  }
} else {
  warn("Step 1A/1B audit reports not found — run scripts/i18n-audit.ts and scripts/i18n-reachability-audit.ts first");
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════");
console.log(`  PHASE 0 VALIDATION COMPLETE`);
console.log(`  Failures: ${failures}  |  Warnings: ${warnings}`);
if (failures === 0 && warnings === 0) {
  console.log("  Status: ✅ ALL GATES PASS");
} else if (failures === 0) {
  console.log("  Status: ⚠️  WARNINGS PRESENT — review recommended");
} else {
  console.log("  Status: ❌ GATES FAILED — fix before migration");
}
console.log("═══════════════════════════════════════════════════════════\n");

if (CI_MODE && failures > 0) {
  process.exit(1);
}
