/**
 * Saved Grocery Compliance Filter
 *
 * Determines which of a user's saved grocery items are still compliant with
 * their current protocol envelope — WITHOUT calling the LLM.
 *
 * Hierarchy (mirrors the platform-wide rule):
 *   Dietary identity → Allergies → Avoidances → GLP-1 fat ceiling → Diabetic carb ceiling
 *
 * Only compliant items are surfaced to Grocery Coach as "vetted favorites."
 * The LLM is never asked to interpret clinical rules itself.
 */

import type { UserProtocolEnvelope } from "./protocolEnvelope";
import { scanTextForHighRiskIngredients } from "./ingredientIntelligence";

export interface SavedGroceryItemSlim {
  id: string;
  productName: string;
  brand: string | null;
  category: string | null;
  productKey: string;
  /**
   * Flat macro object when saved from Grocery Coach: { calories, protein, carbs, fat }.
   * Scanner-saved items store { scoreCards, outcomeCards } here — fat/carbs are absent.
   * The filter treats any non-finite value as absent and fails closed for clinical users.
   */
  nutritionJson: Record<string, unknown> | null;
  /** Extracted ingredient list — persisted in productMeta.ingredients by the scanner. */
  ingredients?: string[] | null;
  /** Explicit package/source certifications when they were captured. */
  certifications?: string[] | null;
  savedAt: Date | string;
}

export interface ComplianceFilterResult {
  compliant: SavedGroceryItemSlim[];
  excluded: Array<SavedGroceryItemSlim & { exclusionReason: string }>;
}

export function selectAuthoritativelyApprovedSavedItems<
  T extends { id: string },
>(
  items: T[],
  decisions: Array<{ id: string; status: "approved" | "blocked" }>,
  authoritativeContextResolved: boolean,
): T[] {
  if (!authoritativeContextResolved) return [];
  const approvedIds = new Set(
    decisions
      .filter((decision) => decision.status === "approved")
      .map((decision) => decision.id),
  );
  return items.filter((item) => approvedIds.has(item.id));
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function normalizeEvidence(s: string): string {
  return ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function evidenceContains(text: string, term: string): boolean {
  const normalizedTerm = normalizeEvidence(term).trim();
  return normalizedTerm.length > 0 && normalizeEvidence(text).includes(` ${normalizedTerm} `);
}

const VEGAN_FORBIDDEN = [
  "beef", "veal", "pork", "ham", "bacon", "lamb", "mutton", "chicken", "turkey",
  "duck", "goose", "venison", "meat", "fish", "salmon", "tuna", "anchovy", "anchovies",
  "shellfish", "shrimp", "prawn", "crab", "lobster", "oyster", "clam", "mussel",
  "gelatin", "lard", "tallow", "whey", "casein", "caseinate", "milkfat", "butterfat",
  "cream", "cheese", "egg", "eggs", "albumen", "honey", "beeswax", "carmine",
];

const VEGETARIAN_FORBIDDEN = [
  "beef", "veal", "pork", "ham", "bacon", "lamb", "mutton", "chicken", "turkey",
  "duck", "goose", "venison", "meat", "fish", "salmon", "tuna", "anchovy", "anchovies",
  "shellfish", "shrimp", "prawn", "crab", "lobster", "oyster", "clam", "mussel",
  "gelatin", "lard", "tallow",
];

const PESCATARIAN_FORBIDDEN = [
  "beef", "veal", "pork", "ham", "bacon", "lamb", "mutton", "chicken", "turkey",
  "duck", "goose", "venison", "meat", "gelatin", "lard", "tallow",
];

const DAIRY_FREE_FORBIDDEN = [
  "whey", "casein", "caseinate", "cheese", "ghee", "lactose", "milkfat",
  "butterfat", "buttermilk", "yogurt", "yoghurt", "milk", "cream",
];

const GLUTEN_FREE_FORBIDDEN = [
  "wheat", "barley", "rye", "spelt", "kamut", "triticale", "seitan",
  "malt", "brewer's yeast", "brewers yeast",
];

const HALAL_FORBIDDEN = [
  "pork", "ham", "bacon", "lard", "gelatin", "alcohol", "wine", "beer",
];

const KOSHER_FORBIDDEN = [
  "pork", "ham", "bacon", "lard", "shellfish", "shrimp", "prawn", "crab",
  "lobster", "oyster", "clam", "mussel",
];

const STRICT_INGREDIENT_IDENTITIES = [
  "vegan", "vegetarian", "pescatarian", "gluten-free", "gluten free",
  "dairy-free", "dairy free", "halal", "kosher",
];

function itemEvidenceText(item: SavedGroceryItemSlim): string {
  return [
    item.productName,
    item.brand ?? "",
    ...(item.ingredients ?? []),
  ].filter(Boolean).join(" ");
}

function findForbiddenIdentityTerm(
  item: SavedGroceryItemSlim,
  identity: string,
): string | null {
  const ingredients = item.ingredients?.filter(Boolean) ?? [];
  const evidence = ingredients.length > 0
    ? ingredients.join(" ")
    : [item.productName, item.brand ?? ""].join(" ");
  const normalizedIdentity = normalize(identity);
  const forbidden = normalizedIdentity.includes("vegan")
    ? VEGAN_FORBIDDEN
    : normalizedIdentity.includes("dairy-free") || normalizedIdentity.includes("dairy free")
      ? DAIRY_FREE_FORBIDDEN
      : normalizedIdentity.includes("gluten-free") || normalizedIdentity.includes("gluten free")
        ? GLUTEN_FREE_FORBIDDEN
        : normalizedIdentity.includes("halal")
          ? HALAL_FORBIDDEN
          : normalizedIdentity.includes("kosher")
            ? KOSHER_FORBIDDEN
            : normalizedIdentity.includes("vegetarian")
              ? VEGETARIAN_FORBIDDEN
              : normalizedIdentity.includes("pescatarian")
                ? PESCATARIAN_FORBIDDEN
                : [];
  return forbidden.find((term) => {
    if (term !== "milk" && term !== "cream") return evidenceContains(evidence, term);
    let normalizedEvidence = normalizeEvidence(evidence);
    for (const plant of ["almond", "soy", "oat", "coconut", "cashew", "rice", "pea", "hemp", "flax"]) {
      normalizedEvidence = normalizedEvidence.replaceAll(` ${plant} ${term} `, " ");
    }
    return normalizedEvidence.includes(` ${term} `);
  }) ?? null;
}

function hasRequiredCertification(
  item: SavedGroceryItemSlim,
  identity: string,
): boolean {
  const normalizedIdentity = normalize(identity);
  if (!normalizedIdentity.includes("halal") && !normalizedIdentity.includes("kosher")) {
    return true;
  }
  const required = normalizedIdentity.includes("halal") ? "halal" : "kosher";
  return (item.certifications ?? []).some((certification) =>
    normalize(certification).includes(required),
  );
}

function productMatchesTerm(item: SavedGroceryItemSlim, term: string): boolean {
  const t = normalize(term);
  if (normalize(item.productName).includes(t)) return true;
  if (item.brand && normalize(item.brand).includes(t)) return true;
  // Also check persisted ingredient list (populated by scanner via productMeta.ingredients).
  if (item.ingredients) {
    for (const ing of item.ingredients) {
      if (ing && normalize(ing).includes(t)) return true;
    }
  }
  return false;
}

export function filterSavedGroceriesForCompliance(
  savedItems: SavedGroceryItemSlim[],
  envelope: UserProtocolEnvelope,
  options?: {
    glp1Targets?: { maximumToleratedFatGrams: number; resolvedMealCalories: number } | null;
    isDiabetic?: boolean;
    diabeticCarbCeiling?: number | null;
  },
): ComplianceFilterResult {
  const { glp1Targets, isDiabetic, diabeticCarbCeiling } = options ?? {};
  const compliant: SavedGroceryItemSlim[] = [];
  const excluded: Array<SavedGroceryItemSlim & { exclusionReason: string }> = [];

  for (const item of savedItems) {
    let exclusionReason: string | null = null;

    // ── Tier 1: Dietary identity — outer wall ────────────────────────────────
    for (const identity of envelope.dietaryIdentity) {
      if (!identity) continue;
      const normalizedIdentity = normalize(identity);
      const strictIdentity = STRICT_INGREDIENT_IDENTITIES.some(
        (candidate) => normalizedIdentity.includes(candidate),
      );

      if (strictIdentity && (!item.ingredients || item.ingredients.length === 0)) {
        exclusionReason =
          `Ingredient evidence unavailable — cannot verify ${identity} compatibility`;
        break;
      }

      const forbiddenTerm = findForbiddenIdentityTerm(item, identity);
      if (forbiddenTerm) {
        exclusionReason =
          `Contains ${forbiddenTerm}, which conflicts with your ${identity} dietary identity`;
        break;
      }
      if (!hasRequiredCertification(item, identity)) {
        exclusionReason =
          `Verified ${identity} certification evidence is unavailable for this product`;
        break;
      }
    }

    // Use the existing deterministic ingredient-intelligence registry for
    // supported identity/certification protocols beyond the explicit
    // vegan/vegetarian/pescatarian checks above.
    if (!exclusionReason && envelope.dietaryIdentity.length > 0) {
      const findings = scanTextForHighRiskIngredients(
        itemEvidenceText(item),
        envelope.dietaryIdentity,
      );
      const firstFinding = findings[0];
      if (firstFinding) {
        exclusionReason =
          firstFinding.reason || `${firstFinding.ingredientName} conflicts with your dietary protocol`;
      }
    }

    // ── Tier 2: Allergy blocks — absolute hard stops ──
    for (const allergen of envelope.allergies) {
      if (!exclusionReason && allergen && productMatchesTerm(item, allergen)) {
        exclusionReason = `Contains or may contain ${allergen} (allergen on your profile)`;
        break;
      }
    }
    if (
      !exclusionReason &&
      envelope.allergies.length > 0 &&
      (!item.ingredients || item.ingredients.length === 0)
    ) {
      exclusionReason =
        "Ingredient evidence unavailable — cannot verify safety against your allergy profile";
    }

    // ── Tier 3: Avoidances ──
    if (!exclusionReason) {
      for (const avoid of envelope.avoidances) {
        if (avoid && productMatchesTerm(item, avoid)) {
          exclusionReason = `Conflicts with your "${avoid}" avoidance preference`;
          break;
        }
      }
    }
    if (
      !exclusionReason &&
      envelope.avoidances.length > 0 &&
      (!item.ingredients || item.ingredients.length === 0)
    ) {
      exclusionReason =
        "Ingredient evidence unavailable — cannot verify your avoidance preferences";
    }

    // ── Tier 4: GLP-1 fat ceiling ─────────────────────────────────────────────
    // Fail closed on three conditions:
    //   a) nutritionJson is null
    //   b) nutritionJson is present but fat is absent or non-numeric
    //      (scanner items store { scoreCards, outcomeCards } — fat is undefined → NaN)
    //   c) fat is finite and exceeds the ceiling
    // In cases (a) and (b) we cannot verify compliance, so the item is excluded.
    if (!exclusionReason && glp1Targets) {
      const fat = item.nutritionJson ? Number(item.nutritionJson.fat) : NaN;
      if (!Number.isFinite(fat)) {
        exclusionReason =
          "Nutrition data unavailable — cannot verify fat content against your GLP-1 limit";
      } else if (fat > glp1Targets.maximumToleratedFatGrams) {
        exclusionReason =
          `Fat content (${fat}g) exceeds your current GLP-1 limit ` +
          `(${glp1Targets.maximumToleratedFatGrams}g per meal)`;
      }
    }

    // ── Tier 5: Diabetic carb ceiling ─────────────────────────────────────────
    // Same fail-closed rule: treat absent/non-finite carbs as unverifiable.
    if (!exclusionReason && isDiabetic && typeof diabeticCarbCeiling === "number") {
      const carbs = item.nutritionJson ? Number(item.nutritionJson.carbs) : NaN;
      if (!Number.isFinite(carbs)) {
        exclusionReason =
          "Nutrition data unavailable — cannot verify carb content against your diabetic limit";
      } else if (carbs > diabeticCarbCeiling) {
        exclusionReason =
          `Carb content (${carbs}g) exceeds your current diabetic limit ` +
          `(${diabeticCarbCeiling}g per meal)`;
      }
    }

    if (exclusionReason) {
      excluded.push({ ...item, exclusionReason });
    } else {
      compliant.push(item);
    }
  }

  return { compliant, excluded };
}

/**
 * Build the SAVED GROCERY PREFERENCES block to inject into the Grocery Coach prompt.
 * Only called with items that already passed filterSavedGroceriesForCompliance.
 */
export function buildSavedGroceriesPromptBlock(compliant: SavedGroceryItemSlim[]): string {
  if (compliant.length === 0) return "";

  // Group by category for readability
  const byCategory: Record<string, SavedGroceryItemSlim[]> = {};
  for (const item of compliant) {
    const cat = item.category ?? "General";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  const lines: string[] = [
    "SAVED GROCERY PREFERENCES (user's vetted favorites — already cleared against today's protocol):",
  ];
  for (const [cat, items] of Object.entries(byCategory)) {
    lines.push(`  ${cat}:`);
    for (const item of items) {
      const brandPart = item.brand ? ` by ${item.brand}` : "";
      lines.push(`    • ${item.productName}${brandPart}`);
    }
  }
  lines.push(
    "",
    "INSTRUCTION: When building today's shopping list, check these saved favorites first.",
    "If a saved item is relevant to this meal, list it as '★ Your Saved Choice' and then offer",
    "1-2 compliant alternatives so the user has options. Saved items are preferences, not locks.",
    "If no saved item applies, proceed normally with your best recommendations.",
  );

  return lines.join("\n");
}
