#!/usr/bin/env tsx
/**
 * Clinical Translation Candidate Generator — Controlled Review Workflow
 *
 * Generates (or updates) a per-locale review manifest for the 138 protected
 * clinical strings in docs/localization/clinical-registry.json.
 *
 * Workflow:
 *   1. Generate manifest:      npx tsx scripts/i18n-clinical-translate.ts --locale es
 *   2. (Optional) AI proposals: npx tsx scripts/i18n-clinical-translate.ts --locale es --propose
 *   3. A qualified clinical reviewer edits the manifest: sets status to
 *      "approved" or "rejected", fills reviewer + reviewedAt.
 *   4. Only approved entries may land in client/src/i18n/locales/<locale>.json.
 *      GATE_07 (scripts/i18n-phase0-validate.ts) enforces this.
 *
 * Manifest: docs/localization/clinical-review/<locale>.review.json
 *
 * Re-running is safe: existing entries (including reviewer decisions) are
 * preserved; a decision is reset to "pending" only if the English source text
 * for that key has changed since it was reviewed.
 */

import fs from "fs";
import path from "path";

const REGISTRY_PATH = path.resolve("docs/localization/clinical-registry.json");
const REVIEW_DIR = path.resolve("docs/localization/clinical-review");
const LOCALES_DIR = path.resolve("client/src/i18n/locales");

interface RegistryString {
  file: string;
  line: number;
  text: string;
  category: string;
  proposedKey: string;
}

export interface ReviewEntry {
  key: string;
  sourceText: string;          // canonical English source (from registry)
  category: string;
  file: string;
  proposedTranslation: string; // candidate translation — filled by tool or translator
  status: "pending" | "approved" | "rejected";
  reviewer: string | null;     // name/credential of the clinical reviewer
  reviewedAt: string | null;   // ISO timestamp when the decision was made
  notes: string | null;        // optional reviewer notes / rejection reason
}

export interface ReviewManifest {
  _meta: {
    description: string;
    locale: string;
    generatedAt: string;
    registryTotal: number;
    governanceRule: string;
  };
  entries: ReviewEntry[];
}

// ── CLI args ───────────────────────────────────────────────────────────────
function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const locale = argValue("--locale");
const PROPOSE = process.argv.includes("--propose");

if (!locale) {
  console.error("Usage: npx tsx scripts/i18n-clinical-translate.ts --locale <code> [--propose]");
  console.error("Locales are processed one at a time by design (controlled review).");
  process.exit(1);
}
if (locale === "en") {
  console.error("en is the source language — no review manifest needed.");
  process.exit(1);
}
const localeFile = path.join(LOCALES_DIR, `${locale}.json`);
if (!fs.existsSync(localeFile)) {
  console.error(`Unknown locale "${locale}" — no file at ${localeFile}`);
  process.exit(1);
}

// ── Load registry + existing manifest ──────────────────────────────────────
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
const rawStrings: RegistryString[] = registry.allStrings ?? [];

// Registry identity must be unique: reject key/text conflicts, and collapse
// repeated occurrences of the same key+text (same string on multiple lines)
// into a single review entry.
const byKey = new Map<string, RegistryString>();
for (const s of rawStrings) {
  const prev = byKey.get(s.proposedKey);
  if (prev && prev.text !== s.text) {
    console.error(`FATAL: registry key "${s.proposedKey}" maps to different source texts:`);
    console.error(`  "${prev.text}"`);
    console.error(`  "${s.text}"`);
    console.error("Regenerate the registry: npx tsx scripts/i18n-clinical-registry.ts");
    process.exit(1);
  }
  if (!prev) byKey.set(s.proposedKey, s);
}
const strings = [...byKey.values()];

fs.mkdirSync(REVIEW_DIR, { recursive: true });
const manifestPath = path.join(REVIEW_DIR, `${locale}.review.json`);

let existing: Map<string, ReviewEntry> = new Map();
if (fs.existsSync(manifestPath)) {
  const prev: ReviewManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  existing = new Map(prev.entries.map(e => [e.key, e]));
}

// Existing locale values, in case a clinical key already has a value on disk.
function flatten(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out.set(full, v);
      else for (const [k2, v2] of flatten(v, full)) out.set(k2, v2);
    }
  }
  return out;
}
const localeValues = flatten(JSON.parse(fs.readFileSync(localeFile, "utf8")));

// ── Build entries (preserving prior decisions) ─────────────────────────────
let preserved = 0, reset = 0, created = 0;
const entries: ReviewEntry[] = strings.map(s => {
  const prev = existing.get(s.proposedKey);
  if (prev) {
    if (prev.sourceText !== s.text) {
      // English source changed since review — decision is stale, reset it.
      reset++;
      return {
        ...prev,
        sourceText: s.text,
        category: s.category,
        file: s.file,
        status: "pending",
        reviewer: null,
        reviewedAt: null,
        notes: `Source text changed since prior review (was: "${prev.sourceText}") — re-review required.`,
      };
    }
    preserved++;
    return { ...prev, category: s.category, file: s.file };
  }
  created++;
  return {
    key: s.proposedKey,
    sourceText: s.text,
    category: s.category,
    file: s.file,
    proposedTranslation: localeValues.get(s.proposedKey) ?? "",
    status: "pending",
    reviewer: null,
    reviewedAt: null,
    notes: null,
  };
});

// ── Optional: AI-generated candidates for pending, empty proposals ─────────
async function proposeWithAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("--propose requires OPENAI_API_KEY in the environment.");
    process.exit(1);
  }
  const targets = entries.filter(e => e.status === "pending" && !e.proposedTranslation);
  console.log(`Generating AI candidates for ${targets.length} pending strings (locale: ${locale})…`);

  const BATCH = 25;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const payload = batch.map(e => ({ key: e.key, text: e.sourceText, category: e.category }));
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `You are a professional medical translator translating clinical/patient-safety UI strings ` +
              `from English to the locale "${locale}". These strings cover diabetes/GLP-1, medication, ` +
              `allergy safety, lab values, pregnancy and pediatric guidance. Accuracy is a patient-safety ` +
              `requirement: never soften warnings, never change clinical meaning, preserve medical terms ` +
              `(GLP-1, HbA1c, BMI), preserve any {{placeholders}} and emoji exactly. ` +
              `Return a JSON object mapping each key to its translation: {"translations": {"<key>": "<translation>", ...}}. ` +
              `These are CANDIDATES for human clinical review, not final translations.`,
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const out = JSON.parse(data.choices[0].message.content).translations ?? {};
    for (const e of batch) {
      if (typeof out[e.key] === "string" && out[e.key].trim()) {
        e.proposedTranslation = out[e.key].trim();
      }
    }
    console.log(`  batch ${Math.floor(i / BATCH) + 1}: ${batch.length} candidates generated`);
  }
}

// ── Write manifest ─────────────────────────────────────────────────────────
async function main() {
  if (PROPOSE) await proposeWithAI();

  const manifest: ReviewManifest = {
    _meta: {
      description:
        "Clinical translation review manifest. Every protected clinical string must have an " +
        "APPROVED entry here (matching the locale file value exactly) before it may ship in this locale. " +
        "Enforced by GATE_07 in scripts/i18n-phase0-validate.ts.",
      locale: locale!,
      generatedAt: new Date().toISOString(),
      registryTotal: strings.length,
      governanceRule: registry._meta?.governanceRule ?? "",
    },
    entries,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const counts = { pending: 0, approved: 0, rejected: 0 };
  for (const e of entries) counts[e.status]++;
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  CLINICAL REVIEW MANIFEST — ${locale}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Entries:   ${entries.length} (new: ${created}, preserved: ${preserved}, reset stale: ${reset})`);
  console.log(`  Status:    pending ${counts.pending} | approved ${counts.approved} | rejected ${counts.rejected}`);
  console.log(`  Output:    ${manifestPath}`);
  console.log("  Next: clinical reviewer approves/rejects entries, then approved");
  console.log("  translations may be added to the locale file ([clinical-translation] PR).");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(err => { console.error(err); process.exit(1); });
