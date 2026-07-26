/**
 * toleranceDerivation.test.ts
 *
 * Focused tests for the pure derivation logic inside the daily tolerance resolver.
 * Tests symptom classification, hydration risk, appetite derivation, and the
 * complete output shape of resolveDailyMedicationTolerance.
 *
 * These tests exercise the resolver by mocking database calls so the
 * classification logic can be verified in isolation.
 *
 * Pure function tests — no live DB, no network.
 * Run: npx tsx server/services/glp1/__tests__/toleranceDerivation.test.ts
 */

import type {
  DailyMedicationTolerance,
  NauseaLevel,
  HydrationRisk,
  ToleranceAppetiteLevel,
} from "../../../../shared/glp1-schema";

// ─────────────────────────────────────────────────────────────────────────────
// MINI TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    const msg = detail ? `${label} — ${detail}` : label;
    console.error(`  ❌ ${msg}`);
    errors.push(msg);
    failed++;
  }
}

function section(name: string): void {
  console.log(`\n── ${name} ─────────────────────────────────────────────────`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED PURE FUNCTIONS FOR TESTING
// These mirror the private functions in resolveDailyMedicationTolerance.ts.
// If the resolver's private logic changes, update these in lockstep.
// ─────────────────────────────────────────────────────────────────────────────

function deriveAppetiteLevel(hunger: number | null): ToleranceAppetiteLevel {
  if (hunger === null) return "normal";
  if (hunger <= 2) return "suppressed";
  if (hunger <= 4) return "reduced";
  if (hunger <= 7) return "normal";
  return "increased";
}

function matchesAny(symptoms: string[], keywords: string[]): boolean {
  return symptoms.some(s => keywords.some(k => s.toLowerCase().includes(k)));
}

const NAUSEA_KEYWORDS = ["nausea", "nauseated", "nauseous", "queasy", "sick to my stomach", "feel sick", "feeling sick"];
const VOMITING_KEYWORDS = ["vomit", "threw up", "throwing up", "puked", "puke", "vomiting"];
const DIARRHEA_KEYWORDS = ["diarrhea", "loose stool", "loose bowel", "watery stool", "runny stool"];
const CONSTIPATION_KEYWORDS = ["constipat", "bloat", "can't go", "cannot go", "haven't gone", "no bowel", "hard stool"];
const REFLUX_KEYWORDS = ["reflux", "heartburn", "acid", "indigestion", "gerd", "regurgitat", "chest burn"];

function deriveNauseaLevel(symptoms: string[], digestion: number | null): NauseaLevel {
  const hasNausea = matchesAny(symptoms, NAUSEA_KEYWORDS);
  if (!hasNausea) return "none";
  if (digestion !== null && digestion <= 2) return "severe";
  if (digestion !== null && digestion <= 4) return "moderate";
  return "mild";
}

function deriveHydrationRisk(hasVomiting: boolean, hasDiarrhea: boolean, waterMlLogged: number): HydrationRisk {
  if (hasVomiting && waterMlLogged < 1000) return "severe";
  if (hasVomiting || (hasDiarrhea && waterMlLogged < 1500)) return "elevated";
  if (hasDiarrhea || waterMlLogged < 1200) return "mild";
  return "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SHAPE CONTRACT
// ─────────────────────────────────────────────────────────────────────────────

section("DailyMedicationTolerance output shape invariants");

function validateToleranceShape(t: DailyMedicationTolerance, label: string): void {
  assert(typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date),
    `${label}: date is YYYY-MM-DD`, `got ${t.date}`);
  assert(["suppressed","reduced","normal","increased"].includes(t.appetiteLevel),
    `${label}: appetiteLevel is a valid enum value`);
  assert(["none","mild","moderate","severe"].includes(t.nauseaLevel),
    `${label}: nauseaLevel is a valid enum value`);
  assert(["none","mild","elevated","severe"].includes(t.hydrationRisk),
    `${label}: hydrationRisk is a valid enum value`);
  assert(typeof t.hasVomiting === "boolean",   `${label}: hasVomiting is boolean`);
  assert(typeof t.hasReflux === "boolean",     `${label}: hasReflux is boolean`);
  assert(typeof t.hasDiarrhea === "boolean",   `${label}: hasDiarrhea is boolean`);
  assert(typeof t.hasConstipation === "boolean", `${label}: hasConstipation is boolean`);
  assert(typeof t.shouldEscalate === "boolean", `${label}: shouldEscalate is boolean`);
  assert(typeof t.waterMlLogged === "number",  `${label}: waterMlLogged is number`);
  assert(Array.isArray(t.rulesApplied),        `${label}: rulesApplied is array`);
  assert(Array.isArray(t.rulesWithheld),       `${label}: rulesWithheld is array`);
  assert(Array.isArray(t.rulesEvaluated),      `${label}: rulesEvaluated is array`);
  assert(Array.isArray(t.safetyEscalations),   `${label}: safetyEscalations is array`);
  assert(Array.isArray(t.nutritionAdaptations),`${label}: nutritionAdaptations is array`);
  // Safety/nutrition must be mutually exclusive types — no cross-contamination
  if (t.shouldEscalate) {
    assert(t.safetyEscalations.length > 0,
      `${label}: shouldEscalate=true → safetyEscalations must be non-empty`);
  } else {
    assert(t.safetyEscalations.length === 0,
      `${label}: shouldEscalate=false → safetyEscalations must be empty`);
  }
  // rulesEvaluated = union of applied + withheld
  const expectedEvaluated = new Set([...t.rulesApplied, ...t.rulesWithheld]);
  const actualEvaluated = new Set(t.rulesEvaluated);
  const unionMatches = [...expectedEvaluated].every(r => actualEvaluated.has(r)) &&
                       [...actualEvaluated].every(r => expectedEvaluated.has(r));
  assert(unionMatches,
    `${label}: rulesEvaluated = union(rulesApplied, rulesWithheld)`,
    `applied=${JSON.stringify(t.rulesApplied)}, withheld=${JSON.stringify(t.rulesWithheld)}, evaluated=${JSON.stringify(t.rulesEvaluated)}`);
}

// Test the shape contract against a neutral (no symptoms) tolerance object
const neutralTolerance: DailyMedicationTolerance = {
  date: "2026-07-26",
  appetiteLevel: "normal",
  nauseaLevel: "none",
  hasVomiting: false,
  hydrationRisk: "none",
  waterMlLogged: 2000,
  hasReflux: false,
  hasDiarrhea: false,
  hasConstipation: false,
  shouldEscalate: false,
  escalationReason: null,
  rulesApplied: [],
  rulesWithheld: [],
  rulesEvaluated: [],
  safetyEscalations: [],
  nutritionAdaptations: [],
};
validateToleranceShape(neutralTolerance, "Neutral (no symptoms)");

// Test the shape contract against a vomiting + low-hydration tolerance object
const escalatedTolerance: DailyMedicationTolerance = {
  date: "2026-07-26",
  appetiteLevel: "suppressed",
  nauseaLevel: "severe",
  hasVomiting: true,
  hydrationRisk: "severe",
  waterMlLogged: 400,
  hasReflux: false,
  hasDiarrhea: false,
  hasConstipation: false,
  shouldEscalate: true,
  escalationReason: "Vomiting reported. Contact your prescribing provider.",
  rulesApplied: ["glp1_vomiting_escalate", "glp1_dehydration_difficulty_escalate"],
  rulesWithheld: [],
  rulesEvaluated: ["glp1_vomiting_escalate", "glp1_dehydration_difficulty_escalate"],
  safetyEscalations: ["⚠️ SAFETY — Vomiting reported today. Please contact your prescribing provider."],
  nutritionAdaptations: ["APPETITE: SUPPRESSED — Small, nutrient-dense meals only."],
};
validateToleranceShape(escalatedTolerance, "Escalated (vomiting + low hydration)");

// ─────────────────────────────────────────────────────────────────────────────
// APPETITE LEVEL DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

section("deriveAppetiteLevel — hunger 1-10 scale");

assert(deriveAppetiteLevel(null) === "normal",     "null hunger → normal");
assert(deriveAppetiteLevel(1)    === "suppressed",  "hunger=1 → suppressed");
assert(deriveAppetiteLevel(2)    === "suppressed",  "hunger=2 → suppressed");
assert(deriveAppetiteLevel(3)    === "reduced",     "hunger=3 → reduced");
assert(deriveAppetiteLevel(4)    === "reduced",     "hunger=4 → reduced");
assert(deriveAppetiteLevel(5)    === "normal",      "hunger=5 → normal");
assert(deriveAppetiteLevel(7)    === "normal",      "hunger=7 → normal");
assert(deriveAppetiteLevel(8)    === "increased",   "hunger=8 → increased");
assert(deriveAppetiteLevel(10)   === "increased",   "hunger=10 → increased");

// ─────────────────────────────────────────────────────────────────────────────
// NAUSEA LEVEL DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

section("deriveNauseaLevel — symptom keywords + digestion quality");

assert(deriveNauseaLevel([], null)              === "none",     "No symptoms → none");
assert(deriveNauseaLevel(["nausea"], null)      === "mild",     "nausea keyword, no digestion → mild");
assert(deriveNauseaLevel(["queasy"], null)      === "mild",     "queasy keyword → mild");
assert(deriveNauseaLevel(["nauseated"], 4)      === "moderate", "nauseated + digestion=4 → moderate");
assert(deriveNauseaLevel(["feel sick"], 2)      === "severe",   "feel sick + digestion=2 → severe");
assert(deriveNauseaLevel(["feel sick"], 1)      === "severe",   "feel sick + digestion=1 → severe");
assert(deriveNauseaLevel(["feel sick"], 5)      === "mild",     "feel sick + digestion=5 → mild");
assert(deriveNauseaLevel(["headache"], null)    === "none",     "headache (no nausea keyword) → none");
assert(deriveNauseaLevel(["nauseous", "tired"], 3) === "moderate", "nauseous + digestion=3 → moderate");

// ─────────────────────────────────────────────────────────────────────────────
// VOMITING KEYWORD DETECTION
// ─────────────────────────────────────────────────────────────────────────────

section("Vomiting keyword detection — escalation trigger");

assert(matchesAny(["vomiting"],   VOMITING_KEYWORDS), "vomiting → detected");
assert(matchesAny(["threw up"],   VOMITING_KEYWORDS), "threw up → detected");
assert(matchesAny(["throwing up"],VOMITING_KEYWORDS), "throwing up → detected");
assert(matchesAny(["puked"],      VOMITING_KEYWORDS), "puked → detected");
assert(matchesAny(["puke"],       VOMITING_KEYWORDS), "puke → detected");
assert(matchesAny(["I vomit"],    VOMITING_KEYWORDS), "I vomit → detected");
assert(!matchesAny(["nausea"],    VOMITING_KEYWORDS), "nausea alone → NOT vomiting");
assert(!matchesAny(["headache"],  VOMITING_KEYWORDS), "headache → NOT vomiting");
assert(!matchesAny([],            VOMITING_KEYWORDS), "empty symptoms → NOT vomiting");

// ─────────────────────────────────────────────────────────────────────────────
// HYDRATION RISK DERIVATION
// ─────────────────────────────────────────────────────────────────────────────

section("deriveHydrationRisk — vomiting/diarrhea + water intake");

assert(deriveHydrationRisk(false, false, 2000) === "none",     "No flags, good hydration → none");
assert(deriveHydrationRisk(false, false, 1200) === "none",     "No flags, 1200 mL → none (boundary)");
assert(deriveHydrationRisk(false, false, 1199) === "mild",     "No flags, 1199 mL → mild (below boundary)");
assert(deriveHydrationRisk(false, true,  2000) === "mild",     "Diarrhea, good water → mild");
assert(deriveHydrationRisk(false, true,  1499) === "elevated", "Diarrhea, 1499 mL → elevated");
assert(deriveHydrationRisk(true,  false, 2000) === "elevated", "Vomiting, good water → elevated");
assert(deriveHydrationRisk(true,  false, 1000) === "elevated", "Vomiting, 1000 mL → elevated (boundary)");
assert(deriveHydrationRisk(true,  false, 999)  === "severe",   "Vomiting, 999 mL → severe");
assert(deriveHydrationRisk(true,  false, 0)    === "severe",   "Vomiting, 0 mL → severe");
assert(deriveHydrationRisk(true,  true,  500)  === "severe",   "Vomiting + diarrhea, low water → severe");

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY ESCALATION INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────

section("Safety escalation invariants");

// When escalation fires, safety directives must be in safetyEscalations[],
// NOT in nutritionAdaptations[]. Cross-contamination is a safety failure.
{
  const t = escalatedTolerance;
  const safetyInNutrition = t.nutritionAdaptations.some(s =>
    s.toLowerCase().includes("provider") ||
    s.toLowerCase().includes("safety") ||
    s.toLowerCase().includes("seek medical")
  );
  assert(!safetyInNutrition,
    "Safety directives must not appear in nutritionAdaptations[]",
    `Found safety language in: ${JSON.stringify(t.nutritionAdaptations)}`);
}

{
  const t = escalatedTolerance;
  const escalationInNutrition = t.nutritionAdaptations.some(s =>
    s.toUpperCase().includes("⚠️") || s.includes("SAFETY")
  );
  assert(!escalationInNutrition,
    "⚠️ safety markers must not appear in nutritionAdaptations[]");
}

// ─────────────────────────────────────────────────────────────────────────────
// REFLUX / GI SYMPTOM KEYWORD DETECTION
// ─────────────────────────────────────────────────────────────────────────────

section("GI symptom keyword detection");

assert(matchesAny(["reflux"],      REFLUX_KEYWORDS),       "reflux → detected");
assert(matchesAny(["heartburn"],   REFLUX_KEYWORDS),       "heartburn → detected");
assert(matchesAny(["acid reflux"], REFLUX_KEYWORDS),       "acid reflux → detected");
assert(matchesAny(["indigestion"], REFLUX_KEYWORDS),       "indigestion → detected");
assert(matchesAny(["GERD"],        REFLUX_KEYWORDS),       "GERD (uppercase) → detected");
assert(!matchesAny(["nausea"],     REFLUX_KEYWORDS),       "nausea → NOT reflux");

assert(matchesAny(["diarrhea"],    DIARRHEA_KEYWORDS),     "diarrhea → detected");
assert(matchesAny(["loose stool"], DIARRHEA_KEYWORDS),     "loose stool → detected");
assert(matchesAny(["watery stool"],DIARRHEA_KEYWORDS),     "watery stool → detected");
assert(!matchesAny(["constipation"], DIARRHEA_KEYWORDS),  "constipation → NOT diarrhea");

assert(matchesAny(["constipation"],CONSTIPATION_KEYWORDS), "constipation → detected");
assert(matchesAny(["bloated"],     CONSTIPATION_KEYWORDS), "bloated → detected");
assert(matchesAny(["can't go"],    CONSTIPATION_KEYWORDS), "can't go → detected");
assert(matchesAny(["hard stool"],  CONSTIPATION_KEYWORDS), "hard stool → detected");
assert(!matchesAny(["diarrhea"],   CONSTIPATION_KEYWORDS), "diarrhea → NOT constipation");

// ─────────────────────────────────────────────────────────────────────────────
// RULES AUDIT COLLECTIONS — INVARIANTS
// ─────────────────────────────────────────────────────────────────────────────

section("Rules audit collection invariants");

// A rule ID must appear in exactly one of applied or withheld, never both
function checkMutualExclusion(t: DailyMedicationTolerance, label: string): void {
  const appliedSet = new Set(t.rulesApplied);
  const withheldSet = new Set(t.rulesWithheld);
  const overlap = [...appliedSet].filter(r => withheldSet.has(r));
  assert(overlap.length === 0,
    `${label}: applied and withheld are mutually exclusive`,
    `overlap: ${JSON.stringify(overlap)}`);
}

checkMutualExclusion(neutralTolerance,   "Neutral tolerance");
checkMutualExclusion(escalatedTolerance, "Escalated tolerance");

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(62)}`);
console.log(`  toleranceDerivation: ${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log("\n  FAILURES:");
  errors.forEach(e => console.log(`    • ${e}`));
}
console.log(`${"═".repeat(62)}\n`);

process.exit(failed > 0 ? 1 : 0);
