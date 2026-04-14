/**
 * Behavioral Memory Service
 * Phase 2 Step 1 — Controlled User Learning
 *
 * Read-only. Derives a deterministic PreferenceProfile from meal data
 * that already exists in the database. No AI guessing. No writes.
 *
 * Every preference in the output is traceable to a specific evidence record.
 *
 * Data sources (descending signal strength):
 *   1. saved_meals  — user explicitly saved a meal ("I want this again")
 *   2. user_recipes — user saved a recipe (strong intent signal)
 *   3. meal_instances (status='logged') — user logged a meal as eaten (acceptance signal)
 *
 * Scoring:
 *   Base score  = +1.0 per evidence event
 *   Recency decay: score × e^(-0.025 × daysSince)  (half-life ≈ 28 days)
 *   Minimum score to surface as a preference: SCORE_THRESHOLD = 0.4
 *   Maximum preference items per category: MAX_LIKES_PER_CATEGORY = 3
 *
 * Enforcement contract: this service NEVER touches the enforcement gateway.
 * Preferences derived here are soft hints only. They are injected into
 * generation prompts after enforcement passes, and enforcement always
 * runs again post-generation.
 */

import { db } from "../db";
import { savedMeals } from "@shared/schema";
import { userRecipes } from "@shared/schema";
import { mealInstances } from "@shared/schema";
import { eq, gte, desc } from "drizzle-orm";
import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceType = "saved_meal" | "saved_recipe" | "logged_instance";

export interface EvidenceRecord {
  mealTitle: string;
  eventType: EvidenceType;
  savedAt: string;
  daysSince: number;
  score: number;
  extractedSignals: string[];
}

export interface BehavioralPatterns {
  prefersCuisines: string[];
  prefersProteins: string[];
  prefersCookingMethods: string[];
  highProteinBias: boolean;
  lowPrepBias: boolean;
}

export interface PreferenceProfile {
  userId: string;
  likes: string[];
  avoids: string[];
  patterns: BehavioralPatterns;
  evidence: EvidenceRecord[];
  auditMeta: {
    profileHash: string;
    evidenceCount: number;
    derivedAt: string;
    categories: string[];
    dataSourceSummary: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 0.4;
const MAX_LIKES_PER_CATEGORY = 3;
const DECAY_LAMBDA = 0.025;     // score × e^(-lambda × days), half-life ≈ 28d
const LOOKBACK_DAYS = 90;       // only consider last 90 days of history
const MAX_RECORDS = 50;         // cap DB reads

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL DETECTION — deterministic keyword matching only
// ─────────────────────────────────────────────────────────────────────────────

const CUISINE_SIGNALS: Record<string, string[]> = {
  Mediterranean: ["mediterranean", "greek", "hummus", "falafel", "tzatziki", "pita", "olive", "feta", "shawarma"],
  Asian:         ["asian", "thai", "chinese", "japanese", "korean", "vietnamese", "sushi", "stir fry", "stir-fry", "ramen", "udon", "fried rice", "teriyaki", "miso", "kung pao", "pad thai"],
  Mexican:       ["mexican", "taco", "burrito", "enchilada", "quesadilla", "salsa", "guacamole", "carnitas", "fajita"],
  Italian:       ["italian", "pasta", "lasagna", "risotto", "pizza", "pesto", "marinara", "bolognese", "gnocchi", "parmesan"],
  Indian:        ["indian", "curry", "tikka", "masala", "dal", "biryani", "naan", "samosa", "tandoori"],
  American:      ["bbq", "burger", "sandwich", "mac and cheese", "southern", "grilled", "barbecue"],
  MiddleEastern: ["middle eastern", "persian", "lebanese", "moroccan", "tagine", "couscous", "tahini", "kebab"],
};

const PROTEIN_SIGNALS: Record<string, string[]> = {
  chicken: ["chicken", "poultry", "rotisserie", "hen"],
  salmon:  ["salmon", "fish", "cod", "tilapia", "tuna", "halibut", "trout"],
  beef:    ["beef", "steak", "brisket", "ground beef", "sirloin", "ribeye"],
  turkey:  ["turkey", "ground turkey"],
  shrimp:  ["shrimp", "prawn", "seafood"],
  tofu:    ["tofu", "tempeh", "edamame"],
  eggs:    ["egg", "eggs", "omelette", "frittata", "quiche"],
  lamb:    ["lamb", "mutton"],
};

const METHOD_SIGNALS: Record<string, string[]> = {
  "air fryer": ["air fry", "air-fry", "air fryer"],
  grilled:    ["grill", "grilled", "bbq", "barbecue"],
  "one-pan":  ["one-pan", "one pan", "sheet pan", "one-pot", "one pot", "skillet"],
  baked:      ["baked", "oven-roasted", "roasted", "oven"],
  "slow cook":["slow cook", "slow-cook", "crockpot", "crock pot", "instant pot"],
};

const HIGH_PROTEIN_INDICATORS = ["protein", "high-protein", "high protein", "lean", "muscle"];
const LOW_PREP_INDICATORS      = ["quick", "easy", "15 min", "20 min", "simple", "one-pan", "one pan", "sheet pan"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function extractSignals(title: string, ingredientText: string): {
  cuisines: string[];
  proteins: string[];
  methods: string[];
  highProtein: boolean;
  lowPrep: boolean;
} {
  const combined = normalize(`${title} ${ingredientText}`);

  const cuisines = Object.entries(CUISINE_SIGNALS)
    .filter(([, terms]) => terms.some(t => combined.includes(t)))
    .map(([label]) => label);

  const proteins = Object.entries(PROTEIN_SIGNALS)
    .filter(([, terms]) => terms.some(t => combined.includes(t)))
    .map(([label]) => label);

  const methods = Object.entries(METHOD_SIGNALS)
    .filter(([, terms]) => terms.some(t => combined.includes(t)))
    .map(([label]) => label);

  const highProtein = HIGH_PROTEIN_INDICATORS.some(t => combined.includes(t));
  const lowPrep     = LOW_PREP_INDICATORS.some(t => combined.includes(t));

  return { cuisines, proteins, methods, highProtein, lowPrep };
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENCY SCORING
// ─────────────────────────────────────────────────────────────────────────────

function daysSince(date: Date | null | undefined): number {
  if (!date) return LOOKBACK_DAYS;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function decayedScore(days: number): number {
  return Math.exp(-DECAY_LAMBDA * days);
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFERENCE AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

interface SignalAccumulator {
  [key: string]: number;
}

function topN(acc: SignalAccumulator, n: number): string[] {
  return Object.entries(acc)
    .filter(([, score]) => score >= SCORE_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE HASH — same inputs always produce same hash
// ─────────────────────────────────────────────────────────────────────────────

function hashProfile(evidence: EvidenceRecord[]): string {
  const canonical = evidence
    .map(e => `${e.mealTitle}|${e.eventType}|${e.savedAt}`)
    .sort()
    .join(";");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: derivePreferenceProfile
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_PATTERNS: BehavioralPatterns = {
  prefersCuisines: [],
  prefersProteins: [],
  prefersCookingMethods: [],
  highProteinBias: false,
  lowPrepBias: false,
};

export async function derivePreferenceProfile(userId: string): Promise<PreferenceProfile | null> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const evidenceRecords: EvidenceRecord[] = [];

  // ── Source 1: saved_meals ─────────────────────────────────────────────────
  try {
    const saved = await db
      .select({
        id: savedMeals.id,
        title: savedMeals.title,
        mealData: savedMeals.mealData,
        createdAt: savedMeals.createdAt,
      })
      .from(savedMeals)
      .where(eq(savedMeals.userId, userId))
      .orderBy(desc(savedMeals.createdAt))
      .limit(MAX_RECORDS);

    for (const row of saved) {
      if (row.createdAt && row.createdAt < cutoff) continue;

      const mealData = row.mealData as any;
      const ingredientText = Array.isArray(mealData?.ingredients)
        ? mealData.ingredients
            .map((i: any) => (typeof i === "string" ? i : i?.name || i?.item || ""))
            .join(" ")
        : "";

      const signals = extractSignals(row.title, ingredientText);
      const days    = daysSince(row.createdAt);
      const score   = decayedScore(days);

      evidenceRecords.push({
        mealTitle:       row.title,
        eventType:       "saved_meal",
        savedAt:         row.createdAt?.toISOString() || "",
        daysSince:       days,
        score,
        extractedSignals: [
          ...signals.cuisines,
          ...signals.proteins,
          ...signals.methods,
          ...(signals.highProtein ? ["high-protein"] : []),
          ...(signals.lowPrep     ? ["quick-prep"]   : []),
        ],
      });
    }
  } catch (err) {
    console.warn("[BehavioralMemory] Could not read saved_meals:", err);
  }

  // ── Source 2: user_recipes ────────────────────────────────────────────────
  try {
    const recipes = await db
      .select({
        id: userRecipes.id,
        title: userRecipes.title,
        ingredients: userRecipes.ingredients,
        createdAt: userRecipes.createdAt,
      })
      .from(userRecipes)
      .where(eq(userRecipes.userId, userId))
      .orderBy(desc(userRecipes.createdAt))
      .limit(MAX_RECORDS);

    for (const row of recipes) {
      if (row.createdAt && row.createdAt < cutoff) continue;

      const ingredientText = Array.isArray(row.ingredients)
        ? (row.ingredients as any[])
            .map((i: any) => (typeof i === "string" ? i : i?.name || ""))
            .join(" ")
        : "";

      const signals = extractSignals(row.title, ingredientText);
      const days    = daysSince(row.createdAt);
      const score   = decayedScore(days);

      evidenceRecords.push({
        mealTitle:       row.title,
        eventType:       "saved_recipe",
        savedAt:         row.createdAt?.toISOString() || "",
        daysSince:       days,
        score,
        extractedSignals: [
          ...signals.cuisines,
          ...signals.proteins,
          ...signals.methods,
          ...(signals.highProtein ? ["high-protein"] : []),
          ...(signals.lowPrep     ? ["quick-prep"]   : []),
        ],
      });
    }
  } catch (err) {
    console.warn("[BehavioralMemory] Could not read user_recipes:", err);
  }

  if (evidenceRecords.length === 0) {
    return null;
  }

  // ── Aggregate scores ──────────────────────────────────────────────────────
  const cuisineAcc:  SignalAccumulator = {};
  const proteinAcc:  SignalAccumulator = {};
  const methodAcc:   SignalAccumulator = {};
  let highProteinTotal = 0;
  let lowPrepTotal     = 0;

  for (const ev of evidenceRecords) {
    for (const signal of ev.extractedSignals) {
      if (Object.keys(CUISINE_SIGNALS).includes(signal)) {
        cuisineAcc[signal] = (cuisineAcc[signal] || 0) + ev.score;
      } else if (Object.keys(PROTEIN_SIGNALS).includes(signal)) {
        proteinAcc[signal] = (proteinAcc[signal] || 0) + ev.score;
      } else if (Object.keys(METHOD_SIGNALS).includes(signal)) {
        methodAcc[signal] = (methodAcc[signal] || 0) + ev.score;
      } else if (signal === "high-protein") {
        highProteinTotal += ev.score;
      } else if (signal === "quick-prep") {
        lowPrepTotal += ev.score;
      }
    }
  }

  const patterns: BehavioralPatterns = {
    prefersCuisines:     topN(cuisineAcc,  MAX_LIKES_PER_CATEGORY),
    prefersProteins:     topN(proteinAcc,  MAX_LIKES_PER_CATEGORY),
    prefersCookingMethods: topN(methodAcc, MAX_LIKES_PER_CATEGORY),
    highProteinBias:     highProteinTotal >= SCORE_THRESHOLD,
    lowPrepBias:         lowPrepTotal     >= SCORE_THRESHOLD,
  };

  // Build likes[] — human-readable preference phrases
  const likes: string[] = [
    ...patterns.prefersCuisines.map(c => `${c} cuisine`),
    ...patterns.prefersProteins.map(p => `${p} dishes`),
    ...patterns.prefersCookingMethods.map(m => `${m} preparations`),
    ...(patterns.highProteinBias ? ["high-protein meals"] : []),
    ...(patterns.lowPrepBias     ? ["quick and simple prep"] : []),
  ];

  // Build avoids[] — only from explicit meal-level patterns (no clinical overrides)
  // Phase 2: will include rejected meals once feedback events are stored.
  const avoids: string[] = [];

  // Audit metadata
  const profileHash = hashProfile(evidenceRecords);
  const categories: string[] = [];
  if (patterns.prefersCuisines.length > 0) categories.push("cuisine");
  if (patterns.prefersProteins.length > 0) categories.push("protein");
  if (patterns.prefersCookingMethods.length > 0) categories.push("cooking-method");
  if (patterns.highProteinBias) categories.push("macro-bias");
  if (patterns.lowPrepBias)     categories.push("prep-time-bias");

  const sourceTypes = [...new Set(evidenceRecords.map(e => e.eventType))];

  return {
    userId,
    likes,
    avoids,
    patterns,
    evidence: evidenceRecords,
    auditMeta: {
      profileHash,
      evidenceCount: evidenceRecords.length,
      derivedAt: new Date().toISOString(),
      categories,
      dataSourceSummary: `${evidenceRecords.length} records from [${sourceTypes.join(", ")}], cutoff=${LOOKBACK_DAYS}d`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER — bounded, structured, soft hints only
// ─────────────────────────────────────────────────────────────────────────────

export function buildBehavioralMemoryPromptSection(profile: PreferenceProfile): string {
  const lines: string[] = [];

  if (profile.likes.length === 0) return "";

  lines.push("USER PREFERENCE HISTORY (soft hints — do not override dietary or medical rules):");

  if (profile.patterns.prefersCuisines.length > 0) {
    lines.push(`  Tends to enjoy: ${profile.patterns.prefersCuisines.join(", ")} cuisine`);
  }

  if (profile.patterns.prefersProteins.length > 0) {
    lines.push(`  Often accepts: ${profile.patterns.prefersProteins.join(", ")}-based meals`);
  }

  if (profile.patterns.prefersCookingMethods.length > 0) {
    lines.push(`  Prefers preparation style: ${profile.patterns.prefersCookingMethods.join(", ")}`);
  }

  if (profile.patterns.highProteinBias) {
    lines.push(`  Macro pattern: leans toward high-protein meals`);
  }

  if (profile.patterns.lowPrepBias) {
    lines.push(`  Prep preference: tends to favor quick, simple recipes`);
  }

  lines.push(`  (Based on ${profile.auditMeta.evidenceCount} saved meals — profile hash: ${profile.auditMeta.profileHash})`);

  return lines.join("\n");
}
