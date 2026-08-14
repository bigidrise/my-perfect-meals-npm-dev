#!/usr/bin/env tsx
/**
 * Pseudo-locale Generator — Phase 0 Localization Infrastructure
 *
 * Generates client/src/i18n/locales/xq.json — a ~40% expanded pseudo-locale
 * that deliberately stresses layouts with longer strings and unusual characters.
 *
 * Use in Playwright tests to expose fixed-height containers, button overflow,
 * and clipped text BEFORE committing to real translations.
 *
 * Usage:
 *   npx tsx scripts/pseudo-locale-gen.ts
 *   # → writes client/src/i18n/locales/xq.json
 */

import fs from "fs";
import path from "path";

const EN_PATH = path.resolve("client/src/i18n/locales/en.json");
const OUT_PATH = path.resolve("client/src/i18n/locales/xq.json");

/**
 * Pseudo-localise a single string value:
 * - Expands vowels to roughly +40% length
 * - Wraps with markers so pseudo strings are visually identifiable
 * - Preserves {{interpolation}} variables untouched
 * - Preserves HTML tags untouched
 * - Preserves URLs, numbers, and punctuation-only strings
 */
function pseudoLocalize(str: string): string {
  // Don't expand URLs, numbers only, or single-char strings
  if (/^https?:\/\//.test(str)) return str;
  if (/^\d+$/.test(str)) return str;
  if (str.trim().length <= 1) return str;

  // Split on {{...}} variables and HTML tags — preserve them verbatim
  const parts = str.split(/(\{\{[^}]+\}\}|<[^>]+>)/g);

  const expanded = parts
    .map((part, i) => {
      // Even indices are plain text; odd are preserved tokens
      if (i % 2 === 1) return part; // variable or tag — preserve as-is

      // Expand vowels: each vowel becomes itself + a diacritic repeat
      return part.replace(/[aeiouAEIOU]/g, (c) => {
        const map: Record<string, string> = {
          a: "áã", A: "ÁÃ",
          e: "éè", E: "ÉÈ",
          i: "íï", I: "ÍÏ",
          o: "ôö", O: "ÔÖ",
          u: "ûü", U: "ÛÜ",
        };
        return map[c] ?? c;
      });
    })
    .join("");

  // Wrap to mark as pseudo-locale and add tail padding for extra width
  return `[${expanded} ŦŦŦ]`;
}

function pseudoLocalizeDeep(obj: unknown): unknown {
  if (typeof obj === "string") return pseudoLocalize(obj);
  if (Array.isArray(obj)) return obj.map(pseudoLocalizeDeep);
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        pseudoLocalizeDeep(v),
      ])
    );
  }
  return obj;
}

const en = JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
const pseudo = pseudoLocalizeDeep(en);

// Add metadata
const out = {
  _meta: {
    locale: "xq",
    name: "Pseudo-locale (layout stress test)",
    description: "~40% expanded English. Use in Playwright responsive/RTL tests. Never ship to users.",
    generated: new Date().toISOString(),
    basedOn: "en.json",
  },
  ...(pseudo as Record<string, unknown>),
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

// Stats
function countStrings(obj: unknown): number {
  if (typeof obj === "string") return 1;
  if (Array.isArray(obj)) return obj.reduce<number>((s, v) => s + countStrings(v), 0);
  if (typeof obj === "object" && obj !== null)
    return Object.values(obj as Record<string, unknown>).reduce<number>((s, v) => s + countStrings(v), 0);
  return 0;
}

const total = countStrings(en);
console.log(`✅ Pseudo-locale generated: ${OUT_PATH}`);
console.log(`   Strings processed: ${total}`);
console.log(`   Use locale code "xq" in Playwright tests.`);
console.log(`   Example: await page.evaluate(() => window.__i18n?.changeLanguage("xq"))`);
