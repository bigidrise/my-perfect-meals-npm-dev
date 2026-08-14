#!/usr/bin/env tsx
/**
 * Translation Value Quality Scanner
 * Proves (or disproves) that "zero missing keys" == "actually translated."
 *
 * Checks per locale:
 *   1. Values identical to English  (not translated)
 *   2. Empty / whitespace-only values
 *   3. Suspicious placeholders  (TODO, FIXME, TBD, [missing], etc.)
 *   4. Interpolation-variable mismatches  ({{var}} in en but not locale)
 *   5. Pluralization mismatches  (_one/_other/_few/_many present in en but missing in locale)
 *   6. Clinical-string count in each locale
 *   7. Overall translation completeness score
 *
 * Output: docs/localization/value-quality-report.json + console summary
 */

import fs from "fs";
import path from "path";

const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const OUT_DIR = path.resolve("docs/localization");
const OUT_JSON = path.join(OUT_DIR, "value-quality-report.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────────────
function flattenEntries(obj: unknown, prefix = ""): Array<[string, string]> {
  const results: Array<[string, string]> = [];
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") results.push([full, v]);
      else results.push(...flattenEntries(v, full));
    }
  }
  return results;
}

/** Extract all {{varName}} tokens from a string */
function extractVars(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.matchAll(/\{\{(\w+)\}\}/g)) out.add(m[1]);
  return out;
}

/** Clinical keyword matcher */
const CLINICAL_PATTERNS = [
  /diabet|glp.?1|insulin|glucose|HbA1c|semaglutide|ozempic|wegovy/i,
  /medication|dosage|prescription|drug|treatment|therapy/i,
  /pregnan|trimester|infant|toddler|pediatric|newborn/i,
  /allerg|anaphyl|epinephrine|contraindication/i,
  /cholesterol|triglyceride|thyroid|hormone|creatinine/i,
];
function isClinical(value: string): boolean {
  return CLINICAL_PATTERNS.some(p => p.test(value));
}

const PLACEHOLDER_PATTERNS = [
  /^TODO$/i, /^FIXME$/i, /^TBD$/i, /^\[missing\]$/i,
  /^TRANSLATE$/i, /^PLACEHOLDER$/i, /^\[.*\]$/, /^__.*__$/,
];
function isPlaceholder(v: string): boolean {
  return PLACEHOLDER_PATTERNS.some(p => p.test(v.trim()));
}

// ── Load English as baseline ───────────────────────────────────────────────
const enRaw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const enEntries = flattenEntries(enRaw);
const enMap = new Map(enEntries);

// Build pluralization key groups from English
// i18next plural suffixes: _one, _other, _few, _many, _zero, _two
const PLURAL_SUFFIXES = ["_one", "_other", "_few", "_many", "_zero", "_two"];
const enPluralBases = new Set<string>();
for (const [k] of enEntries) {
  const suffix = PLURAL_SUFFIXES.find(s => k.endsWith(s));
  if (suffix) enPluralBases.add(k.slice(0, -suffix.length));
}

const locales = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith(".json"))
  .map(f => f.replace(".json", ""))
  .filter(l => l !== "en");

console.log("═══════════════════════════════════════════════════════════");
console.log("  TRANSLATION VALUE QUALITY SCAN");
console.log("  Validating that keys have REAL translations, not just structure.");
console.log("═══════════════════════════════════════════════════════════\n");

const allResults: Record<string, {
  locale: string;
  totalKeys: number;
  identicalToEnglish: number;
  identicalToEnglishPct: string;
  identicalSamples: string[];
  emptyValues: number;
  placeholderValues: number;
  interpolationMismatches: number;
  interpolationMismatchSamples: Array<{ key: string; en: string; locale: string }>;
  pluralizationMismatches: number;
  clinicalStrings: number;
  clinicalIdenticalToEn: number;
  completenessScore: string;
  verdict: string;
}> = {};

for (const locale of locales) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
  const entries = flattenEntries(raw);
  const localeMap = new Map(entries);

  // 1. Identical to English
  const identicalKeys: string[] = [];
  for (const [k, v] of entries) {
    const enVal = enMap.get(k);
    if (enVal !== undefined && v === enVal && v.trim().length > 0) {
      identicalKeys.push(k);
    }
  }

  // Filter: some keys SHOULD be identical (numbers, proper nouns, brand names, URLs, single chars)
  const ALWAYS_SAME_PATTERNS = [
    /^\d+$/, /^https?:\/\//, /^[A-Z]{2,5}$/, /^[a-z]{1,2}$/,
    /^(My Perfect Meals|MPM|GLP-1|GLP1|BMI|TDEE|API|AI|AI™|™|®)$/,
  ];
  const suspiciousIdentical = identicalKeys.filter(k => {
    const v = localeMap.get(k)!;
    return !ALWAYS_SAME_PATTERNS.some(p => p.test(v));
  });

  // 2. Empty
  const emptyKeys = entries.filter(([, v]) => v.trim() === "");

  // 3. Placeholders
  const placeholderKeys = entries.filter(([, v]) => isPlaceholder(v));

  // 4. Interpolation mismatches
  const interpMismatches: Array<{ key: string; en: string; locale: string }> = [];
  for (const [k, localeVal] of entries) {
    const enVal = enMap.get(k);
    if (!enVal) continue;
    const enVars = extractVars(enVal);
    const localeVars = extractVars(localeVal);
    if (enVars.size === 0 && localeVars.size === 0) continue;
    const missing = [...enVars].filter(v => !localeVars.has(v));
    const extra = [...localeVars].filter(v => !enVars.has(v));
    if (missing.length > 0 || extra.length > 0) {
      interpMismatches.push({ key: k, en: enVal, locale: localeVal });
    }
  }

  // 5. Pluralization mismatches
  let pluralMismatches = 0;
  for (const base of enPluralBases) {
    const enHas = PLURAL_SUFFIXES.filter(s => enMap.has(base + s));
    const localeHas = PLURAL_SUFFIXES.filter(s => localeMap.has(base + s));
    if (enHas.length !== localeHas.length) pluralMismatches++;
  }

  // 6. Clinical strings
  const clinicalEntries = entries.filter(([, v]) => isClinical(v));
  const clinicalIdentical = clinicalEntries.filter(([k, v]) => enMap.get(k) === v);

  // Completeness score
  const translatedCount = entries.length - suspiciousIdentical.length - emptyKeys.length - placeholderKeys.length;
  const score = Math.max(0, Math.round((translatedCount / enMap.size) * 100));

  // Verdict
  let verdict: string;
  if (suspiciousIdentical.length > enMap.size * 0.5) {
    verdict = "❌ LIKELY UNTRANSLATED — majority of values identical to English";
  } else if (suspiciousIdentical.length > enMap.size * 0.2) {
    verdict = "⚠️  PARTIALLY TRANSLATED — significant English copy-over";
  } else if (emptyKeys.length > 10 || placeholderKeys.length > 0) {
    verdict = "⚠️  GAPS — empty or placeholder values present";
  } else if (interpMismatches.length > 5) {
    verdict = "⚠️  INTERPOLATION ISSUES — variable mismatches may cause runtime errors";
  } else {
    verdict = "✅ APPEARS TRANSLATED — low identical/empty/placeholder rate";
  }

  allResults[locale] = {
    locale,
    totalKeys: entries.length,
    identicalToEnglish: suspiciousIdentical.length,
    identicalToEnglishPct: ((suspiciousIdentical.length / enMap.size) * 100).toFixed(1),
    identicalSamples: suspiciousIdentical.slice(0, 5).map(k => `${k}: "${localeMap.get(k)}"`),
    emptyValues: emptyKeys.length,
    placeholderValues: placeholderKeys.length,
    interpolationMismatches: interpMismatches.length,
    interpolationMismatchSamples: interpMismatches.slice(0, 3),
    pluralizationMismatches: pluralMismatches,
    clinicalStrings: clinicalEntries.length,
    clinicalIdenticalToEn: clinicalIdentical.length,
    completenessScore: `${score}%`,
    verdict,
  };

  // Console output
  const r = allResults[locale];
  console.log(`  ${locale.padEnd(4)}  ${verdict}`);
  console.log(`        Keys: ${r.totalKeys}  │  Suspicious identical-to-en: ${r.identicalToEnglish} (${r.identicalToEnglishPct}%)  │  Empty: ${r.emptyValues}  │  Placeholders: ${r.placeholderValues}`);
  console.log(`        Interpolation mismatches: ${r.interpolationMismatches}  │  Plural mismatches: ${r.pluralizationMismatches}  │  Clinical identical-to-en: ${r.clinicalIdenticalToEn}/${r.clinicalStrings}`);
  if (r.identicalSamples.length > 0) {
    console.log(`        Sample identical: ${r.identicalSamples[0]}`);
  }
  if (r.interpolationMismatchSamples.length > 0) {
    const s = r.interpolationMismatchSamples[0];
    console.log(`        Interp mismatch ex: [${s.key}] en="${s.en}" → ${locale}="${s.locale}"`);
  }
  console.log("");
}

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), baseline: { totalEnglishKeys: enMap.size }, results: allResults }, null, 2));

console.log(`\n  Report written → ${OUT_JSON}`);
console.log("  Zero production files modified.\n");
