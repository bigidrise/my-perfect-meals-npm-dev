/**
 * Saved Grocery Compliance — unit tests
 *
 * Pure-function tests: no DB, no network.
 * Run: npx tsx server/services/__tests__/savedGroceryCompliance.test.ts
 *
 * Covers:
 *  1. computeProductKey — same product saved twice produces identical key (dedup guarantee)
 *  2. filterSavedGroceriesForCompliance — compliant item stays in compliant[]
 *  3. filterSavedGroceriesForCompliance — allergen in product name → excluded[], never reaches LLM
 *  4. filterSavedGroceriesForCompliance — allergen only in ingredients list → excluded[]
 *  5. filterSavedGroceriesForCompliance — GLP-1 active + fat > ceiling → excluded[]
 *  6. filterSavedGroceriesForCompliance — GLP-1 active + scanner payload {scoreCards,outcomeCards}
 *     → fat is NaN, must be fail-closed (excluded), not silently passed as compliant
 *  7. filterSavedGroceriesForCompliance — GLP-1 active + {} nutritionJson (missing fat field)
 *     → same fail-closed exclusion
 */

// computeProductKey is imported from the DB-free utility — no database connection opened.
import { computeProductKey } from "../../utils/productKey";
import {
  filterSavedGroceriesForCompliance,
  buildSavedGroceriesPromptBlock,
  type SavedGroceryItemSlim,
} from "../savedGroceryCompliance";
import type { UserProtocolEnvelope } from "../protocolEnvelope";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${title}`);
  console.log("─".repeat(60));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeEnvelope(
  overrides: Partial<Pick<UserProtocolEnvelope, "allergies" | "avoidances" | "diabeticGuidance" | "hasDiabetes">>,
): UserProtocolEnvelope {
  return {
    userId: "test-user",
    dietaryIdentity: [],
    allergies: overrides.allergies ?? [],
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances: overrides.avoidances ?? [],
    preferences: [],
    procedural: {} as any,
    cuisinePreference: null,
    cuisineIntensity: null,
    diabeticGuidance: overrides.diabeticGuidance ?? null,
    hasDiabetes: overrides.hasDiabetes ?? false,
    diabeticGlucoseState: null,
    conditionGuidanceBlocks: [],
    glp1DailyTolerance: null,
    thyroidSupport: false,
    thyroidMedication: null,
    thyroidType: null,
    hormoneOptimization: false,
    measurementSystem: "imperial",
    fitnessGoal: null,
    goalType: null,
    goalTarget: null,
    performanceOverlay: "standard",
    performanceControlMode: "self_guided",
    pregnancySupport: false,
    pregnancySupportContext: null,
    carbCycleContext: null,
    performanceNutrition: false,
    performanceContext: null,
    performanceLayer: null,
    dailyNutritionState: null,
    therapeuticSupport: false,
    therapeuticSupportContext: null,
    selectedMealBuilder: null,
    preferredLanguage: null,
    flavorPreference: null,
    heatPreference: null,
    palateSpiceTolerance: null,
    palateSeasoningIntensity: null,
    palateFlavorStyle: null,
    providerInterventions: [],
    interventionPatientSummary: [],
  } as UserProtocolEnvelope;
}

let _itemCounter = 0;
function makeItem(
  overrides: Partial<SavedGroceryItemSlim> & { productName: string },
): SavedGroceryItemSlim {
  const id = overrides.id ?? `item-${++_itemCounter}`;
  return {
    id,
    productName: overrides.productName,
    brand: overrides.brand ?? null,
    category: overrides.category ?? "Pantry",
    productKey:
      overrides.productKey ??
      `name::::${overrides.productName.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    nutritionJson: overrides.nutritionJson !== undefined ? overrides.nutritionJson : null,
    ingredients: overrides.ingredients !== undefined ? overrides.ingredients : null,
    savedAt: overrides.savedAt ?? new Date("2026-08-13T10:00:00Z"),
  };
}

const GLP1_TARGETS = {
  maximumToleratedFatGrams: 12,
  resolvedMealCalories: 400,
};

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Deduplication — same product saved twice → same productKey
// ─────────────────────────────────────────────────────────────────────────────
section("1 — computeProductKey deduplication guarantee");
{
  // Barcode path: two scans of the same UPC always collide
  const key1 = computeProductKey("0123456789012", "Acme Foods", "Almond Butter");
  const key2 = computeProductKey("0123456789012", "Acme Foods", "Almond Butter");
  assert(key1 === key2, "barcode path: same UPC → identical productKey");
  assert(key1.startsWith("upc::"), "barcode path: key prefixed with 'upc::'");

  // Name path: same brand + name → same key regardless of case/spacing
  const keyA = computeProductKey(null, "Bob's Red Mill", "Whole Wheat Flour");
  const keyB = computeProductKey(undefined, "bob's red mill", "whole wheat flour");
  assert(keyA === keyB, `name path: identical productKey regardless of case (${keyA})`);
  assert(keyA.startsWith("name::"), "name path: key prefixed with 'name::'");

  // Barcode wins over name — different names on same UPC still collide
  const keyC = computeProductKey("9999999999", "Brand A", "Product v1");
  const keyD = computeProductKey("9999999999", "Brand B", "Product v2");
  assert(keyC === keyD, "barcode always wins: same UPC, different names → same key");

  // Different products produce different keys (no false collisions)
  const keyE = computeProductKey(null, "Acme", "Peanut Butter");
  const keyF = computeProductKey(null, "Acme", "Almond Butter");
  assert(keyE !== keyF, "different products produce different productKeys");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Compliant item → stays in compliant[]
// ─────────────────────────────────────────────────────────────────────────────
section("2 — Compliant saved product returned in compliant[]");
{
  const envelope = makeEnvelope({});
  const item = makeItem({
    productName: "Organic Rolled Oats",
    brand: "Bob's Red Mill",
    nutritionJson: { calories: 150, protein: 5, carbs: 27, fat: 3 },
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance([item], envelope);

  assert(compliant.length === 1, "compliant array contains the item");
  assert(excluded.length === 0, "excluded array is empty");
  assert(compliant[0].productName === "Organic Rolled Oats", "correct item in compliant[]");

  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(block.includes("Organic Rolled Oats"), "compliant item appears in the LLM prompt block");
  assert(block.includes("SAVED GROCERY PREFERENCES"), "prompt block has the header");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Allergen in product name → excluded[], never reaches LLM prompt
// ─────────────────────────────────────────────────────────────────────────────
section("3 — Allergen in product name → excluded[], not in LLM prompt");
{
  // "peanut" is a substring of "Peanut Butter Spread" — the filter uses .includes()
  const envelope = makeEnvelope({ allergies: ["peanut"] });
  const allergenicItem = makeItem({
    productName: "Peanut Butter Spread",
    brand: "Jif",
    nutritionJson: { calories: 190, protein: 7, carbs: 7, fat: 16 },
  });
  const safeItem = makeItem({
    productName: "Sunflower Seed Butter",
    brand: "SunButter",
    nutritionJson: { calories: 200, protein: 7, carbs: 8, fat: 16 },
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [allergenicItem, safeItem],
    envelope,
  );

  assert(excluded.length === 1, "one item in excluded[]");
  assert(excluded[0].productName === "Peanut Butter Spread", "peanut product is excluded");
  assert(
    excluded[0].exclusionReason.toLowerCase().includes("peanut"),
    `exclusionReason mentions allergen: "${excluded[0].exclusionReason}"`,
  );
  assert(compliant.length === 1, "safe item stays in compliant[]");
  assert(compliant[0].productName === "Sunflower Seed Butter", "correct safe item");

  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("Peanut Butter Spread"), "allergenic product NOT in LLM prompt");
  assert(block.includes("Sunflower Seed Butter"), "safe product in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Allergen only in ingredients list → excluded[]
// ─────────────────────────────────────────────────────────────────────────────
section("4 — Allergen in ingredients list (not product name/brand) → excluded[]");
{
  // Product name "Trail Mix Bites" is neutral — allergen only visible in ingredients
  const envelope = makeEnvelope({ allergies: ["peanut"] });
  const sneakyItem = makeItem({
    productName: "Trail Mix Bites",
    brand: "Nature Valley",
    nutritionJson: { calories: 140, protein: 4, carbs: 18, fat: 6 },
    ingredients: ["oats", "honey", "peanut butter", "dark chocolate chips"],
  });
  const safeItem = makeItem({
    productName: "Granola Bar",
    brand: "KIND",
    nutritionJson: { calories: 200, protein: 5, carbs: 24, fat: 9 },
    ingredients: ["oats", "almonds", "honey", "dark chocolate"],
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [sneakyItem, safeItem],
    envelope,
  );

  assert(excluded.length === 1, "ingredient-allergen item is in excluded[]");
  assert(excluded[0].productName === "Trail Mix Bites", "correct item excluded via ingredients");
  assert(
    excluded[0].exclusionReason.toLowerCase().includes("peanut"),
    `exclusionReason mentions allergen: "${excluded[0].exclusionReason}"`,
  );
  assert(compliant.length === 1, "peanut-free item stays in compliant[]");
  assert(compliant[0].productName === "Granola Bar", "safe item correct");

  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("Trail Mix Bites"), "ingredient-allergen product NOT in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: GLP-1 active + fat > ceiling → excluded[]
// ─────────────────────────────────────────────────────────────────────────────
section("5 — GLP-1 fat ceiling exceeded → excluded[]");
{
  const envelope = makeEnvelope({});

  const highFatItem = makeItem({
    productName: "Whole Milk Greek Yogurt",
    brand: "Chobani",
    nutritionJson: { calories: 220, protein: 17, carbs: 8, fat: 18 }, // 18 > 12
  });
  const lowFatItem = makeItem({
    productName: "Non-Fat Greek Yogurt",
    brand: "Chobani",
    nutritionJson: { calories: 120, protein: 17, carbs: 7, fat: 0 }, // 0 ≤ 12
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [highFatItem, lowFatItem],
    envelope,
    { glp1Targets: GLP1_TARGETS },
  );

  assert(excluded.length === 1, "one item excluded (high-fat)");
  assert(excluded[0].productName === "Whole Milk Greek Yogurt", "high-fat item excluded");
  assert(
    excluded[0].exclusionReason.includes("18g") && excluded[0].exclusionReason.includes("12g"),
    `exclusionReason has actual fat and ceiling: "${excluded[0].exclusionReason}"`,
  );
  assert(compliant.length === 1, "low-fat item in compliant[]");
  assert(compliant[0].productName === "Non-Fat Greek Yogurt", "correct compliant item");

  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("Whole Milk Greek Yogurt"), "high-fat product NOT in LLM prompt");
  assert(block.includes("Non-Fat Greek Yogurt"), "low-fat product in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: GLP-1 active + scanner payload {scoreCards, outcomeCards} → fail-closed
//
// The scanner saves nutritionJson as { scoreCards, outcomeCards }, not flat macros.
// nutritionJson.fat is therefore undefined → Number(undefined) = NaN.
// NaN fails Number.isFinite(), so the filter must EXCLUDE (fail closed), not pass.
// ─────────────────────────────────────────────────────────────────────────────
section("6 — GLP-1 active + scanner payload {scoreCards,outcomeCards} → fail-closed exclusion");
{
  const envelope = makeEnvelope({});

  // Exactly the shape IngredientIntelligenceSheet.tsx persists
  const scannerItem = makeItem({
    productName: "Organic Protein Chips",
    brand: "PopCorners",
    nutritionJson: {
      scoreCards: { protein: { score: 80, label: "Good" }, fat: { score: 60, label: "Moderate" } },
      outcomeCards: [{ title: "High Protein", body: "Good source of protein." }],
    } as any,
  });
  const flatMacroItem = makeItem({
    productName: "Rice Cakes",
    brand: "Quaker",
    nutritionJson: { calories: 35, protein: 1, carbs: 7, fat: 0 },
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [scannerItem, flatMacroItem],
    envelope,
    { glp1Targets: GLP1_TARGETS },
  );

  // Scanner item must be excluded — its fat value is NaN, which is non-finite
  assert(excluded.length === 1, "scanner-payload item is excluded (fail-closed on NaN fat)");
  assert(excluded[0].productName === "Organic Protein Chips", "scanner item in excluded[]");
  assert(
    excluded[0].exclusionReason.toLowerCase().includes("nutrition data unavailable"),
    `exclusionReason explains why: "${excluded[0].exclusionReason}"`,
  );

  // Flat-macro item with fat=0 still reaches compliant
  assert(compliant.length === 1, "flat-macro item stays in compliant[]");
  assert(compliant[0].productName === "Rice Cakes", "correct compliant item");

  // Critical: scanner item must never appear in the LLM prompt as "vetted"
  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("Organic Protein Chips"), "scanner item NOT in LLM prompt");
  assert(block.includes("Rice Cakes"), "flat-macro item in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: GLP-1 active + empty nutritionJson {} (missing fat field) → fail-closed
// ─────────────────────────────────────────────────────────────────────────────
section("7 — GLP-1 active + {} nutritionJson (fat field absent) → fail-closed exclusion");
{
  const envelope = makeEnvelope({});

  const missingFatItem = makeItem({
    productName: "Mystery Granola",
    brand: "Generic",
    nutritionJson: {}, // fat is absent → Number(undefined) = NaN
  });
  const presentFatItem = makeItem({
    productName: "Low-Fat Granola",
    brand: "Kind",
    nutritionJson: { calories: 140, protein: 4, carbs: 22, fat: 3 },
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [missingFatItem, presentFatItem],
    envelope,
    { glp1Targets: GLP1_TARGETS },
  );

  assert(excluded.length === 1, "item with missing fat field is excluded (fail-closed)");
  assert(excluded[0].productName === "Mystery Granola", "correct item excluded");
  assert(
    excluded[0].exclusionReason.toLowerCase().includes("nutrition data unavailable"),
    `exclusionReason explains why: "${excluded[0].exclusionReason}"`,
  );
  assert(compliant.length === 1, "item with valid fat field stays in compliant[]");
  assert(compliant[0].productName === "Low-Fat Granola", "correct compliant item");

  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("Mystery Granola"), "item with missing fat NOT in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: Diabetic carb ceiling
// ─────────────────────────────────────────────────────────────────────────────
section("8 — Diabetic carb ceiling");
{
  // hasDiabetes is the canonical flag; diabeticGuidance may be null (no glucose reading)
  const envelope = makeEnvelope({ hasDiabetes: true });
  const CARB_CEILING = 45;

  // 8a: High-carb item → excluded
  const highCarbItem = makeItem({
    productName: "White Rice Snack Pack",
    brand: "Uncle Ben's",
    nutritionJson: { calories: 300, protein: 6, carbs: 62, fat: 2 }, // 62 > 45
  });
  // 8b: Compliant low-carb item → stays in compliant[]
  const lowCarbItem = makeItem({
    productName: "Cauliflower Rice",
    brand: "Green Giant",
    nutritionJson: { calories: 60, protein: 2, carbs: 12, fat: 0 }, // 12 ≤ 45
  });
  // 8c: Scanner-shape payload → carbs is NaN → fail-closed
  const scannerItem = makeItem({
    productName: "Cracker Mix",
    brand: "Ritz",
    nutritionJson: {
      scoreCards: { carbs: { score: 40, label: "High" } },
      outcomeCards: [],
    } as any,
  });

  const { compliant, excluded } = filterSavedGroceriesForCompliance(
    [highCarbItem, lowCarbItem, scannerItem],
    envelope,
    { isDiabetic: true, diabeticCarbCeiling: CARB_CEILING },
  );

  // High-carb item must be excluded
  const excNames = excluded.map((e) => e.productName);
  assert(excNames.includes("White Rice Snack Pack"), "high-carb item excluded");
  const highCarbExcl = excluded.find((e) => e.productName === "White Rice Snack Pack")!;
  assert(
    highCarbExcl.exclusionReason.includes("62g") && highCarbExcl.exclusionReason.includes("45g"),
    `exclusionReason has actual carbs and ceiling: "${highCarbExcl.exclusionReason}"`,
  );

  // Scanner item must be fail-closed (carbs is NaN)
  assert(excNames.includes("Cracker Mix"), "scanner-payload item excluded (fail-closed on NaN carbs)");
  const scannerExcl = excluded.find((e) => e.productName === "Cracker Mix")!;
  assert(
    scannerExcl.exclusionReason.toLowerCase().includes("nutrition data unavailable"),
    `scanner exclusionReason explains why: "${scannerExcl.exclusionReason}"`,
  );

  // Low-carb item stays compliant
  assert(compliant.length === 1, "one item in compliant[] (low-carb)");
  assert(compliant[0].productName === "Cauliflower Rice", "low-carb item correct");

  // Neither excluded item reaches the LLM prompt
  const block = buildSavedGroceriesPromptBlock(compliant);
  assert(!block.includes("White Rice Snack Pack"), "high-carb item NOT in LLM prompt");
  assert(!block.includes("Cracker Mix"), "scanner item NOT in LLM prompt");
  assert(block.includes("Cauliflower Rice"), "low-carb item in LLM prompt");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failMessages.length > 0) {
  console.log("\nFailures:");
  failMessages.forEach((m) => console.log(m));
  process.exit(1);
} else {
  console.log("✅ All tests passed");
  process.exit(0);
}
