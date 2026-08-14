#!/usr/bin/env tsx
/**
 * Global Localization Audit — Step 1
 * Scans all user-facing client components and classifies hardcoded strings.
 * Read-only: touches ZERO production files.
 *
 * Classification:
 *   SAFE_AUTOMATION   — simple static copy, safe for mechanical t() conversion
 *   REVIEW_REQUIRED   — interpolation, variables, clinical copy, arrays, conditionals
 *   EXEMPT            — brand names, URLs, technical constants, identifiers
 *
 * Output: scripts/i18n-audit-report.json  (machine) + console (human summary)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_SRC = path.resolve("client/src");
const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const REPORT_PATH = path.resolve("scripts/i18n-audit-report.json");

// Strings that are always EXEMPT (regex patterns matched against the string value)
const EXEMPT_PATTERNS: RegExp[] = [
  /^https?:\/\//i,                          // URLs
  /^\/[a-z0-9\-_/]+$/i,                    // route paths
  /^\d[\d.,:%\-\s]*$/,                      // numbers / percentages / ranges
  /^[A-Z_]{3,}$/,                           // ALL_CAPS_CONSTANTS
  /^[a-z][a-zA-Z0-9]*\.[a-z]{2,4}$/,       // filenames like foo.png
  /^#[0-9a-f]{3,8}$/i,                      // CSS color hex
  /^\s*$/,                                  // whitespace only
  /^[a-z0-9_-]+$/i,                         // identifiers (no spaces)
  /^(true|false|null|undefined)$/,          // JS literals
];

// Brand / product names always EXEMPT
const EXEMPT_LITERALS = new Set([
  "My Perfect Meals",
  "My Perfect Pregnancy",
  "ProCare",
  "GLP-1",
  "GLP1",
  "BMI",
  "API",
  "OK",
  "ID",
]);

// Signals that a string is REVIEW_REQUIRED
const REVIEW_SIGNALS: RegExp[] = [
  /\$\{/,                                   // template literal interpolation
  /\bpatient\b|\bclinical\b|\bmedical\b|\bdiagnos|\btherapy|\btreatment|\bsymptom|\bdose|\bprescri/i,
  /\bwarning\b|\balert\b|\bdanger\b|\bimportant notice\b/i,
  /\bplural|\bcount\b.*\bitem/i,
  /^(if|when|for|while)\b/i,               // conditional-looking copy
];

// Words/patterns that suggest clinical safety copy
const CLINICAL_SIGNALS: RegExp[] = [
  /\b(consult|physician|doctor|dietitian|healthcare|medical|clinical|diagnosis|treatment|symptom|medication|dose|prescription|allergy|allergen|gluten|celiac|anaphylaxis|epinephrine|insulin|glucose|HbA1c|A1c|GLP|semaglutide|ozempic|wegovy|diabetes|diabetic|hypertension|cholesterol|triglyceride)\b/i,
];

// Shared component directories — these get priority flag
const SHARED_COMPONENT_PATHS = [
  "client/src/components",
  "client/src/layout",
  "client/src/layouts",
  "client/src/lib",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAllTsxFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, test dirs, type-only dirs
        if (["node_modules", "__tests__", "test", ".vite", "dist"].includes(entry.name)) continue;
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".tsx") &&
        !entry.name.endsWith(".test.tsx") &&
        !entry.name.endsWith(".spec.tsx")
      ) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

function isExempt(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length < 2) return true;
  if (EXEMPT_LITERALS.has(trimmed)) return true;
  for (const pat of EXEMPT_PATTERNS) if (pat.test(trimmed)) return true;
  return false;
}

function classify(str: string, context: string): "SAFE_AUTOMATION" | "REVIEW_REQUIRED" | "EXEMPT" | "CLINICAL_SAFETY" {
  if (isExempt(str)) return "EXEMPT";
  for (const pat of CLINICAL_SIGNALS) {
    if (pat.test(str)) return "CLINICAL_SAFETY";
  }
  for (const pat of REVIEW_SIGNALS) {
    if (pat.test(str) || pat.test(context)) return "REVIEW_REQUIRED";
  }
  // Template literals in context
  if (context.includes("`") || context.includes("${")) return "REVIEW_REQUIRED";
  // Multi-line / long copy  
  if (str.split(" ").length > 20) return "REVIEW_REQUIRED";
  return "SAFE_AUTOMATION";
}

function proposeKey(filePath: string, str: string): string {
  const rel = path.relative(CLIENT_SRC, filePath);
  const parts = rel.replace(/\.tsx$/, "").split(path.sep);
  const ns = parts[parts.length - 1]
    .replace(/([A-Z])/g, (m) => m.toLowerCase())
    .replace(/[^a-z0-9]/g, "");
  const key = str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");
  return `${ns}.${key}`;
}

function isSharedComponent(filePath: string): boolean {
  return SHARED_COMPONENT_PATHS.some((p) => filePath.startsWith(path.resolve(p)));
}

// ── JSX String Extraction ────────────────────────────────────────────────────
// Extract hardcoded strings from TSX source.
// We look for:
//   1. JSX text content between tags (not inside {})
//   2. String literals in JSX attributes like title="..." placeholder="..."
//   3. Strings in arrays/objects that look user-facing (label:, title:, description:, text:, message:)
function extractHardcodedStrings(source: string, filePath: string): Array<{
  line: number;
  original: string;
  context: string;
  inJSX: boolean;
  inConfig: boolean;
}> {
  const results: Array<{ line: number; original: string; context: string; inJSX: boolean; inConfig: boolean }> = [];
  const lines = source.split("\n");

  // Pattern 1: JSX text content — text between > and < that is not whitespace-only and contains letters
  // We look for lines containing JSX-like text (not inside braces)
  const jsxTextPattern = />([^<>{}\n]+)</g;
  
  // Pattern 2: String literals in JSX props
  const jsxPropPattern = /(?:title|label|placeholder|aria-label|alt|description|tooltip|message|text|heading|subheading|caption|helper|hint|buttonText|actionLabel)=["']([^"']+)["']/g;
  
  // Pattern 3: Object/array labels
  const configPattern = /(?:label|title|description|text|message|heading|name|placeholder|body|subtitle|copy|content):\s*["']([^"']{2,})["']/g;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();
    
    // Skip lines that are comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    // Skip import/export lines
    if (trimmed.startsWith("import ") || trimmed.startsWith("export type") || trimmed.startsWith("export interface")) return;
    // Skip lines that already use t()
    if (/\bt\s*\(/.test(line) || /useTranslation/.test(line)) return;
    // Skip console.log/error lines
    if (/console\.(log|error|warn|info)/.test(line)) return;
    
    // Pattern 1: JSX text
    let m: RegExpExecArray | null;
    const jsxCopy = jsxTextPattern;
    jsxCopy.lastIndex = 0;
    while ((m = jsxCopy.exec(line)) !== null) {
      const str = m[1].trim();
      if (str.length >= 2 && /[a-zA-Z]/.test(str) && !str.includes("{") && !str.includes("}")) {
        results.push({ line: lineNum, original: str, context: line, inJSX: true, inConfig: false });
      }
    }
    
    // Pattern 2: JSX props
    const propCopy = /(?:title|label|placeholder|aria-label|alt|description|tooltip|message|text|heading|subheading|caption|helper|hint|buttonText|actionLabel)=["']([^"']{2,})["']/g;
    propCopy.lastIndex = 0;
    while ((m = propCopy.exec(line)) !== null) {
      const str = m[1].trim();
      if (/[a-zA-Z]/.test(str)) {
        results.push({ line: lineNum, original: str, context: line, inJSX: true, inConfig: false });
      }
    }
    
    // Pattern 3: Config objects
    const confCopy = /(?:label|title|description|text|message|heading|name|placeholder|body|subtitle|copy|content):\s*["']([^"']{2,})["']/g;
    confCopy.lastIndex = 0;
    while ((m = confCopy.exec(line)) !== null) {
      const str = m[1].trim();
      if (/[a-zA-Z]/.test(str)) {
        results.push({ line: lineNum, original: str, context: line, inJSX: false, inConfig: true });
      }
    }
  });

  // Deduplicate by line+string
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.line}:${r.original}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fileUsesTranslation(source: string): boolean {
  return /useTranslation|from ['"]react-i18next['"]/.test(source);
}

function countTCalls(source: string): number {
  return (source.match(/\bt\s*\(/g) || []).length;
}

// ── Locale Key Parity ─────────────────────────────────────────────────────────
function getLocaleKeys(locale: string): Set<string> {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) return new Set();
  
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = new Set<string>();
  
  function walk(node: unknown, prefix: string) {
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "string") {
          keys.add(full);
        } else {
          walk(v, full);
        }
      }
    }
  }
  walk(obj, "");
  return keys;
}

// ── Main Audit ────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  GLOBAL LOCALIZATION AUDIT — Step 1: Detection & Classification");
  console.log("  Read-only scan. Zero production files modified.");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Locale key parity
  console.log("── [1/3] Locale Key Parity ─────────────────────────────────");
  const locales = fs.readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
  
  const enKeys = getLocaleKeys("en");
  console.log(`  English (baseline): ${enKeys.size} keys`);
  
  const parityReport: Record<string, { missing: number; missingKeys: string[]; extra: number }> = {};
  for (const locale of locales) {
    if (locale === "en") continue;
    const keys = getLocaleKeys(locale);
    const missing = [...enKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !enKeys.has(k));
    parityReport[locale] = { missing: missing.length, missingKeys: missing.slice(0, 20), extra: extra.length };
    console.log(`  ${locale.padEnd(4)}: ${keys.size} keys, ${missing.length} missing from en, ${extra.length} extra`);
  }

  // 2. Component scan
  console.log("\n── [2/3] Component Scan ─────────────────────────────────────");
  const allFiles = getAllTsxFiles(CLIENT_SRC);
  console.log(`  Total .tsx files to scan: ${allFiles.length}`);

  type Finding = {
    file: string;
    relPath: string;
    line: number;
    original: string;
    classification: string;
    reason: string;
    proposedKey: string;
    isSharedComponent: boolean;
    inJSX: boolean;
    inConfig: boolean;
  };

  const findings: Finding[] = [];
  
  let filesWithTranslation = 0;
  let filesWithoutTranslation = 0;
  let filesWithHardcoded = 0;
  let totalTCalls = 0;
  const untranslatedFiles: string[] = [];
  const filesWithBoth: string[] = []; // has t() AND hardcoded strings
  
  for (const file of allFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relPath = path.relative(process.cwd(), file);
    const hasTranslation = fileUsesTranslation(source);
    const tCalls = countTCalls(source);
    totalTCalls += tCalls;
    
    if (hasTranslation) {
      filesWithTranslation++;
    } else {
      filesWithoutTranslation++;
    }
    
    const raw = extractHardcodedStrings(source, file);
    
    // Filter out exempt-looking strings at file level
    const meaningful = raw.filter((r) => !isExempt(r.original));
    
    if (meaningful.length > 0) {
      filesWithHardcoded++;
      if (!hasTranslation) {
        untranslatedFiles.push(relPath);
      } else {
        filesWithBoth.push(relPath);
      }
      
      for (const r of meaningful) {
        const cls = classify(r.original, r.context);
        let reason = "";
        if (cls === "EXEMPT") continue; // double-check
        if (cls === "CLINICAL_SAFETY") reason = "Clinical/medical terminology — requires expert review";
        else if (cls === "REVIEW_REQUIRED") reason = "Interpolation, conditional, or complex copy";
        else reason = "Static UI label — safe for mechanical extraction";
        
        findings.push({
          file,
          relPath,
          line: r.line,
          original: r.original,
          classification: cls,
          reason,
          proposedKey: proposeKey(file, r.original),
          isSharedComponent: isSharedComponent(file),
          inJSX: r.inJSX,
          inConfig: r.inConfig,
        });
      }
    }
  }

  // 3. Summarise
  const safe = findings.filter((f) => f.classification === "SAFE_AUTOMATION");
  const review = findings.filter((f) => f.classification === "REVIEW_REQUIRED");
  const clinical = findings.filter((f) => f.classification === "CLINICAL_SAFETY");
  const sharedFindings = findings.filter((f) => f.isSharedComponent);

  // Top shared components by finding count
  const sharedFileCounts: Record<string, number> = {};
  for (const f of sharedFindings) {
    sharedFileCounts[f.relPath] = (sharedFileCounts[f.relPath] || 0) + 1;
  }
  const topShared = Object.entries(sharedFileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Top untranslated page files  
  const pageFileCounts: Record<string, number> = {};
  for (const f of findings.filter(x => !x.isSharedComponent)) {
    pageFileCounts[f.relPath] = (pageFileCounts[f.relPath] || 0) + 1;
  }
  const topPages = Object.entries(pageFileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  // Files with zero translation AND hardcoded strings (fully untranslated surfaces)
  const fullyUntranslated = untranslatedFiles;

  console.log("\n── [3/3] Results ────────────────────────────────────────────");
  console.log(`\n  FILES SCANNED:              ${allFiles.length}`);
  console.log(`  Files using useTranslation: ${filesWithTranslation}`);
  console.log(`  Files with NO translation:  ${filesWithoutTranslation}`);
  console.log(`  Files with hardcoded text:  ${filesWithHardcoded}`);
  console.log(`    → Fully untranslated:     ${fullyUntranslated.length}`);
  console.log(`    → Partially translated:   ${filesWithBoth.length}`);
  console.log(`  Total t() calls in codebase:${totalTCalls}`);
  console.log(`\n  HARDCODED STRING FINDINGS:  ${findings.length}`);
  console.log(`    SAFE_AUTOMATION:          ${safe.length}`);
  console.log(`    REVIEW_REQUIRED:          ${review.length}`);
  console.log(`    CLINICAL_SAFETY:          ${clinical.length}`);
  console.log(`    In shared components:     ${sharedFindings.length} (across ${Object.keys(sharedFileCounts).length} files)`);
  console.log(`    In page-level files:      ${findings.length - sharedFindings.length}`);
  
  console.log("\n  TOP SHARED COMPONENTS BY HARDCODED STRINGS (migration priority):");
  for (const [file, count] of topShared) {
    console.log(`    ${count.toString().padStart(4)}  ${file}`);
  }

  console.log("\n  TOP UNTRANSLATED PAGE FILES:");
  for (const [file, count] of topPages.slice(0, 20)) {
    console.log(`    ${count.toString().padStart(4)}  ${file}`);
  }

  console.log("\n  LOCALE PARITY GAPS:");
  for (const [locale, data] of Object.entries(parityReport).sort((a, b) => b[1].missing - a[1].missing)) {
    if (data.missing > 0) {
      console.log(`    ${locale.padEnd(4)}: ${data.missing} missing keys`);
    }
  }

  console.log("\n  NOTE — AI WRAPPER COVERAGE:");
  console.log("  openaiSafe.ts is NOT universal. ~30+ server files bypass it");
  console.log("  and instantiate their own OpenAI client. Language injection");
  console.log("  via a single wrapper change is NOT safe without a prior audit.");

  // Write machine report
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      filesScanned: allFiles.length,
      filesUsingTranslation: filesWithTranslation,
      filesWithNoTranslation: filesWithoutTranslation,
      filesWithHardcodedStrings: filesWithHardcoded,
      fullyUntranslatedSurfaces: fullyUntranslated.length,
      partiallyTranslatedSurfaces: filesWithBoth.length,
      totalTCalls: totalTCalls,
      totalHardcodedFindings: findings.length,
      safeAutomation: safe.length,
      reviewRequired: review.length,
      clinicalSafety: clinical.length,
      inSharedComponents: sharedFindings.length,
      sharedComponentFilesAffected: Object.keys(sharedFileCounts).length,
    },
    localeParity: parityReport,
    topSharedComponentsByFindingCount: topShared,
    topUntranslatedPageFiles: topPages,
    fullyUntranslatedFiles: fullyUntranslated,
    findings: findings.slice(0, 2000), // cap to keep JSON manageable
    totalFindingsBeforeCap: findings.length,
    aiWrapperNote: "openaiSafe.ts is not universal — ~30+ routes bypass it. Language injection requires separate per-route audit before implementation.",
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n  Machine report written to: ${REPORT_PATH}`);
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  AUDIT COMPLETE — no production files were modified.");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
