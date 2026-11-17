import {
  describeFridgeRescueShortfall,
  type FridgeRescueCompletion,
} from "../../shared/fridgeRescueCompletion";

interface MealIdentity {
  name: string;
  ingredients?: Array<string | { name?: string; item?: string }>;
  instructions?: string | string[];
}

const normalize = (value: string) => value.normalize("NFKC").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function recipeSignature(meal: MealIdentity): string {
  const ingredients = (meal.ingredients ?? []).map(item =>
    normalize(typeof item === "string" ? item : item.name ?? item.item ?? ""),
  ).filter(Boolean).sort();
  const instructions = normalize(
    Array.isArray(meal.instructions) ? meal.instructions.join(" ") : meal.instructions ?? "",
  );
  // Names alone also identify duplicates. This second key catches a renamed
  // copy with identical ingredients and preparation, ignoring quantities/IDs.
  return ingredients.length && instructions ? `${ingredients.join("|")}::${instructions}` : "";
}

/**
 * Bounded completion only; the caller owns the FULL validation pipeline.
 * No candidate enters the result without passing that same pipeline.
 */
export async function completeFridgeRescueChoices<T extends MealIdentity>(options: {
  enabled: boolean;
  generate: (request: { count: number; excludedMeals: string[] }) => Promise<T[]>;
  validate: (meals: T[]) => Promise<{ accepted: T[]; reasonCodes: string[] }>;
}): Promise<{ meals: T[]; completion: FridgeRescueCompletion }> {
  const requestedCount = 3;
  // One initial generation plus at most two missing-slot replenishments.
  const maxAttempts = options.enabled ? 3 : 1;
  const accepted: T[] = [];
  const names = new Set<string>();
  const signatures = new Set<string>();
  const reasons = new Set<string>();
  let attempts = 0;
  while (attempts < maxAttempts && accepted.length < requestedCount) {
    attempts++;
    const missing = requestedCount - accepted.length;
    try {
      const generated = await options.generate({
        count: missing,
        excludedMeals: accepted.map(meal => meal.name),
      });
      if (generated.length < missing) reasons.add("GENERATOR_SHORTFALL");
      const checked = await options.validate(generated);
      for (const reason of checked.reasonCodes) reasons.add(reason);
      if (checked.accepted.length < generated.length) reasons.add("CANDIDATES_REJECTED");
      for (const meal of checked.accepted) {
        const name = normalize(meal.name);
        const signature = recipeSignature(meal);
        if (options.enabled && (names.has(name) || (signature && signatures.has(signature)))) {
          reasons.add("DUPLICATE_CANDIDATES");
          continue;
        }
        accepted.push(meal);
        names.add(name);
        if (signature) signatures.add(signature);
        if (options.enabled && accepted.length === requestedCount) break;
      }
    } catch (error) {
      // Preserve the established initial-error path. A failed top-up must not
      // discard already verified choices or allow unvalidated ones through.
      if (attempts === 1) throw error;
      reasons.add("REPLENISHMENT_UNAVAILABLE");
      break;
    }
  }
  const partial = accepted.length < requestedCount;
  if (partial && attempts === maxAttempts) reasons.add("RETRY_LIMIT_REACHED");
  return {
    meals: accepted,
    completion: {
      requestedCount,
      returnedCount: accepted.length,
      partial,
      attempts,
      maxAttempts,
      reasonCodes: [...reasons],
      message: describeFridgeRescueShortfall(accepted.length, requestedCount, [...reasons]),
    },
  };
}
