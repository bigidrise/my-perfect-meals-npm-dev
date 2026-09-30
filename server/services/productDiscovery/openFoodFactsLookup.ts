import type { SourceProductRecord } from "./productEvidenceAdapters";
import { canonicalGtin } from "./productEvidenceAdapters";

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  countries_tags?: string[];
  ingredients_text?: string;
  traces_tags?: string[];
  allergens_tags?: string[];
  labels_tags?: string[];
  quantity?: string;
  serving_size?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
  last_modified_t?: number;
}

export interface OffBarcodeLookup {
  status: "matched" | "not_found" | "unavailable";
  product?: OffProduct;
  barcode?: string;
}

/** Shared barcode identity lookup: Scan may use the name; discovery uses facts. */
export async function lookupOpenFoodFactsByBarcode(
  barcode: string, fetcher: typeof fetch = fetch,
): Promise<OffBarcodeLookup> {
  const gtin = canonicalGtin(barcode);
  if (!gtin) return { status: "not_found" };
  try {
    const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
    url.searchParams.set("fields", [
      "code", "product_name", "product_name_en", "brands", "countries_tags",
      "ingredients_text", "traces_tags", "allergens_tags", "labels_tags",
      "quantity", "serving_size", "nutrition_data_per", "nutriments", "last_modified_t",
    ].join(","));
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "MyPerfectMeals/1.0 (https://myperfectmeals.com)", Accept: "application/json" },
    });
    if (!response.ok) return { status: "unavailable" };
    const data = await response.json() as { status?: number; code?: string; product?: OffProduct };
    if (data.status !== 1 || !data.product) return { status: "not_found" };
    const code = data.product.code || data.code || "";
    if (canonicalGtin(code) !== gtin) return { status: "not_found" };
    return { status: "matched", product: data.product, barcode: code };
  } catch {
    return { status: "unavailable" };
  }
}

export function normalizeOffIdentityText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function offIdentityMatches(
  lookup: OffBarcodeLookup,
  record: Pick<SourceProductRecord, "name" | "brand" | "market" | "barcode" | "packageSize">,
): boolean {
  if (lookup.status !== "matched" || !lookup.product || !lookup.barcode) return false;
  const off = lookup.product;
  const offName = off.product_name_en || off.product_name || "";
  const brands = (off.brands || "").split(",").map((b) => normalizeOffIdentityText(b.trim())).filter(Boolean);
  const market = off.countries_tags?.includes("en:united-states") ? "United States" : "";
  const sameBrand = brands.includes(normalizeOffIdentityText(record.brand));
  // A matching barcode alone is not enough to merge a contradictory name,
  // brand, market, or explicitly different package size.
  const name = normalizeOffIdentityText(record.name);
  const offNormalizedName = normalizeOffIdentityText(offName);
  const sameName = !!name && !!offNormalizedName &&
    (name === offNormalizedName || name.includes(offNormalizedName) ||
      offNormalizedName.includes(name));
  const offQuantity = normalizeOffIdentityText(off.quantity ?? "");
  const size = normalizeOffIdentityText(record.packageSize ?? "");
  const sameSize = !offQuantity || !size ||
    size.includes(offQuantity) || offQuantity.includes(size);
  return sameBrand && sameName && sameSize && !!market &&
    normalizeOffIdentityText(market) === normalizeOffIdentityText(record.market ?? "") &&
    canonicalGtin(lookup.barcode) === canonicalGtin(record.barcode ?? "");
}

export function offEvidenceForExactUsdaProduct(
  lookup: OffBarcodeLookup, record: SourceProductRecord, retrievedAt: string,
): { result: "matched" | "not_found" | "unavailable" | "identity_mismatch" | "evidence_conflict"; facts: SourceProductRecord["facts"] } {
  if (lookup.status !== "matched" || !lookup.product || !lookup.barcode) {
    return { result: lookup.status, facts: [] };
  }
  if (!offIdentityMatches(lookup, record)) return { result: "identity_mismatch", facts: [] };
  const off = lookup.product;
  const primaryIngredients = record.facts.find((fact) => fact.kind === "ingredients")?.originalStatement;
  if (primaryIngredients && off.ingredients_text &&
      normalizeOffIdentityText(primaryIngredients) !== normalizeOffIdentityText(off.ingredients_text)) {
    // A matching GTIN cannot justify combining different formulations.
    return { result: "evidence_conflict", facts: [] };
  }
  return { result: "matched", facts: offFactsFromExactLookup(lookup, retrievedAt) };
}

/** Facts only from the exact barcode response, never the search index. */
export function offFactsFromExactLookup(
  lookup: OffBarcodeLookup, retrievedAt: string,
): SourceProductRecord["facts"] {
  if (lookup.status !== "matched" || !lookup.product || !lookup.barcode ||
      !lookup.product.countries_tags?.includes("en:united-states")) return [];
  const off = lookup.product;
  const provenance = {
    source: "open_food_facts" as const,
    sourceRecordId: lookup.barcode,
    barcode: lookup.barcode,
    market: "United States",
    // OFF edit time is not proof of the formulation's observation date.
    observedAt: null,
    retrievedAt,
  };
  const facts: SourceProductRecord["facts"][number][] = [];
  if (off.ingredients_text?.trim()) facts.push({
    kind: "ingredients", originalStatement: off.ingredients_text.trim(),
    completeness: "unknown", supplementalProvenance: provenance,
  });
  if (off.allergens_tags?.length) facts.push({
    kind: "declared_allergens", originalStatement: `Catalog declared allergens: ${off.allergens_tags.join(", ")}`,
    completeness: "partial", supplementalProvenance: provenance,
  });
  if (off.traces_tags?.length) facts.push({
    kind: "precautionary_allergens", target: off.traces_tags.join(", "),
    originalStatement: `Catalog traces: ${off.traces_tags.join(", ")}`,
    completeness: "partial", precautionaryStatus: "declared_present",
    supplementalProvenance: provenance,
  });
  // Empty allergen/traces arrays do not assert absence or cross-contact safety.
  for (const label of off.labels_tags ?? []) {
    facts.push({
      kind: "certification", target: label,
      originalStatement: `Catalog label tag: ${label}`,
      completeness: "partial", supplementalProvenance: provenance,
    });
  }
  const basis = off.nutrition_data_per === "100ml" ? "per_100ml" : "per_100g";
  const nutrients = [
    ["carbohydrates", "carbs", "g"],
    ["proteins", "protein", "g"],
    ["fat", "fat", "g"],
    ["energy-kcal", "calories", "kcal"],
    ["sodium", "sodium", "g"],
  ] as const;
  for (const [offKey, target, unit] of nutrients) {
    const value = off.nutriments?.[`${offKey}_${basis === "per_100ml" ? "100ml" : "100g"}`];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    facts.push({
      kind: "nutrition", target: `${target}_${unit}_${basis}`,
      originalStatement: `${offKey}: ${value} ${unit} per ${basis === "per_100ml" ? "100ml" : "100g"} (OFF record)`,
      completeness: "unknown",
      nutritionMeasurement: { value, unit, basis },
      supplementalProvenance: provenance,
    });
  }
  return facts;
}