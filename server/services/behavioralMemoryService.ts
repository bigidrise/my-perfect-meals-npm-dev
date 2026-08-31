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
 *   3. meal_instances (status='eaten') — user logged a meal as eaten (confirmed consumption)
 *   4. meal_instances (status='skipped'|'replaced') — user did not choose the meal (weak negative signal)
 *
 * Scoring:
 *   Saved evidence = +1.0, confirmed consumption = +1.5
 *   Skipped/replaced evidence = -0.5 (negative evidence must repeat before surfacing)
 *   Recency decay: score × e^(-0.025 × daysSince)  (half-life ≈ 28 days)
 *   Minimum score to surface as a preference: SCORE_THRESHOLD = 0.4
 *   Minimum negative score to surface as a soft avoidance: NEGATIVE_SCORE_THRESHOLD = 0.75
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
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceType =
  | "saved_meal"
  | "saved_recipe"
  | "logged_instance"
  | "skipped_instance"
  | "replaced_instance";

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

export function hasBehavioralMemorySignals(profile: PreferenceProfile): boolean {
  return profile.likes.length > 0 || profile.avoids.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_THRESHOLD = 0.4;
const NEGATIVE_SCORE_THRESHOLD = 0.75;
const MAX_LIKES_PER_CATEGORY = 3;
const MAX_AVOIDS_PER_CATEGORY = 3;
const DECAY_LAMBDA = 0.025;     // score × e^(-lambda × days), half-life ≈ 28d
const LOOKBACK_DAYS = 90;       // only consider last 90 days of history
const MAX_RECORDS = 50;         // cap DB reads

const EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  saved_meal: 1,
  saved_recipe: 1,
  logged_instance: 1.5,
  skipped_instance: -0.5,
  replaced_instance: -0.5,
};

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
  chicken:  ["chicken", "poultry", "rotisserie", "hen"],
  salmon:   ["salmon"],
  cod:      ["cod"],
  tilapia:  ["tilapia"],
  tuna:     ["tuna"],
  halibut:  ["halibut"],
  trout:    ["trout"],
  fish:     ["fish", "seafood"],
  beef:     ["beef", "steak", "brisket", "ground beef", "sirloin", "ribeye"],
  turkey:   ["turkey", "ground turkey"],
  shrimp:   ["shrimp", "prawn"],
  tofu:     ["tofu", "tempeh", "edamame"],
  eggs:     ["egg", "eggs", "omelette", "frittata", "quiche"],
  lamb:     ["lamb", "mutton"],
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

function topN(acc: SignalAccumulator, n: number, threshold: number = SCORE_THRESHOLD): string[] {
  return Object.entries(acc)
    .filter(([, score]) => score >= threshold)
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
      .leftJoin(
        mealInstances,
        and(
          eq(mealInstances.recipeId, userRecipes.id),
          eq(mealInstances.userId, userId),
        ),
      )
      .where(and(
        eq(userRecipes.userId, userId),
        isNull(mealInstances.id),
      ))
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

  // ── Source 3: confirmed meal-instance behavior ────────────────────────────
  //
  // recipeId is intentionally resolved through user_recipes with the same
  // owner constraint. meal_instances predates a foreign key on recipe_id, so
  // this prevents a malformed or cross-account ID from leaking another user's
  // recipe into the preference profile.
  try {
    const instances = await db
      .select({
        title: userRecipes.title,
        ingredients: userRecipes.ingredients,
        status: mealInstances.status,
        statusChangedAt: mealInstances.statusChangedAt,
        loggedAt: mealInstances.loggedAt,
      })
      .from(mealInstances)
      .innerJoin(
        userRecipes,
        and(
          eq(userRecipes.id, mealInstances.recipeId),
          eq(userRecipes.userId, userId),
        ),
      )
      .where(and(
        eq(mealInstances.userId, userId),
        inArray(mealInstances.status, ["eaten", "logged", "skipped", "replaced"]),
        or(
          gte(mealInstances.loggedAt, cutoff),
          gte(mealInstances.statusChangedAt, cutoff),
        ),
      ))
      .orderBy(desc(mealInstances.loggedAt), desc(mealInstances.statusChangedAt))
      .limit(MAX_RECORDS);

    for (const row of instances) {
      const eventType: EvidenceType =
        row.status === "eaten" || row.status === "logged"
          ? "logged_instance"
          : row.status === "skipped"
            ? "skipped_instance"
            : "replaced_instance";
      const eventDate = row.status === "eaten" || row.status === "logged"
        ? row.loggedAt ?? row.statusChangedAt
        : row.statusChangedAt;

      // Legacy negative rows do not have a reliable action timestamp. Ignoring
      // them is safer than treating the original plan creation time as the
      // moment the user rejected the meal.
      if (!eventDate) continue;
      if (eventDate && eventDate < cutoff) continue;

      const ingredientText = Array.isArray(row.ingredients)
        ? (row.ingredients as any[])
            .map((i: any) => (typeof i === "string" ? i : i?.name || i?.item || ""))
            .join(" ")
        : "";
      const signals = extractSignals(row.title, ingredientText);
      const days = daysSince(eventDate);
      const score = EVIDENCE_WEIGHTS[eventType] * decayedScore(days);

      evidenceRecords.push({
        mealTitle: row.title,
        eventType,
        savedAt: eventDate?.toISOString() || "",
        daysSince: days,
        score,
        extractedSignals: [
          ...signals.cuisines,
          ...signals.proteins,
          ...signals.methods,
          ...(signals.highProtein ? ["high-protein"] : []),
          ...(signals.lowPrep ? ["quick-prep"] : []),
        ],
      });
    }
  } catch (err) {
    console.warn("[BehavioralMemory] Could not read meal_instances:", err);
  }

  if (evidenceRecords.length === 0) {
    return null;
  }

  // ── Aggregate scores ──────────────────────────────────────────────────────
  const cuisineAcc: SignalAccumulator = {};
  const proteinAcc: SignalAccumulator = {};
  const methodAcc: SignalAccumulator = {};
  const negativeCuisineAcc: SignalAccumulator = {};
  const negativeProteinAcc: SignalAccumulator = {};
  const negativeMethodAcc: SignalAccumulator = {};
  let highProteinTotal = 0;
  let lowPrepTotal = 0;
  let negativeHighProteinTotal = 0;
  let negativeLowPrepTotal = 0;

  for (const ev of evidenceRecords) {
    const positive = ev.score >= 0;
    const magnitude = Math.abs(ev.score);
    for (const signal of ev.extractedSignals) {
      if (Object.keys(CUISINE_SIGNALS).includes(signal)) {
        const target = positive ? cuisineAcc : negativeCuisineAcc;
        target[signal] = (target[signal] || 0) + magnitude;
      } else if (Object.keys(PROTEIN_SIGNALS).includes(signal)) {
        const target = positive ? proteinAcc : negativeProteinAcc;
        target[signal] = (target[signal] || 0) + magnitude;
      } else if (Object.keys(METHOD_SIGNALS).includes(signal)) {
        const target = positive ? methodAcc : negativeMethodAcc;
        target[signal] = (target[signal] || 0) + magnitude;
      } else if (signal === "high-protein") {
        if (positive) highProteinTotal += magnitude;
        else negativeHighProteinTotal += magnitude;
      } else if (signal === "quick-prep") {
        if (positive) lowPrepTotal += magnitude;
        else negativeLowPrepTotal += magnitude;
      }
    }
  }

  const effectiveNegativeCuisineAcc = gatedNegativeScores(negativeCuisineAcc);
  const effectiveNegativeProteinAcc = gatedNegativeScores(negativeProteinAcc);
  const effectiveNegativeMethodAcc = gatedNegativeScores(negativeMethodAcc);
  const effectiveNegativeHighProteinTotal =
    negativeHighProteinTotal >= NEGATIVE_SCORE_THRESHOLD ? negativeHighProteinTotal : 0;
  const effectiveNegativeLowPrepTotal =
    negativeLowPrepTotal >= NEGATIVE_SCORE_THRESHOLD ? negativeLowPrepTotal : 0;
  const netCuisineAcc = subtractScores(cuisineAcc, effectiveNegativeCuisineAcc);
  const netProteinAcc = subtractScores(proteinAcc, effectiveNegativeProteinAcc);
  const netMethodAcc = subtractScores(methodAcc, effectiveNegativeMethodAcc);
  const netNegativeCuisineAcc = subtractScores(effectiveNegativeCuisineAcc, cuisineAcc);
  const netNegativeProteinAcc = subtractScores(effectiveNegativeProteinAcc, proteinAcc);
  const netNegativeMethodAcc = subtractScores(effectiveNegativeMethodAcc, methodAcc);
  const netHighProteinTotal = highProteinTotal - effectiveNegativeHighProteinTotal;
  const netLowPrepTotal = lowPrepTotal - effectiveNegativeLowPrepTotal;
  const netNegativeHighProteinTotal = effectiveNegativeHighProteinTotal - highProteinTotal;
  const netNegativeLowPrepTotal = effectiveNegativeLowPrepTotal - lowPrepTotal;

  const patterns: BehavioralPatterns = {
    prefersCuisines: topN(netCuisineAcc, MAX_LIKES_PER_CATEGORY),
    prefersProteins: topN(netProteinAcc, MAX_LIKES_PER_CATEGORY),
    prefersCookingMethods: topN(netMethodAcc, MAX_LIKES_PER_CATEGORY),
    highProteinBias: netHighProteinTotal >= SCORE_THRESHOLD,
    lowPrepBias: netLowPrepTotal >= SCORE_THRESHOLD,
  };

  // Build likes[] — human-readable preference phrases
  const likes: string[] = [
    ...patterns.prefersCuisines.map(c => `${c} cuisine`),
    ...patterns.prefersProteins.map(p => `${p} dishes`),
    ...patterns.prefersCookingMethods.map(m => `${m} preparations`),
    ...(patterns.highProteinBias ? ["high-protein meals"] : []),
    ...(patterns.lowPrepBias     ? ["quick and simple prep"] : []),
  ];

  // Build soft avoids[] from repeated negative evidence only. These are
  // recommendation hints, never enforcement rules or replacements for explicit
  // allergies/dietary restrictions.
  const avoidedCuisines = topN(netNegativeCuisineAcc, MAX_AVOIDS_PER_CATEGORY, NEGATIVE_SCORE_THRESHOLD);
  const avoidedProteins = topN(netNegativeProteinAcc, MAX_AVOIDS_PER_CATEGORY, NEGATIVE_SCORE_THRESHOLD);
  const avoidedMethods = topN(netNegativeMethodAcc, MAX_AVOIDS_PER_CATEGORY, NEGATIVE_SCORE_THRESHOLD);
  const avoids: string[] = [
    ...avoidedCuisines.map(c => `${c} cuisine`),
    ...avoidedProteins.map(p => `${p} dishes`),
    ...avoidedMethods.map(m => `${m} preparations`),
    ...(netNegativeHighProteinTotal >= NEGATIVE_SCORE_THRESHOLD ? ["high-protein meals"] : []),
    ...(netNegativeLowPrepTotal >= NEGATIVE_SCORE_THRESHOLD ? ["quick and simple prep"] : []),
  ];

  // Audit metadata
  const profileHash = hashProfile(evidenceRecords);
  const categories: string[] = [];
  if (patterns.prefersCuisines.length > 0) categories.push("cuisine");
  if (patterns.prefersProteins.length > 0) categories.push("protein");
  if (patterns.prefersCookingMethods.length > 0) categories.push("cooking-method");
  if (patterns.highProteinBias) categories.push("macro-bias");
  if (patterns.lowPrepBias)     categories.push("prep-time-bias");
  if (avoids.length > 0) categories.push("inferred-avoidance");

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
      dataSourceSummary: `${evidenceRecords.length} preference records from [${sourceTypes.join(", ")}], cutoff=${LOOKBACK_DAYS}d`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER — bounded, structured, soft hints only
// ─────────────────────────────────────────────────────────────────────────────

export function buildBehavioralMemoryPromptSection(profile: PreferenceProfile): string {
  const lines: string[] = [];

  if (profile.likes.length === 0 && profile.avoids.length === 0) return "";

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

  if (profile.avoids.length > 0) {
    lines.push(`  Repeatedly does not choose: ${profile.avoids.join(", ")}`);
    lines.push("  Treat these as soft recommendation hints only — do not treat them as allergies or hard restrictions.");
  }

  lines.push(`  (Based on ${profile.auditMeta.evidenceCount} preference records — profile hash: ${profile.auditMeta.profileHash})`);

  return lines.join("\n");
}

function subtractScores(
  positive: SignalAccumulator,
  negative: SignalAccumulator,
): SignalAccumulator {
  const keys = new Set([...Object.keys(positive), ...Object.keys(negative)]);
  return Object.fromEntries(
    [...keys].map(key => [key, (positive[key] || 0) - (negative[key] || 0)]),
  );
}

function gatedNegativeScores(negative: SignalAccumulator): SignalAccumulator {
  return Object.fromEntries(
    Object.entries(negative)
      .filter(([, score]) => score >= NEGATIVE_SCORE_THRESHOLD),
  );
}
