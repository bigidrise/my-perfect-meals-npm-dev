/**
 * Read-only public USDA probe. No app bootstrap, database, AI, or saved writes.
 * Run baseline/normalized in SEPARATE processes for comparable cold caches:
 * NODE_ENV=development node_modules/.bin/tsx scripts/probe-gatherings-resolver-phase-a.ts baseline
 * NODE_ENV=development node_modules/.bin/tsx scripts/probe-gatherings-resolver-phase-a.ts normalized
 * Redirect JSON to /tmp or the already-ignored generated-artifacts directory.
 */
import { christmasSmokeGatheringsRecipes } from "../server/tests/fixtures/gatheringsChristmasRecipes";
import { parseGatheringsIngredient } from "../server/services/gatheringsIngredientParser";
import { calculateGatheringsNutrition, createGatheringsLookup, gatheringsNutritionEnabled } from "../server/services/gatheringsNutrition";
import { dessertIngredientGrams } from "../server/services/dessertNutrition";
import { createGatheringsIngredientResolverPhaseA, type PhaseAIngredientResolution } from "../server/services/gatheringsIngredientResolverPhaseA";
import { normalizeGatheringsIngredient } from "../server/services/gatheringsIngredientNormalization";

async function main() {
  const mode = process.argv[2];
  if (!["baseline", "normalized"].includes(mode) || !gatheringsNutritionEnabled()) {
    throw new Error("Use baseline or normalized in an isolated Development process.");
  }
  const responseStatuses: number[] = [];
  const observedFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    responseStatuses.push(response.status);
    return response;
  };
  const baseline = createGatheringsLookup(observedFetch);
  const normalized = mode === "normalized" ? createGatheringsIngredientResolverPhaseA(observedFetch) : undefined;
  const started = Date.now();
  const recipes = [];
  for (const fixture of christmasSmokeGatheringsRecipes) {
    const ingredients = fixture.ingredientLines.map(parseGatheringsIngredient);
    const entries: PhaseAIngredientResolution[] = [];
    for (const ingredient of ingredients) {
      if (normalized) {
        entries.push(await normalized.resolve(ingredient));
        continue;
      }
      try {
        const source = await baseline.lookup(ingredient.name);
        const converted = source && dessertIngredientGrams({
          name: ingredient.name, amount: String(ingredient.amount), unit: ingredient.unit!,
        }, source);
        const complete = source && Object.values(source.macrosPer100g).every(value =>
          typeof value === "number" && Number.isFinite(value) && value >= 0);
        entries.push({
          normalized: normalizeGatheringsIngredient(ingredient),
          status: !source || !converted ? "needs_review" : complete ? "available" : "unavailable",
          ...(!source ? { reason: "identity_unresolved" } : !converted
            ? { reason: "portion_unresolved" } : !complete ? { reason: "required_nutrients_missing" } : {}),
          ...(source ? { source } : {}), ...(converted || {}),
        });
      } catch {
        entries.push({ normalized: normalizeGatheringsIngredient(ingredient), status: "unavailable", reason: "source_unavailable_or_budget" });
      }
    }
    const result = await calculateGatheringsNutrition(
      { name: fixture.name, ingredients }, fixture.servings, async name => {
        const index = ingredients.findIndex(ingredient => ingredient.name === name);
        return entries[index]?.status === "available" ? entries[index].source! : null;
      },
    );
    recipes.push({
      name: fixture.name, occurrences: entries.length,
      resolved: entries.filter(entry => entry.status === "available").length,
      completeNutrition: entries.every(entry => entry.status === "available") && result.nutritionResult.status === "available",
      recipeStatus: result.nutritionResult.status,
      ...(result.nutrition ? { nutrition: result.nutrition } : {}),
      entries,
    });
  }
  console.log(JSON.stringify({
    mode, observedAt: new Date().toISOString(),
    evidence: "live public USDA; original recipes have no supplied instructions",
    elapsedMs: Date.now() - started, responseStatuses,
    metrics: normalized ? { ...normalized.metrics, lookup: normalized.lookupMetrics } : baseline.metrics,
    resolved: recipes.reduce((total, recipe) => total + recipe.resolved, 0),
    occurrences: recipes.reduce((total, recipe) => total + recipe.occurrences, 0),
    completeRecipes: recipes.filter(recipe => recipe.completeNutrition).length,
    recipes,
  }, null, 2));
}
main().catch(() => {
  // Never print credential-bearing fetch URLs or raw network exception details.
  console.error("Isolated USDA probe failed; no application or database changes made.");
  process.exitCode = 1;
});
