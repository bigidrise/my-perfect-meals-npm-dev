import type { ProductEvidenceAdapter, SourceProductRecord } from "./productEvidenceAdapters";
import { canonicalGtin } from "./productEvidenceAdapters";
import {
  lookupOpenFoodFactsByBarcode,
  normalizeOffIdentityText,
  offFactsFromExactLookup,
  offIdentityMatches,
} from "./openFoodFactsLookup";

interface OffSearchHit {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string[] | string;
  countries_tags?: string[];
  categories_tags?: string[];
  quantity?: string;
}

/**
 * Bounded Development fallback when USDA search is unavailable. Search hits
 * provide identity leads only; read() must fetch the exact barcode record.
 */
export function createOpenFoodFactsSearchAdapter(
  fetcher: typeof fetch = fetch,
  pagesPerCategory = 1,
  maxReferencesPerPage = 25,
): ProductEvidenceAdapter {
  const leads = new Map<string, SourceProductRecord>();
  return {
    source: "open_food_facts",
    async search(intent, cursor, limit) {
      const [passText, categoryText] = cursor?.split(":") ?? ["1", "0"];
      const pass = Number(passText);
      const index = Number(categoryText);
      if (!Number.isInteger(pass) || pass < 1 || pass > pagesPerCategory ||
          !Number.isInteger(index) || index < 0 || index >= intent.searchCategories.length) {
        throw new Error("Invalid OFF search cursor.");
      }
      const category = intent.searchCategories[index].category.trim().slice(0, 80);
      if (!category) throw new Error("Product category is required.");
      const url = new URL("https://search.openfoodfacts.org/search");
      url.searchParams.set("q", category);
      url.searchParams.set("page_size", "25");
      url.searchParams.set("page", String(pass));
      const response = await fetcher(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MyPerfectMeals/1.0 (https://myperfectmeals.com)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`OFF search unavailable (${response.status})`);
      const payload = await response.json() as { hits?: OffSearchHit[] };
      if (!Array.isArray(payload.hits)) throw new Error("OFF search response is invalid.");
      const terms = category.toLowerCase().normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [];
      const retrievedAt = new Date().toISOString();
      const references: { source: "open_food_facts"; sourceRecordId: string }[] = [];
      for (const hit of payload.hits) {
        if (references.length >= Math.min(limit, maxReferencesPerPage, 25)) break;
        const code = hit.code?.trim() ?? "";
        const name = (hit.product_name_en || hit.product_name || "").trim();
        const brands = Array.isArray(hit.brands) ? hit.brands : (hit.brands || "").split(",");
        const brand = brands[0]?.trim() ?? "";
        const productAndCategories = normalizeOffIdentityText([
          name, ...(hit.categories_tags ?? []),
        ].join(" "));
        const categoryTags = (hit.categories_tags ?? []).join(" ").toLowerCase();
        const brandText = normalizeOffIdentityText(brands.join(" "));
        if (!canonicalGtin(code) || !name || !brand ||
            !hit.countries_tags?.includes("en:united-states") ||
            !terms.every((term) => productAndCategories.includes(term) ||
              (terms.length > 1 && brandText.includes(term)))) continue;
        if (intent.purpose === "drink" &&
            /en:(?:chocolates|candies|confectioneries|ice-creams)\b/.test(categoryTags) &&
            !/en:(?:beverages|milks|plant-based-milks)\b/.test(categoryTags)) continue;
        const record: SourceProductRecord = {
          source: "open_food_facts", sourceRecordId: code,
          observedAt: null, retrievedAt, market: "United States",
          name, brand, barcode: code,
          packageSize: hit.quantity?.trim() || undefined,
          variant: [name, hit.quantity].filter(Boolean).join(" · "),
          // The exact barcode read below re-checks this assertion.
          exactVariantMatch: true, facts: [],
          research: [{ source: "open_food_facts", result: "matched", phase: "search" }],
        };
        if (leads.has(code)) continue;
        leads.set(code, record);
        references.push({ source: "open_food_facts", sourceRecordId: code });
      }
      return {
        references,
        // Visit all requested categories before a deeper page of any one.
        nextCursor: index + 1 < intent.searchCategories.length ? `${pass}:${index + 1}`
          : pass < pagesPerCategory ? `${pass + 1}:0` : null,
      };
    },
    async read(reference) {
      const lead = leads.get(reference.sourceRecordId);
      if (!lead || reference.source !== "open_food_facts") throw new Error("OFF lead not in search snapshot.");
      const lookup = await lookupOpenFoodFactsByBarcode(lead.barcode!, fetcher);
      if (!offIdentityMatches(lookup, lead) || !lookup.product || !lookup.barcode) {
        throw new Error("OFF exact barcode lookup unavailable or mismatched.");
      }
      const retrievedAt = new Date().toISOString();
      // In primary-OFF mode these are source facts, not USDA supplements.
      const facts = offFactsFromExactLookup(lookup, retrievedAt).map(
        ({ supplementalProvenance: _supplemental, ...fact }) => fact,
      );
      return {
        ...lead, retrievedAt,
        identityObservedAt: retrievedAt,
        sourceVersion: Number.isFinite(lookup.product.last_modified_t)
          ? String(lookup.product.last_modified_t) : undefined,
        servingDescription: lookup.product.serving_size,
        facts,
        research: [
          ...(lead.research ?? []),
          { source: "open_food_facts" as const, result: "matched" as const, phase: "barcode_lookup" as const },
        ],
      };
    },
  };
}