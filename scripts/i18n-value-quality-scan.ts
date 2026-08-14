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

function parseThresholdFlag(flag: string, defaultValue: number): number {
  const arg = process.argv.find(a => a.startsWith(`--${flag}=`));
  if (!arg) return defaultValue;
  const val = parseFloat(arg.split("=")[1]);
  if (isNaN(val) || val < 0 || val > 100) {
    console.error(`  ⚠️  Invalid value for --${flag}: "${arg.split("=")[1]}". Using default ${defaultValue}.`);
    return defaultValue;
  }
  return val;
}
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
  clinicalIdenticalKeys: string[];
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
  const clinicalIdenticalKeys = clinicalIdentical.map(([k]) => k);

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
    clinicalIdenticalKeys,
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
  if (r.clinicalIdenticalKeys.length > 0 && !r.verdict.startsWith("❌ LIKELY UNTRANSLATED")) {
    console.warn(`        ⚠️  CLINICAL STRINGS LEFT IN ENGLISH (${r.clinicalIdenticalKeys.length} key(s)):`);
    for (const key of r.clinicalIdenticalKeys) {
      console.warn(`             • ${key}: "${localeMap.get(key)}"`);
    }
  }
  console.log("");
}

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), baseline: { totalEnglishKeys: enMap.size }, results: allResults }, null, 2));

console.log(`\n  Report written → ${OUT_JSON}`);
console.log("  Zero production files modified.\n");

// ── Exit-code gate ─────────────────────────────────────────────────────────
// Gate 1 — Interpolation mismatches
// Any mismatch means a {{variable}} is missing (or extra) in a translated
// string — that is a runtime bug that breaks the UI for real users.

const totalInterpMismatches = Object.values(allResults).reduce(
  (sum, r) => sum + r.interpolationMismatches, 0
);

const identicalWarnLocales: string[] = [];

let exitCode = 0;

if (totalInterpMismatches > 0) {
  console.error(
    `  ❌ INTERPOLATION GATE FAILED — ${totalInterpMismatches} interpolation mismatch(es) found across all locales.\n` +
    `     Fix the missing/extra {{variables}} listed above, then re-run this scan.\n`
  );
  exitCode = 1;
} else {
  console.log("  ✅ Interpolation gate passed — no {{variable}} mismatches found.\n");
}

// ── Clinical-string gate ───────────────────────────────────────────────────
// Clinical strings (dosage instructions, GLP-1 guidance, pregnancy warnings,
// allergy information, etc.) that remain in English for non-English users are
// a SAFETY and TRUST risk, not just a UX gap.
//
// A locale is "considered translated" when fewer than 50 % of its keys are
// identical to English (i.e. not the ❌ LIKELY UNTRANSLATED verdict).
// For those locales, any clinical key that still matches English verbatim
// triggers a hard failure so the problem surfaces in CI before it ships.

const clinicalViolations: Array<{ locale: string; key: string; value: string }> = [];

for (const r of Object.values(allResults)) {
  // Skip locales flagged as almost entirely untranslated — clinical check
  // would be noise there; the overall untranslated verdict is the real issue.
  if (r.verdict.startsWith("❌ LIKELY UNTRANSLATED")) continue;

  for (const key of r.clinicalIdenticalKeys) {
    const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${r.locale}.json`), "utf8"));
    const localeMap = new Map(flattenEntries(raw));
    clinicalViolations.push({ locale: r.locale, key, value: localeMap.get(key) ?? "" });
  }
}

if (clinicalViolations.length > 0) {
  console.error("  ❌ CLINICAL STRING GATE FAILED — the following clinical keys are still in English");
  console.error("     for locales that are otherwise considered translated.");
  console.error("     Clinical strings (dosage, GLP-1, pregnancy, allergy guidance) MUST be");
  console.error("     translated before shipping — leaving them in English is a safety risk.\n");

  // Group by locale for readability
  const byLocale: Record<string, Array<{ key: string; value: string }>> = {};
  for (const { locale, key, value } of clinicalViolations) {
    (byLocale[locale] ??= []).push({ key, value });
  }
  for (const [locale, items] of Object.entries(byLocale)) {
    console.error(`     Locale: ${locale}  (${items.length} untranslated clinical key(s))`);
    for (const { key, value } of items) {
      console.error(`       • ${key}: "${value}"`);
    }
    console.error("");
  }
  console.error(`     Total: ${clinicalViolations.length} clinical string(s) left in English across ${Object.keys(byLocale).length} locale(s).\n`);
  exitCode = 1;
} else {
  console.log("  ✅ Clinical string gate passed — no clinical strings left in English for translated locales.\n");
}

// Gate 2 — Identical-to-English threshold
// Locales with too many values still in English indicate a half-translated
// file reaching users. Two levels:
//   WARN  (warn-identical-above, default 15%) — printed but not a hard fail.
//   FAIL  (fail-identical-above, default 40%) — exits non-zero, blocks release.

const FAIL_IDENTICAL_ABOVE = parseThresholdFlag("fail-identical-above", 40);
const WARN_IDENTICAL_ABOVE = parseThresholdFlag("warn-identical-above", 15);

console.log(`  Identical-to-English thresholds: warn >${WARN_IDENTICAL_ABOVE}%  fail >${FAIL_IDENTICAL_ABOVE}%\n`);

const identicalFailLocales: string[] = [];

for (const r of Object.values(allResults)) {
  const pct = parseFloat(r.identicalToEnglishPct);
  if (pct > FAIL_IDENTICAL_ABOVE) {
    identicalFailLocales.push(`${r.locale} (${r.identicalToEnglishPct}%)`);
  } else if (pct > WARN_IDENTICAL_ABOVE) {
    identicalWarnLocales.push(`${r.locale} (${r.identicalToEnglishPct}%)`);
  }
}

if (identicalWarnLocales.length > 0) {
  console.warn(
    `  ⚠️  IDENTICAL-TO-ENGLISH WARNING — the following locale(s) exceed ${WARN_IDENTICAL_ABOVE}% identical values:\n` +
    `     ${identicalWarnLocales.join(", ")}\n` +
    `     These locales may be partially translated. Review before shipping.\n`
  );
}

if (identicalFailLocales.length > 0) {
  console.error(
    `  ❌ IDENTICAL-TO-ENGLISH GATE FAILED — the following locale(s) exceed ${FAIL_IDENTICAL_ABOVE}% identical values:\n` +
    `     ${identicalFailLocales.join(", ")}\n` +
    `     A locale this far from translated must not reach users. Translate the\n` +
    `     flagged strings or remove the locale before pushing.\n`
  );
  exitCode = 1;
}

process.exit(exitCode);
