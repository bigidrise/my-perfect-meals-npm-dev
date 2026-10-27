/**
 * ISOLATED DEVELOPMENT VALIDATOR. Not imported by any route or generator.
 * Phase B requires separate approval, including complete-recipe evidence.
 */
import {
  createGatheringsLookup, gatheringsNutritionEnabled, GATHERINGS_USDA_BUDGET,
} from "./gatheringsNutrition";
import { dessertIngredientGrams } from "./dessertNutrition";
import type { GatheringsIngredient } from "./gatheringsIngredientParser";
import type { IngredientComposition } from "./productDiscovery/usdaIngredientAdapter";
import {
  ingredientIdentityKey, normalizeGatheringsIngredient, verifiedGatheringsCandidate,
  type NormalizedGatheringsIngredient,
} from "./gatheringsIngredientNormalization";

export interface PhaseAIngredientResolution {
  status: "available" | "needs_review" | "unavailable";
  normalized: NormalizedGatheringsIngredient;
  reason?: string;
  source?: IngredientComposition;
  grams?: number;
  conversion?: string;
}
type SearchFood = { fdcId: number; description: string; dataType: string };
type SearchSnapshot = { foods?: SearchFood[] };
const MASS = /^(g|grams?|kg|kilograms?|mg|milligrams?|oz|ounces?|lb|lbs|pounds?)$/i;

export function createGatheringsIngredientResolverPhaseA(fetcher: typeof fetch = fetch) {
  if (!gatheringsNutritionEnabled()) throw new Error("Phase A resolver is Development-only");
  const metrics = {
    httpRequests: 0, sourceMs: 0, searchReuses: 0, resolutionReuses: 0,
    responseStatuses: [] as number[],
  };
  const snapshots = new Map<string, SearchSnapshot>();
  const exactSearches = new Map<string, SearchSnapshot>();
  const resolutions = new Map<string, Promise<PhaseAIngredientResolution>>();
  let failure: string | undefined;
  const transport: typeof fetch = async (input, init) => {
    if (failure) throw new Error(failure);
    const url = new URL(String(input));
    const query = url.searchParams.get("query");
    if (url.pathname.endsWith("/foods/search") && query) {
      const previous = exactSearches.get(ingredientIdentityKey(query));
      if (previous) {
        metrics.searchReuses++;
        snapshots.set(ingredientIdentityKey(query), previous);
        return { ok: true, status: 200, json: async () => previous } as Response;
      }
    }
    const remaining = GATHERINGS_USDA_BUDGET.sourceMs - metrics.sourceMs;
    if (metrics.httpRequests >= GATHERINGS_USDA_BUDGET.httpRequests || remaining <= 0) {
      failure = "source_budget_exhausted";
      throw new Error(failure);
    }
    metrics.httpRequests++;
    const started = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        (async () => {
          const raw = await fetcher(input, {
            ...init, signal: init?.signal
              ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
          });
          metrics.responseStatuses.push(raw.status);
          if (!raw.ok) throw new Error(`usda_http_${raw.status}`);
          return { body: await raw.json(), status: raw.status };
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("source_timeout"));
          }, Math.min(GATHERINGS_USDA_BUDGET.fetchMs, remaining));
        }),
      ]);
      if (url.pathname.endsWith("/foods/search") && query) {
        if (!Array.isArray(response.body?.foods)) throw new Error("invalid_search_response");
        snapshots.set(ingredientIdentityKey(query), response.body);
        // Reuse the ACTUAL search payload for exact descriptions it contains.
        // The shared adapter still verifies exact description, type and detail ID.
        for (const food of response.body.foods) {
          if (typeof food.description === "string") {
            exactSearches.set(ingredientIdentityKey(food.description), response.body);
          }
        }
      }
      return { ok: true, status: response.status, json: async () => response.body } as Response;
    } catch (error) {
      failure = error instanceof Error && /^(usda_http_\d+|source_timeout|invalid_search_response)$/.test(error.message)
        ? error.message : "source_unavailable";
      throw new Error(failure);
    } finally {
      clearTimeout(timer);
      metrics.sourceMs += Date.now() - started;
    }
  };
  const existing = createGatheringsLookup(transport);

  async function resolveFresh(ingredient: GatheringsIngredient): Promise<PhaseAIngredientResolution> {
    const normalized = normalizeGatheringsIngredient(ingredient);
    const review = (reason: string): PhaseAIngredientResolution =>
      ({ status: "needs_review", normalized, reason });
    if (ingredient.parseIssue || ingredient.amount == null || !ingredient.unit) return review("quantity_unresolved");
    if (normalized.reviewReason) return review(normalized.reviewReason);
    try {
      let source = await existing.lookup(normalized.searchName);
      if (!source) {
        const candidates = snapshots.get(ingredientIdentityKey(normalized.searchName))?.foods ?? [];
        const verified = candidates.filter(candidate =>
          Number.isInteger(candidate.fdcId) && candidate.fdcId > 0 &&
          ["SR Legacy", "Foundation"].includes(candidate.dataType) &&
          verifiedGatheringsCandidate(normalized, candidate.description));
        const identities = new Map(verified.map(candidate => [candidate.fdcId, candidate]));
        // No arbitrary first hit when multiple records could represent the food.
        if (identities.size === 1) {
          const candidate = [...identities.values()][0];
          source = await existing.lookup(candidate.description);
          if (source && (source.fdcId !== candidate.fdcId ||
            source.description !== candidate.description || source.dataType !== candidate.dataType)) {
            return review("candidate_detail_identity_mismatch");
          }
        } else if (identities.size > 1) return review("multiple_verified_candidates");
      }
      // Preserve an established reviewed mapping; do not add aliases to it.
      if (!source && normalized.searchName !== ingredient.name.toLowerCase()) {
        source = await existing.lookup(ingredient.name);
      }
      if (!source) return review("identity_or_state_unverified");
      const snapshot = snapshots.get(ingredientIdentityKey(normalized.searchName)) ??
        exactSearches.get(ingredientIdentityKey(source.description));
      const matchingIds = new Set((snapshot?.foods ?? []).filter(candidate =>
        ingredientIdentityKey(candidate.description) === ingredientIdentityKey(source!.description) &&
        ["SR Legacy", "Foundation"].includes(candidate.dataType)).map(candidate => candidate.fdcId));
      if (matchingIds.size > 1) return review("multiple_verified_candidates");
      if (!["SR Legacy", "Foundation"].includes(source.dataType) ||
        !Number.isInteger(source.fdcId) || source.fdcId <= 0 ||
        !source.description || !Number.isFinite(Date.parse(source.retrievedAt))) {
        return { status: "unavailable", normalized, reason: "invalid_source_provenance" };
      }
      if (!["calories", "protein", "carbs", "fat"].every(key => {
        const value = source!.macrosPer100g[key as keyof IngredientComposition["macrosPer100g"]];
        return typeof value === "number" && Number.isFinite(value) && value >= 0;
      })) return { status: "unavailable", normalized, reason: "required_nutrients_missing", source };
      const form = normalized.physicalForm ?? source.portionForm;
      let compatibleSource = source;
      if (form && !MASS.test(ingredient.unit)) {
        // Unlike the generic converter, never fall back to unqualified volume
        // weights when the supplied ingredient has an explicit physical form.
        compatibleSource = {
          ...source, portionForm: form,
          portions: source.portions.filter(portion => {
            const measure = ingredientIdentityKey(portion.measure);
            if (measure.split(" ").includes(form)) return true;
            // An unqualified tsp of an explicitly ground source record is
            // ground food. This does not permit "cup whole" or other forms.
            return ingredientIdentityKey(source!.description).split(" ").includes(form) &&
              /^(cup|cups|tsp|tbsp|teaspoon|teaspoons|tablespoon|tablespoons)$/.test(measure);
          }),
        };
      }
      const converted = dessertIngredientGrams({
        name: ingredient.name, amount: String(ingredient.amount), unit: ingredient.unit,
      }, compatibleSource);
      if (!converted) return { ...review("compatible_portion_unverified"), source };
      return { status: "available", normalized, source: compatibleSource, ...converted };
    } catch {
      return { status: "unavailable", normalized, reason: failure ?? "source_unavailable_or_budget" };
    }
  }
  return {
    metrics, lookupMetrics: existing.metrics,
    async resolve(ingredient: GatheringsIngredient): Promise<PhaseAIngredientResolution> {
      // Bind the result to every original field, including quantity and form.
      const key = JSON.stringify(ingredient);
      const previous = resolutions.get(key);
      if (previous) { metrics.resolutionReuses++; return previous; }
      const pending = resolveFresh(ingredient);
      resolutions.set(key, pending);
      return pending;
    },
  };
}
