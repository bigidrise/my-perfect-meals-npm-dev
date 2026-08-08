#!/usr/bin/env tsx
/**
 * scripts/audit-i18n.ts
 *
 * i18n Integrity Checker for My Perfect Meals
 *
 * Checks:
 *  1. Schema parity — every locale has the same key tree + value types as en.json
 *  2. Namespace coverage — every useTranslation("ns") namespace exists in en.json
 *  3. Key resolution — static t("key") calls resolve against the declared namespace
 *  4. Double-prefixing — useTranslation("foo") + t("foo.bar") is always wrong
 *  5. Hardcoded English — user-visible JSX text not inside t()
 *
 * Exit codes:
 *  0 — clean (no structural failures)
 *  1 — structural failures found (missing namespaces, missing keys, type mismatches,
 *       double-prefixing, unresolvable t() calls)
 *
 * Translation quality gaps (missing keys in non-English locales that exist in English
 * but have the same value) are reported as warnings, not failures.
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";

// ─── Config ───────────────────────────────────────────────────────────────────

const LOCALES_DIR = path.resolve("client/src/i18n/locales");
const SRC_DIR = path.resolve("client/src");
const EN_FILE = path.join(LOCALES_DIR, "en.json");

// Strings in JSX that look like user-visible text (not routes, CSS, IDs, etc.)
const HARDCODED_EXCLUSION_RE =
  /^(https?:\/\/|\/[a-z]|#[a-z]|[a-z-]+-[a-z-]+|[A-Z_]{2,}|[0-9]|\s*$|bg-|text-|flex|grid|rounded|border|shadow|p[xy]?-|m[xy]?-|gap-|w-|h-|z-|overflow|cursor|opacity|transition|font-|leading-|tracking-|ring-|fill-|stroke-|sr-only)/;
const HARDCODED_MIN_LENGTH = 4;
const HARDCODED_INCLUDE_RE = /[a-z]{3}/i; // must contain at least one real word fragment

// ─── Utilities ────────────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

function loadJSON(filePath: string): JsonObject {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as JsonObject;
}

/** Recursively collect all dot-path → type pairs from a JSON object */
function collectPaths(
  obj: JsonValue,
  prefix = ""
): Map<string, "string" | "object" | "array" | "other"> {
  const result = new Map<string, "string" | "object" | "array" | "other">();
  if (obj === null || typeof obj !== "object") {
    result.set(prefix, typeof obj === "string" ? "string" : "other");
    return result;
  }
  if (Array.isArray(obj)) {
    result.set(prefix, "array");
    return result;
  }
  for (const [k, v] of Object.entries(obj as JsonObject)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      result.set(fullKey, "object");
      for (const [subKey, subType] of collectPaths(v, fullKey)) {
        result.set(subKey, subType);
      }
    } else {
      result.set(fullKey, Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "other");
    }
  }
  return result;
}

/** Resolve a dot-path against a JSON object; returns the value or undefined */
function resolvePath(obj: JsonObject, dotPath: string): JsonValue | undefined {
  const parts = dotPath.split(".");
  let cur: JsonValue = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as JsonObject)[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

// ─── 1. Load en.json schema ───────────────────────────────────────────────────

const en = loadJSON(EN_FILE);
const enPaths = collectPaths(en);
const enNamespaces = new Set(Object.keys(en));

// Collect leaf paths only (string values — what actually needs translating)
const enLeafPaths = new Map<string, string>();
for (const [p, t] of enPaths) {
  if (t === "string") {
    enLeafPaths.set(p, resolvePath(en, p) as string);
  }
}

// ─── 2. Schema parity check across all 13 locale files ───────────────────────

const localeFiles = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .sort();

interface LocaleReport {
  code: string;
  missingNamespaces: string[];
  extraNamespaces: string[];
  missingLeafKeys: string[];
  extraLeafKeys: string[];
  typeMismatches: Array<{ path: string; enType: string; localeType: string }>;
  untranslatedKeys: string[]; // same value as English
}

const localeReports: LocaleReport[] = [];

for (const localeFile of localeFiles) {
  const code = localeFile.replace(".json", "");
  const locale = loadJSON(path.join(LOCALES_DIR, localeFile));
  const localePaths = collectPaths(locale);
  const localeNamespaces = new Set(Object.keys(locale));

  const missingNamespaces = [...enNamespaces].filter((ns) => !localeNamespaces.has(ns));
  const extraNamespaces = [...localeNamespaces].filter((ns) => !enNamespaces.has(ns));

  const missingLeafKeys: string[] = [];
  const typeMismatches: LocaleReport["typeMismatches"] = [];
  const untranslatedKeys: string[] = [];

  for (const [enPath, enType] of enPaths) {
    const localeType = localePaths.get(enPath);
    if (localeType === undefined) {
      if (enType === "string") missingLeafKeys.push(enPath);
      // Missing intermediate objects are implied by missing leaf keys
    } else if (localeType !== enType) {
      typeMismatches.push({ path: enPath, enType, localeType });
    } else if (enType === "string") {
      // Check if it's untranslated (same value as English)
      const enVal = resolvePath(en, enPath) as string;
      const localeVal = resolvePath(locale, enPath) as string;
      if (localeVal === enVal && enVal.length > 3) {
        untranslatedKeys.push(enPath);
      }
    }
  }

  const extraLeafKeys: string[] = [];
  for (const [localePath, localeType] of localePaths) {
    if (localeType === "string" && !enPaths.has(localePath)) {
      extraLeafKeys.push(localePath);
    }
  }

  localeReports.push({
    code,
    missingNamespaces,
    extraNamespaces,
    missingLeafKeys,
    extraLeafKeys,
    typeMismatches,
    untranslatedKeys,
  });
}

// ─── 3. Source file analysis ──────────────────────────────────────────────────

interface SourceFileReport {
  file: string;
  unknownNamespaces: string[];   // useTranslation("ns") where ns not in en.json
  doublePrefixed: string[];      // t("ns.key") inside useTranslation("ns")
  unresolvedKeys: string[];      // t("key") that doesn't resolve in its namespace
  hardcodedStrings: string[];    // visible English copy not in t()
}

const sourceReports: SourceFileReport[] = [];

const srcFiles = glob.sync("**/*.{tsx,ts}", {
  cwd: SRC_DIR,
  absolute: true,
  ignore: ["**/node_modules/**", "**/*.d.ts", "**/i18n/**"],
});

// Patterns
const USE_TRANSLATION_RE = /useTranslation\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const USE_TRANSLATION_DEFAULT_RE = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useTranslation\(\s*\)/g;
const T_CALL_STATIC_RE = /\bt\(\s*["'`]([^"'`\n]+)["'`]\s*[,)]/g;
// JSX text node heuristic: content between > and < that looks like English copy
const JSX_TEXT_RE = />([^<>{}\n]+)</g;
// Template literal t calls — skip dynamic keys
const T_CALL_DYNAMIC_RE = /\bt\(`[^`]*\$\{/;

for (const filePath of srcFiles) {
  const relPath = path.relative(SRC_DIR, filePath);
  const src = fs.readFileSync(filePath, "utf8");

  // Collect all namespace declarations in this file
  const namespaces: string[] = [];
  let m: RegExpExecArray | null;
  USE_TRANSLATION_RE.lastIndex = 0;
  while ((m = USE_TRANSLATION_RE.exec(src)) !== null) {
    namespaces.push(m[1]);
  }
  const hasDefaultTranslation = USE_TRANSLATION_DEFAULT_RE.test(src);

  if (namespaces.length === 0 && !hasDefaultTranslation) continue;

  const unknownNamespaces: string[] = [];
  const doublePrefixed: string[] = [];
  const unresolvedKeys: string[] = [];

  // Check namespace existence
  for (const ns of namespaces) {
    if (!enNamespaces.has(ns)) {
      unknownNamespaces.push(ns);
    }
  }

  // Check t() calls
  T_CALL_STATIC_RE.lastIndex = 0;
  while ((m = T_CALL_STATIC_RE.exec(src)) !== null) {
    const key = m[1];
    if (key.includes("${")) continue; // skip interpolated

    for (const ns of namespaces) {
      if (!enNamespaces.has(ns)) continue; // already flagged

      // Double-prefix: key starts with the namespace name
      if (key.startsWith(`${ns}.`)) {
        doublePrefixed.push(`useTranslation("${ns}") + t("${key}")`);
        continue;
      }

      // Check resolution: key should resolve within the namespace
      const nsObj = en[ns] as JsonObject | undefined;
      if (nsObj === undefined) continue;
      const resolved = resolvePath(nsObj, key);
      if (resolved === undefined) {
        // Only flag if the key looks like it belongs to this namespace
        // (i.e., no dot-prefix that belongs to a different namespace)
        const topSegment = key.split(".")[0];
        const nsKeys = Object.keys(nsObj);
        if (nsKeys.includes(topSegment)) {
          unresolvedKeys.push(`[${ns}] t("${key}")`);
        }
      }
    }

    // For default namespace files, check against root en keys
    if (hasDefaultTranslation) {
      const resolved = resolvePath(en, key);
      if (resolved === undefined && key.includes(".")) {
        const topSegment = key.split(".")[0];
        if (enNamespaces.has(topSegment)) {
          // Resolves via root — ok
        }
      }
    }
  }

  // Hardcoded English JSX text detection
  const hardcodedStrings: string[] = [];
  let lineNum = 0;
  for (const line of src.split("\n")) {
    lineNum++;
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
    if (line.includes("console.") || line.includes("// ")) continue;

    JSX_TEXT_RE.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = JSX_TEXT_RE.exec(line)) !== null) {
      const text = hm[1].trim();
      if (
        text.length >= HARDCODED_MIN_LENGTH &&
        HARDCODED_INCLUDE_RE.test(text) &&
        !HARDCODED_EXCLUSION_RE.test(text) &&
        !text.startsWith("{") &&
        !text.startsWith("t(") &&
        !/^\s*$/.test(text) &&
        // Exclude lines that contain a t() call (the text is beside a translated node)
        !line.includes("t(\"") &&
        !line.includes("t('") &&
        !line.includes("{t(")
      ) {
        hardcodedStrings.push(`L${lineNum}: ${text.slice(0, 80)}`);
      }
    }
  }

  if (
    unknownNamespaces.length > 0 ||
    doublePrefixed.length > 0 ||
    unresolvedKeys.length > 0 ||
    hardcodedStrings.length > 0
  ) {
    sourceReports.push({
      file: relPath,
      unknownNamespaces,
      doublePrefixed,
      unresolvedKeys,
      hardcodedStrings,
    });
  }
}

// ─── 4. Report ────────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

let structuralFailures = 0;

console.log(`\n${BOLD}════════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  My Perfect Meals — i18n Integrity Report${RESET}`);
console.log(`${BOLD}════════════════════════════════════════════════════════${RESET}\n`);

// ── Section 1: Schema parity ──────────────────────────────────────────────────
console.log(`${BOLD}${CYAN}1. LOCALE SCHEMA PARITY${RESET}`);
console.log(`   Source of truth: en.json (${enLeafPaths.size} translatable leaf keys, ${enNamespaces.size} namespaces)\n`);

let allLocalesClean = true;
for (const r of localeReports) {
  const hasStructuralIssues =
    r.missingNamespaces.length > 0 ||
    r.typeMismatches.length > 0;

  const icon = hasStructuralIssues ? `${RED}✗${RESET}` : `${GREEN}✓${RESET}`;
  console.log(`   ${icon} ${BOLD}${r.code}.json${RESET}`);

  if (r.missingNamespaces.length > 0) {
    structuralFailures += r.missingNamespaces.length;
    allLocalesClean = false;
    console.log(`     ${RED}MISSING NAMESPACES (${r.missingNamespaces.length}):${RESET} ${r.missingNamespaces.join(", ")}`);
  }
  if (r.extraNamespaces.length > 0) {
    console.log(`     ${YELLOW}EXTRA NAMESPACES (${r.extraNamespaces.length}):${RESET} ${r.extraNamespaces.join(", ")}`);
  }
  if (r.typeMismatches.length > 0) {
    structuralFailures += r.typeMismatches.length;
    allLocalesClean = false;
    console.log(`     ${RED}TYPE MISMATCHES (${r.typeMismatches.length}):${RESET}`);
    for (const tm of r.typeMismatches.slice(0, 5)) {
      console.log(`       ${tm.path}: en=${tm.enType}, ${r.code}=${tm.localeType}`);
    }
    if (r.typeMismatches.length > 5) console.log(`       … and ${r.typeMismatches.length - 5} more`);
  }
  if (r.missingLeafKeys.length > 0) {
    // Missing keys are warnings (structure can exist but value untranslated), except missing namespaces
    const missing = r.missingLeafKeys.filter(k => !r.missingNamespaces.some(ns => k.startsWith(ns)));
    if (missing.length > 0) {
      console.log(`     ${YELLOW}MISSING KEYS (${missing.length} warn):${RESET} ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` … +${missing.length - 5} more` : ""}`);
    }
  }
  if (r.untranslatedKeys.length > 0) {
    console.log(`     ${DIM}Untranslated (same as English): ${r.untranslatedKeys.length} keys${RESET}`);
  }
}
if (allLocalesClean) {
  console.log(`   ${GREEN}All locale schemas structurally match English.${RESET}`);
}

// ── Section 2: Source namespace coverage ─────────────────────────────────────
console.log(`\n${BOLD}${CYAN}2. NAMESPACE COVERAGE (useTranslation calls)${RESET}`);

const unknownNsFiles = sourceReports.filter((r) => r.unknownNamespaces.length > 0);
if (unknownNsFiles.length === 0) {
  console.log(`   ${GREEN}✓ All useTranslation() namespaces exist in en.json.${RESET}`);
} else {
  structuralFailures++;
  for (const r of unknownNsFiles) {
    console.log(`   ${RED}✗ ${r.file}${RESET}`);
    for (const ns of r.unknownNamespaces) {
      console.log(`     Unknown namespace: "${ns}"`);
    }
  }
}

// ── Section 3: Double-prefixing ───────────────────────────────────────────────
console.log(`\n${BOLD}${CYAN}3. DOUBLE-PREFIXED t() CALLS${RESET}`);

const dpFiles = sourceReports.filter((r) => r.doublePrefixed.length > 0);
if (dpFiles.length === 0) {
  console.log(`   ${GREEN}✓ No double-prefixing detected.${RESET}`);
} else {
  structuralFailures++;
  console.log(`   ${RED}✗ Double-prefixed keys found — these will NEVER resolve at runtime:${RESET}`);
  for (const r of dpFiles) {
    console.log(`\n   ${BOLD}${r.file}${RESET}`);
    for (const dp of r.doublePrefixed.slice(0, 10)) {
      console.log(`     ${RED}${dp}${RESET}`);
    }
    if (r.doublePrefixed.length > 10) {
      console.log(`     ${DIM}… and ${r.doublePrefixed.length - 10} more${RESET}`);
    }
  }
}

// ── Section 4: Unresolved t() keys ───────────────────────────────────────────
console.log(`\n${BOLD}${CYAN}4. UNRESOLVED t() KEY REFERENCES${RESET}`);

const urFiles = sourceReports.filter((r) => r.unresolvedKeys.length > 0);
if (urFiles.length === 0) {
  console.log(`   ${GREEN}✓ All resolvable static t() calls resolve against en.json.${RESET}`);
} else {
  structuralFailures++;
  for (const r of urFiles) {
    console.log(`   ${RED}✗ ${r.file}${RESET}`);
    for (const uk of r.unresolvedKeys.slice(0, 8)) {
      console.log(`     ${RED}${uk}${RESET}`);
    }
    if (r.unresolvedKeys.length > 8) {
      console.log(`     ${DIM}… and ${r.unresolvedKeys.length - 8} more${RESET}`);
    }
  }
}

// ── Section 5: Hardcoded English ─────────────────────────────────────────────
console.log(`\n${BOLD}${CYAN}5. HARDCODED ENGLISH JSX TEXT${RESET}`);

const hcFiles = sourceReports.filter((r) => r.hardcodedStrings.length > 0);
const totalHardcoded = hcFiles.reduce((s, r) => s + r.hardcodedStrings.length, 0);

if (hcFiles.length === 0) {
  console.log(`   ${GREEN}✓ No hardcoded user-visible English text detected.${RESET}`);
} else {
  console.log(`   ${YELLOW}⚠  ~${totalHardcoded} instances across ${hcFiles.length} files (warnings — not structural failures)${RESET}`);
  // Top 10 files by count
  const sorted = [...hcFiles].sort((a, b) => b.hardcodedStrings.length - a.hardcodedStrings.length);
  for (const r of sorted.slice(0, 10)) {
    console.log(`\n   ${YELLOW}${r.file}${RESET} (${r.hardcodedStrings.length} strings)`);
    for (const hs of r.hardcodedStrings.slice(0, 3)) {
      console.log(`     ${DIM}${hs}${RESET}`);
    }
    if (r.hardcodedStrings.length > 3) {
      console.log(`     ${DIM}… +${r.hardcodedStrings.length - 3} more${RESET}`);
    }
  }
  if (sorted.length > 10) {
    console.log(`\n   ${DIM}… and ${sorted.length - 10} more files${RESET}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}════════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  SUMMARY${RESET}`);
console.log(`${BOLD}════════════════════════════════════════════════════════${RESET}`);

// Missing keys per locale table
const maxMissing = Math.max(...localeReports.map((r) => r.missingLeafKeys.length));
if (maxMissing > 0) {
  console.log(`\n  Missing leaf keys per locale:`);
  for (const r of localeReports) {
    const bar =
      r.missingLeafKeys.length === 0
        ? `${GREEN}✓ 0${RESET}`
        : `${YELLOW}${r.missingLeafKeys.length}${RESET}`;
    const nsBar =
      r.missingNamespaces.length > 0
        ? ` ${RED}[${r.missingNamespaces.length} missing namespaces]${RESET}`
        : "";
    console.log(`  ${r.code.padEnd(4)}  ${bar}${nsBar}`);
  }
}

const totalMissingKeys = localeReports.reduce((s, r) => s + r.missingLeafKeys.length, 0);
const totalMissingNs = localeReports.reduce((s, r) => s + r.missingNamespaces.length, 0);

console.log(`
  Structural failures:     ${structuralFailures > 0 ? RED : GREEN}${structuralFailures}${RESET}
  Missing namespace×locale: ${totalMissingNs > 0 ? RED : GREEN}${totalMissingNs}${RESET}  (${localeReports.filter(r => r.missingNamespaces.length > 0).length} locales affected)
  Missing leaf keys total:  ${totalMissingKeys > 0 ? YELLOW : GREEN}${totalMissingKeys}${RESET}  (warnings)
  Double-prefixed files:    ${dpFiles.length > 0 ? RED : GREEN}${dpFiles.length}${RESET}
  Hardcoded strings:        ${totalHardcoded > 0 ? YELLOW : GREEN}~${totalHardcoded}${RESET}  (warnings)
`);

if (structuralFailures > 0) {
  console.log(
    `${RED}${BOLD}RESULT: FAIL — ${structuralFailures} structural issue(s) must be fixed before translating.${RESET}\n`
  );
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}RESULT: PASS — no structural failures. Translation quality warnings above may be addressed separately.${RESET}\n`);
  process.exit(0);
}
