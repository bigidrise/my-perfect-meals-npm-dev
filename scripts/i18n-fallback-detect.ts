#!/usr/bin/env tsx
/**
 * Fallback-to-English Detector — Phase 0 Localization Infrastructure
 *
 * Detects which i18next keys will fall back to English at runtime
 * because the non-English locale file is missing the key OR has a value
 * identical to English (suspicious untranslated).
 *
 * This is a static analysis approximation — runtime detection would require
 * Playwright rendering each page in each locale.
 *
 * Output: docs/localization/fallback-report.json + console summary
 */

import fs from "fs";
import path from "path";

const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const REPORT_1B = path.resolve("scripts/i18n-reachability-report.json");
const OUT_DIR = path.resolve("docs/localization");
const OUT_PATH = path.join(OUT_DIR, "fallback-report.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

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

const enRaw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const enEntries = flattenEntries(enRaw);
const enMap = new Map(enEntries);

const ALWAYS_SAME = [
  /^\d+$/, /^https?:\/\//, /^[A-Z]{2,5}$/, /^[a-z]{1,2}$/,
  /^(My Perfect Meals|MPM|GLP-1|BMI|TDEE|AI™|™|®|No|Yes)$/,
];

const locales = fs.readdirSync(LOCALES_DIR)
  .filter(f => f.endsWith(".json") && !f.startsWith("xq") && !f.startsWith("_"))
  .map(f => f.replace(".json", ""))
  .filter(l => l !== "en");

console.log("═══════════════════════════════════════════════════════════");
console.log("  FALLBACK-TO-ENGLISH DETECTOR");
console.log("  Identifies keys that will show English to non-English users.");
console.log("═══════════════════════════════════════════════════════════\n");

const report: Record<string, {
  missingKeys: number;
  suspiciousIdentical: number;
  totalFallbacks: number;
  fallbackRate: string;
  sampleMissing: string[];
  sampleIdentical: string[];
}> = {};

for (const locale of locales) {
  const raw = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), "utf8"));
  const entries = flattenEntries(raw);
  const localeMap = new Map(entries);

  const missing = [...enMap.keys()].filter(k => !localeMap.has(k));
  const identical = entries.filter(([k, v]) => {
    const enVal = enMap.get(k);
    return enVal !== undefined && v === enVal && !ALWAYS_SAME.some(p => p.test(v));
  });

  const total = missing.length + identical.length;
  const rate = ((total / enMap.size) * 100).toFixed(1);

  report[locale] = {
    missingKeys: missing.length,
    suspiciousIdentical: identical.length,
    totalFallbacks: total,
    fallbackRate: `${rate}%`,
    sampleMissing: missing.slice(0, 3),
    sampleIdentical: identical.slice(0, 3).map(([k, v]) => `${k}: "${v}"`),
  };

  const icon = total === 0 ? "✅" : total < 50 ? "⚠️ " : "❌";
  console.log(`  ${icon}  ${locale.padEnd(4)}  ${total.toString().padStart(4)} potential fallbacks (${rate}%)  │  ${missing.length} missing + ${identical.length} suspicious-identical`);
}

fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), enKeyCount: enMap.size, locales: report }, null, 2));
console.log(`\n  Report → ${OUT_PATH}`);
console.log("  Zero production files modified.\n");
