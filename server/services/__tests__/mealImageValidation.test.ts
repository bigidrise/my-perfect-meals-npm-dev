/**
 * Meal Image Recipe-Fidelity Validation — regression tests
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/services/__tests__/mealImageValidation.test.ts
 *
 * Covers the dangerous "traditional composition" dishes: for each, the recipe
 * contract deliberately EXCLUDES the traditional ingredient, a scripted vision
 * model reports the offender visible in the image, and the validator must
 * return FAIL with the offender named — never PASS on cultural convention.
 *
 * Also covers: PASS parsing, SKIPPED on missing ingredients, SKIPPED on vision
 * error/timeout, retry-prompt exclusion wording, and recipe signature stability.
 */

import { buildStableCacheKey, isCacheRowServable } from "../mealImageGenerator";
import {
  validateImageAgainstRecipe,
  parseValidationResponse,
  buildValidationPrompt,
  buildRetryExclusionAddendum,
  computeRecipeSignature,
  VALIDATION_MODEL,
  type VisionCaller,
} from "../mealImageValidator";

let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failMessages.push(label);
    console.log(`  ❌ ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scripted vision model: knows the traditional composition of famous dishes.
// If the image (simulated as "traditional rendering of the dish") contains a
// major traditional ingredient that is NOT in the recipe contract embedded in
// the prompt, it reports FAIL — exactly what a compliant GPT-4o run does.
// ─────────────────────────────────────────────────────────────────────────────

const TRADITIONAL_COMPOSITION: Record<string, string[]> = {
  "niçoise": ["hard-boiled egg", "tuna", "olives", "green beans", "potatoes"],
  "cobb": ["bacon", "hard-boiled egg", "blue cheese", "chicken", "avocado"],
  "waldorf": ["walnuts", "mayonnaise", "apple", "celery", "grapes"],
  "caesar": ["anchovies", "parmesan", "croutons", "romaine"],
  "carbonara": ["egg", "pancetta", "pecorino", "spaghetti"],
  "alfredo": ["heavy cream", "parmesan", "butter", "fettuccine"],
  "benedict": ["poached egg", "hollandaise", "english muffin", "canadian bacon"],
  "ramen": ["soft-boiled egg", "noodles", "pork", "broth"],
  "paella": ["shrimp", "mussels", "rice", "saffron", "chorizo"],
};

function scriptedVision(dishKey: string): VisionCaller {
  return async (_imageUrl, prompt) => {
    // Extract the recipe contract lines from the prompt
    const contract = prompt
      .split("\n")
      .filter(l => l.startsWith("- "))
      .map(l => l.slice(2).toLowerCase());
    const traditional = TRADITIONAL_COMPOSITION[dishKey] ?? [];
    // "The image" is the traditional rendering; find a visible major ingredient
    // not covered by the recipe contract.
    const offender = traditional.find(
      t => !contract.some(c => c.includes(t) || t.includes(c))
    );
    return offender ? `FAIL: ${offender} visible` : "PASS";
  };
}

async function run() {
  // ── 1. Dangerous-dish regression suite ────────────────────────────────────
  console.log("\n1. Dangerous dishes — validator catches the excluded traditional ingredient");

  const cases: Array<{ dishKey: string; mealName: string; recipe: string[]; mustDetect: string }> = [
    { dishKey: "niçoise", mealName: "Salade Niçoise", mustDetect: "hard-boiled egg",
      recipe: ["tuna", "olives", "green beans", "potatoes", "tomatoes", "vinaigrette"] }, // no eggs
    { dishKey: "cobb", mealName: "Cobb Salad", mustDetect: "bacon",
      recipe: ["chicken", "avocado", "tomatoes", "romaine", "blue cheese"] }, // no bacon/egg — bacon found first
    { dishKey: "waldorf", mealName: "Waldorf Salad", mustDetect: "walnuts",
      recipe: ["apple", "celery", "grapes", "greek yogurt dressing"] }, // no walnuts/mayo
    { dishKey: "caesar", mealName: "Caesar Salad", mustDetect: "anchovies",
      recipe: ["romaine", "parmesan", "croutons", "lemon dressing"] }, // no anchovies
    { dishKey: "carbonara", mealName: "Vegan Carbonara", mustDetect: "egg",
      recipe: ["spaghetti", "cashew cream", "smoked tofu", "nutritional yeast"] }, // vegan sub
    { dishKey: "alfredo", mealName: "Dairy-Free Alfredo", mustDetect: "heavy cream",
      recipe: ["fettuccine", "cashew cream", "garlic", "olive oil"] }, // dairy-free
    { dishKey: "benedict", mealName: "GLP-1 Eggs Benedict", mustDetect: "hollandaise",
      recipe: ["poached egg", "english muffin", "smoked salmon", "greek yogurt sauce"] }, // GLP-1 sub
    { dishKey: "ramen", mealName: "Shoyu Ramen", mustDetect: "soft-boiled egg",
      recipe: ["noodles", "pork", "broth", "scallions", "nori"] }, // no egg
    { dishKey: "paella", mealName: "Chicken Paella", mustDetect: "shrimp",
      recipe: ["rice", "saffron", "chicken", "chorizo", "peas"] }, // shellfish allergy
  ];

  for (const c of cases) {
    const result = await validateImageAgainstRecipe(
      "https://example.com/generated.png",
      c.mealName,
      c.recipe,
      { visionCaller: scriptedVision(c.dishKey) }
    );
    assert(
      result.verdict === "FAIL" && (result.reason ?? "").includes(c.mustDetect),
      `${c.mealName}: FAIL detects "${c.mustDetect}" (got ${result.verdict}: ${result.reason})`
    );
  }

  // ── 2. Compliant image passes ──────────────────────────────────────────────
  console.log("\n2. Compliant image passes");
  {
    const result = await validateImageAgainstRecipe(
      "https://example.com/generated.png",
      "Salade Niçoise",
      ["tuna", "olives", "green beans", "potatoes", "hard-boiled egg", "tomatoes", "vinaigrette"],
      { visionCaller: scriptedVision("niçoise") }
    );
    assert(result.verdict === "PASS" && result.reason === null, "Full traditional recipe → PASS");
    assert(result.model === VALIDATION_MODEL, `validation model recorded (${VALIDATION_MODEL})`);
  }

  // ── 3. Response parsing ────────────────────────────────────────────────────
  console.log("\n3. Response parsing");
  assert(parseValidationResponse("PASS").verdict === "PASS", "PASS parsed");
  assert(parseValidationResponse("  pass\n").verdict === "PASS", "lowercase/whitespace PASS parsed");
  {
    const r = parseValidationResponse("FAIL: hard-boiled egg visible");
    assert(r.verdict === "FAIL" && r.reason === "hard-boiled egg visible", "FAIL with reason parsed");
  }
  assert(parseValidationResponse("FAIL").reason === "unspecified offending ingredient detected", "bare FAIL gets default reason");
  assert(parseValidationResponse("").verdict === "PASS", "empty response defaults to PASS (model instructed to PASS when unsure)");

  // ── 4. SKIPPED paths ───────────────────────────────────────────────────────
  console.log("\n4. SKIPPED paths");
  {
    const r = await validateImageAgainstRecipe("https://x/img.png", "Mystery Meal", []);
    assert(r.verdict === "SKIPPED" && r.reason === "no ingredients provided", "no ingredients → SKIPPED");
  }
  {
    const boom: VisionCaller = async () => { throw new Error("model unavailable"); };
    const r = await validateImageAgainstRecipe("https://x/img.png", "Any Meal", ["rice"], { visionCaller: boom });
    assert(r.verdict === "SKIPPED" && (r.reason ?? "").includes("model unavailable"), "vision error → SKIPPED (never throws)");
  }
  {
    const hang: VisionCaller = () => new Promise(() => {});
    const r = await validateImageAgainstRecipe("https://x/img.png", "Any Meal", ["rice"], { visionCaller: hang, timeoutMs: 50 });
    assert(r.verdict === "SKIPPED" && (r.reason ?? "").includes("timed out"), "vision timeout → SKIPPED");
  }

  // ── 5. Prompt contract framing ─────────────────────────────────────────────
  console.log("\n5. Prompt contract framing");
  {
    const p = buildValidationPrompt("Cobb Salad", ["chicken", "avocado"]);
    assert(p.includes("ONLY source of truth"), "prompt asserts recipe list outranks everything");
    assert(p.includes("- chicken") && p.includes("- avocado"), "prompt embeds ingredient list");
    assert(p.includes("NOT in the recipe contract"), "prompt asks the single narrow question");
  }

  // ── 6. Retry exclusion addendum ────────────────────────────────────────────
  console.log("\n6. Retry exclusion addendum");
  {
    const a = buildRetryExclusionAddendum("Salade Niçoise", "hard-boiled egg visible");
    assert(a.includes("hard-boiled egg visible"), "names the specific detected offender");
    assert(a.includes("CORRECTION FOR PREVIOUS ATTEMPT"), "includes correction context header");
    assert(a.includes("Follow ONLY the recipe contract ingredients"), "reasserts ingredient-only authority");
  }

  // ── 6b. Retry addendum — structural identity ─────────────────────────────
  console.log("\n6b. Retry addendum carries structural identity when provided");
  {
    const structId = "two or three assembled tacos with tortilla shells";
    const a = buildRetryExclusionAddendum("Black Bean Tacos", "image shows a salad bowl", structId);
    assert(a.includes("image shows a salad bowl"), "names the specific form violation");
    assert(a.includes("tortilla shells"), "structural requirement included in retry");
    assert(a.includes("STRUCTURAL REQUIREMENT"), "structural requirement header present");
    assert(a.includes("cannot be relaxed"), "structural requirement is non-negotiable");
    // Taco-specific positive target
    assert(a.includes("assembled tacos") || a.includes("tortilla shells"), "taco positive target is specific");
  }

  // ── 6c. Check C in buildValidationPrompt ─────────────────────────────────
  console.log("\n6c. buildValidationPrompt — Check C for structural form validation");
  {
    const structId = "two or three assembled tacos — soft or hard tortilla shells folded around the filling";
    const p = buildValidationPrompt("Black Bean Tacos", ["black beans", "corn tortillas", "bell pepper"], structId);
    assert(p.includes("CHECK C"), "Check C present when structural identity provided");
    assert(p.includes("Wrong dish form"), "Check C header is 'Wrong dish form'");
    assert(p.includes("tortilla shells"), "structural identity text appears in Check C");
    assert(p.includes("CHECK A"), "Check A still present");
    assert(p.includes("CHECK B"), "Check B still present");
    // Validator without structural identity should NOT have Check C
    const pNoStruct = buildValidationPrompt("Cobb Salad", ["chicken", "avocado"]);
    assert(!pNoStruct.includes("CHECK C"), "Check C absent when no structural identity provided");
  }

  // ── 6d. Check C — structural violation scripted test ──────────────────────
  console.log("\n6d. Check C — structural form violation detected via scripted vision");
  {
    // Simulated vision model: reports the form is wrong (salad instead of tacos)
    // even though the authorized ingredients appear in the image
    const formViolationVision: VisionCaller = async (_url, prompt) => {
      // Check C is in the prompt, so the model can catch form violations
      if (prompt.includes("CHECK C") && prompt.includes("tortilla")) {
        return "FAIL: image shows a salad bowl, not assembled tacos";
      }
      return "PASS";
    };
    const result = await validateImageAgainstRecipe(
      "https://example.com/salad-of-taco-ingredients.png",
      "Black Bean Tacos",
      ["black beans", "corn tortillas", "bell pepper", "onion", "salsa"],
      {
        visionCaller: formViolationVision,
        structuralIdentity: "two or three assembled tacos — tortilla shells folded around the filling",
      }
    );
    assert(result.verdict === "FAIL", "structural form violation → FAIL");
    assert((result.reason ?? "").includes("salad bowl"), "reason names the structural violation");
  }

  // ── 7. Recipe signature ────────────────────────────────────────────────────
  console.log("\n7. Recipe signature");
  {
    const a = computeRecipeSignature(["Tuna", "olives ", "Green Beans"]);
    const b = computeRecipeSignature(["green beans", "tuna", "OLIVES"]);
    const c = computeRecipeSignature(["tuna", "olives"]);
    assert(a === b, "order/case/whitespace-insensitive");
    assert(a !== c, "different ingredient set → different signature");
    assert(/^[0-9a-f]{64}$/.test(a), "SHA-256 hex format");
  }

  // ── 8. Cache identity covers the FULL recipe contract ──────────────────────
  console.log("\n8. Cache identity covers the full recipe contract");
  {
    // Same name + same first five ingredients, but a different sixth ingredient
    // (e.g. hard-boiled egg added) must NOT share a cache entry.
    const base = ["tuna", "olives", "green beans", "potatoes", "tomatoes"];
    const keyA = buildStableCacheKey("Salade Niçoise", [...base, "vinaigrette"]);
    const keyB = buildStableCacheKey("Salade Niçoise", [...base, "hard-boiled egg"]);
    assert(keyA !== keyB, "same top-5, different later ingredient → different cache keys");
    const keyA2 = buildStableCacheKey("salade niçoise ", [...base, "Vinaigrette"].reverse());
    assert(keyA === keyA2, "cache key stable across order/case/whitespace");
  }

  // ── 9. Cache-hit servability gate ──────────────────────────────────────────
  console.log("\n9. Cache-hit servability gate (memory + DB lookups)");
  {
    const sig = computeRecipeSignature(["tuna", "olives"]);
    const otherSig = computeRecipeSignature(["tuna", "olives", "hard-boiled egg"]);
    assert(isCacheRowServable({ validationStatus: "PASS", recipeSignature: sig }, sig), "PASS + matching signature → servable");
    assert(isCacheRowServable({ validationStatus: "SKIPPED", recipeSignature: sig }, sig), "SKIPPED + matching signature → servable (audited)");
    assert(!isCacheRowServable({ validationStatus: "FAIL", recipeSignature: sig }, sig), "FAIL row → never servable");
    assert(!isCacheRowServable({ validationStatus: null, recipeSignature: null }, sig), "legacy NULL-validation row → never servable");
    assert(!isCacheRowServable({ validationStatus: "PASS", recipeSignature: otherSig }, sig), "validated for a different recipe contract → not servable");
    assert(!isCacheRowServable({ validationStatus: "PASS", recipeSignature: null }, sig), "PASS but missing signature → not servable");
  }

  // ── 10. Pipeline fail-closed: no recipe contract → fallback, nothing cached ─
  // Integration-level: exercises the real generateMealImage/generateMealImageUnified
  // pipeline (with a live dev DB) the way /meal-images/generate, generate-batch and
  // hydrate-with-image reach it when clients send no usable ingredients.
  console.log("\n10. Pipeline fail-closed on missing recipe contract");
  {
    const { generateMealImage, generateMealImageUnified, getCachedImage } = await import("../mealImageGenerator");
    const { db } = await import("../../db");
    const { mealImageCache } = await import("../../db/schema/mealImageCache");
    const { eq } = await import("drizzle-orm");

    const mealName = `Contractless Test Dish ${Date.now()}`;

    // Empty ingredients array (what /meal-images/generate receives by default)
    const r1 = await generateMealImage({ mealName, ingredients: [] });
    assert(r1.url.startsWith("/images/fallback/"), "empty ingredients → semantic fallback served");
    assert(r1.prompt.includes("no recipe contract"), "fallback reason names the missing contract");

    // Whitespace-only ingredients (batch mapping with missing ing.name)
    const r2 = await generateMealImage({ mealName, ingredients: ["", "   "] });
    assert(r2.url.startsWith("/images/fallback/"), "whitespace-only ingredients → semantic fallback served");

    // Nothing was cached — memory or DB
    assert(getCachedImage({ mealName, ingredients: [] }) === null, "no memCache entry written for contractless request");
    const [row] = await db.select().from(mealImageCache).where(eq(mealImageCache.cacheKey, r1.hash)).limit(1);
    assert(row === undefined, "no meal_image_cache row written for contractless request");

    // Unified entry point (mealFinalizer path) with object-shaped empty ingredients
    const u = await generateMealImageUnified(mealName, [{ notName: "x" } as any]);
    assert(u.startsWith("/images/fallback/"), "unified entry point without usable ingredients → semantic fallback");
  }

  console.log(`\n${"─".repeat(60)}\nPASSED: ${passed}  FAILED: ${failed}`);
  if (failed > 0) {
    failMessages.forEach(m => console.log(`  ❌ ${m}`));
    process.exit(1);
  }
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
