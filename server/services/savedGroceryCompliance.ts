/**
 * Saved Grocery Compliance Filter
 *
 * Determines which of a user's saved grocery items are still compliant with
 * their current protocol envelope — WITHOUT calling the LLM.
 *
 * Hierarchy (mirrors the platform-wide rule):
 *   Allergies → Avoidances → GLP-1 fat ceiling → Diabetic carb ceiling
 *
 * Only compliant items are surfaced to Grocery Coach as "vetted favorites."
 * The LLM is never asked to interpret clinical rules itself.
 */

import type { UserProtocolEnvelope } from "./protocolEnvelope";

export interface SavedGroceryItemSlim {
  id: string;
  productName: string;
  brand: string | null;
  category: string | null;
  productKey: string;
  nutritionJson: Record<string, number> | null;
  savedAt: Date | string;
}

export interface ComplianceFilterResult {
  compliant: SavedGroceryItemSlim[];
  excluded: Array<SavedGroceryItemSlim & { exclusionReason: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function productMatchesTerm(item: SavedGroceryItemSlim, term: string): boolean {
  const t = normalize(term);
  if (normalize(item.productName).includes(t)) return true;
  if (item.brand && normalize(item.brand).includes(t)) return true;
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

    // ── Tier 1: Allergy blocks — absolute hard stops ──
    for (const allergen of envelope.allergies) {
      if (allergen && productMatchesTerm(item, allergen)) {
        exclusionReason = `Contains or may contain ${allergen} (allergen on your profile)`;
        break;
      }
    }

    // ── Tier 2: Avoidances ──
    if (!exclusionReason) {
      for (const avoid of envelope.avoidances) {
        if (avoid && productMatchesTerm(item, avoid)) {
          exclusionReason = `Conflicts with your "${avoid}" avoidance preference`;
          break;
        }
      }
    }

    // ── Tier 3: GLP-1 fat ceiling (requires nutrition data at save time) ──
    if (!exclusionReason && glp1Targets && item.nutritionJson) {
      const fat = Number(item.nutritionJson.fat);
      if (Number.isFinite(fat) && fat > glp1Targets.maximumToleratedFatGrams) {
        exclusionReason =
          `Fat content (${fat}g) exceeds your current GLP-1 limit ` +
          `(${glp1Targets.maximumToleratedFatGrams}g per meal)`;
      }
    }

    // ── Tier 4: Diabetic carb ceiling (requires nutrition data at save time) ──
    if (!exclusionReason && isDiabetic && typeof diabeticCarbCeiling === "number" && item.nutritionJson) {
      const carbs = Number(item.nutritionJson.carbs);
      if (Number.isFinite(carbs) && carbs > diabeticCarbCeiling) {
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
