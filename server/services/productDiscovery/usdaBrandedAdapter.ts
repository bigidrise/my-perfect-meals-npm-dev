import type { ProductEvidenceAdapter, SourceProductRecord } from "./productEvidenceAdapters";
import { canonicalGtin } from "./productEvidenceAdapters";
import { lookupOpenFoodFactsByBarcode, offEvidenceForExactUsdaProduct } from "./openFoodFactsLookup";

interface UsdaSearchFood {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  publishedDate?: string;
  modifiedDate?: string;
  marketCountry?: string;
  foodCategory?: string;
  packageWeight?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: {
    nutrientId: number;
    nutrientName: string;
    unitName: string;
    value: number;
  }[];
}
export const USDA_NUTRIENT_FIELDS: Record<number, { target: string; unit: string }> = {
  1008: { target: "calories_kcal_per_100g", unit: "kcal" },
  1003: { target: "protein_g_per_100g", unit: "g" },
  1004: { target: "fat_g_per_100g", unit: "g" },
  1005: { target: "carbs_g_per_100g", unit: "g" },
  1093: { target: "sodium_mg_per_100g", unit: "mg" },
};
const NUTRIENTS = USDA_NUTRIENT_FIELDS;

/** USDA DEMO_KEY is public and rate-limited; this provider is Development-only. */
export function createUsdaBrandedAdapter(fetcher: typeof fetch = fetch): ProductEvidenceAdapter {
  const records = new Map<string, SourceProductRecord>();
  const cache = new Map<string, { expiresAt: number; foods: UsdaSearchFood[] }>();
  let detailsRateLimited = false;
  return {
    source: "usda_branded",
    async search(intent, cursor, limit) {
      const categoryIndex = cursor === null ? 0 : Number(cursor);
      if (!Number.isInteger(categoryIndex) || categoryIndex < 0 ||
          categoryIndex >= intent.searchCategories.length) {
        throw new Error("Invalid USDA search cursor.");
      }
      const category = intent.searchCategories[categoryIndex].category.trim().slice(0, 80);
      if (!category) throw new Error("A product search category is required.");
      const cacheKey = `${category.toLowerCase()}:${Math.min(limit, 12)}`;
      let foods = cache.get(cacheKey);
      if (!foods || foods.expiresAt < Date.now()) {
        const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
        url.searchParams.set("api_key", "DEMO_KEY");
        url.searchParams.set("query", category);
        url.searchParams.set("dataType", "Branded");
        url.searchParams.set("pageSize", String(Math.min(limit, 12)));
        const response = await fetcher(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`USDA catalog unavailable (${response.status})`);
        const payload = await response.json() as { foods?: UsdaSearchFood[] };
        if (!Array.isArray(payload.foods)) throw new Error("USDA search response is invalid.");
        foods = { foods: payload.foods, expiresAt: Date.now() + 120_000 };
        cache.set(cacheKey, foods);
      }
      const retrievedAt = new Date().toISOString();
      const references = foods.foods.filter((food) =>
        Number.isInteger(food.fdcId) && food.fdcId > 0 &&
        (intent.purpose !== "drink" ||
          !/\bmilk\b/i.test(intent.requestedFood) ||
          /milk|dairy alternative|plant.based dairy/i.test(food.foodCategory ?? ""))).map((food) => {
        const sourceRecordId = String(food.fdcId);
        const ingredients = food.ingredients?.trim();
        const servingDescription = [
          food.householdServingFullText,
          food.servingSize && food.servingSizeUnit
            ? `${food.servingSize} ${food.servingSizeUnit}` : null,
        ].filter(Boolean).join(" · ") || undefined;
        const facts: SourceProductRecord["facts"][number][] = [];
        if (ingredients) facts.push({
          kind: "ingredients",
          originalStatement: ingredients,
          // A catalog field is not proof of a complete *current* package label.
          completeness: "unknown",
        });
        for (const nutrient of food.foodNutrients ?? []) {
          const match = NUTRIENTS[nutrient.nutrientId];
          if (!match || !Number.isFinite(nutrient.value) ||
              nutrient.unitName.toLowerCase() !== match.unit) continue;
          facts.push({
            kind: "nutrition", target: match.target,
            originalStatement: `${nutrient.nutrientName}: ${nutrient.value} ${match.unit} per 100g (USDA record)`,
            completeness: "unknown",
            nutritionMeasurement: {
              value: nutrient.value, unit: match.unit, basis: "per_100g",
            },
          });
        }
        records.set(sourceRecordId, {
          source: "usda_branded",
          sourceRecordId,
          sourceVersion: food.publishedDate,
          observedAt: food.publishedDate ?? food.modifiedDate ?? null,
          retrievedAt,
          name: food.description?.trim() ?? "",
          brand: (food.brandName || food.brandOwner || "").trim(),
          variant: [food.description, food.packageWeight].filter(Boolean).join(" · "),
          packageSize: food.packageWeight,
          servingDescription,
          barcode: food.gtinUpc?.trim(),
          market: food.marketCountry?.trim(),
          exactVariantMatch: !!food.gtinUpc && !!food.description && !!food.marketCountry,
          facts,
          research: [{ source: "usda_branded", result: "matched", phase: "search" }],
        });
        return { source: "usda_branded" as const, sourceRecordId };
      });
      return {
        references,
        nextCursor: categoryIndex + 1 < intent.searchCategories.length
          ? String(categoryIndex + 1) : null,
      };
    },
    async read(reference) {
      const record = records.get(reference.sourceRecordId);
      if (!record) throw new Error("USDA record is not in this search snapshot.");
      return record;
    },
    async enrich(reference, initial) {
      if (reference.sourceRecordId !== initial.sourceRecordId ||
          initial.source !== "usda_branded") {
        throw new Error("USDA enrichment reference does not match the candidate.");
      }
      const research = [...initial.research ?? []];
      let record = initial;
      if (!detailsRateLimited) {
        try {
          const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(reference.sourceRecordId)}`);
          url.searchParams.set("api_key", "DEMO_KEY");
          const response = await fetcher(url, {
            headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7000),
          });
          if (response.status === 429) detailsRateLimited = true;
          if (!response.ok) throw new Error(`USDA detail ${response.status}`);
          const detail = await response.json() as {
            fdcId?: number; gtinUpc?: string; ingredients?: string;
            foodNutrients?: { nutrient?: { id?: number; name?: string; unitName?: string }; amount?: number }[];
          };
          if (String(detail.fdcId) !== reference.sourceRecordId ||
              canonicalGtin(detail.gtinUpc ?? "") !== canonicalGtin(initial.barcode ?? "")) {
            research.push({ source: "usda_branded", result: "identity_mismatch", phase: "detail" });
          } else {
            const detailedFacts: SourceProductRecord["facts"][number][] = [];
            if (detail.ingredients?.trim()) detailedFacts.push({
              kind: "ingredients", originalStatement: detail.ingredients.trim(),
              completeness: "unknown",
            });
            for (const nutrient of detail.foodNutrients ?? []) {
              const match = NUTRIENTS[nutrient.nutrient?.id ?? -1];
              if (!match || typeof nutrient.amount !== "number" ||
                  !Number.isFinite(nutrient.amount) ||
                  nutrient.nutrient?.unitName?.toLowerCase() !== match.unit) continue;
              detailedFacts.push({
                kind: "nutrition", target: match.target,
                originalStatement: `${nutrient.nutrient.name}: ${nutrient.amount} ${match.unit} per 100g (USDA exact record)`,
                completeness: "unknown",
                nutritionMeasurement: { value: nutrient.amount, unit: match.unit, basis: "per_100g" },
              });
            }
            // Do not mix nutrient revisions within one USDA candidate: use
            // the exact detail facts for each kind when present.
            record = {
              ...record,
              facts: [
                ...initial.facts.filter((fact) =>
                  fact.kind !== "ingredients" || !detailedFacts.some((d) => d.kind === "ingredients"))
                  .filter((fact) => fact.kind !== "nutrition" ||
                    !detailedFacts.some((d) => d.kind === "nutrition" && d.target === fact.target)),
                ...detailedFacts,
              ],
            };
            research.push({ source: "usda_branded", result: "matched", phase: "detail" });
          }
        } catch {
          research.push({ source: "usda_branded", result: "unavailable", phase: "detail" });
        }
      } else {
        research.push({ source: "usda_branded", result: "unavailable", phase: "detail" });
      }
      if (record.barcode) {
        const off = await lookupOpenFoodFactsByBarcode(record.barcode, fetcher);
        const supplement = offEvidenceForExactUsdaProduct(off, record, new Date().toISOString());
        research.push({ source: "open_food_facts", result: supplement.result, phase: "barcode_lookup" });
        if (supplement.result === "matched") {
          record = {
            ...record,
            identityObservedAt: new Date().toISOString(),
            facts: [...record.facts, ...supplement.facts],
          };
        }
      } else {
        research.push({ source: "open_food_facts", result: "skipped", phase: "barcode_lookup" });
      }
      return { ...record, research };
    },
  };
}