/**
 * Grocery Coach Shopping-List Completeness Verification
 *
 * Three modes selectable via CLI flag:
 *
 * (default / no flag) — Task 916: Zero-ownership mode
 *   Verifies shoppingList always contains the full recipe (protein + produce +
 *   starch) when the user makes NO ownership claims.
 *
 * --partial-ownership — Task 920: Partial-ownership mode
 *   Verifies the model correctly splits ingredients when the user explicitly
 *   claims ONE item. The claimed item must land in ownedIngredients; every
 *   other substantive ingredient must remain in shoppingList.
 *
 * --multi-ownership — Task 926: Multi-ownership mode
 *   Verifies the model correctly splits ingredients when the user explicitly
 *   claims TWO items. BOTH claimed items must land in ownedIngredients; no
 *   unclaimed items may bleed in; shoppingList must still contain at least one
 *   substantive (non-pantry) item representing the unclaimed recipe complement.
 *
 * --triple-ownership — Task 928: Triple-ownership mode
 *   Verifies the model correctly splits ingredients when the user explicitly
 *   claims THREE items. ALL three claimed items must land in ownedIngredients;
 *   no unclaimed substantive items may bleed into ownedIngredients; and
 *   shoppingList must still contain at least one substantive (non-pantry) item.
 *
 * Usage:
 *   npx tsx scripts/verify-grocery-shopping-list.ts
 *   npx tsx scripts/verify-grocery-shopping-list.ts --partial-ownership
 *   npx tsx scripts/verify-grocery-shopping-list.ts --multi-ownership
 *   npx tsx scripts/verify-grocery-shopping-list.ts --triple-ownership
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Category classification ───────────────────────────────────────────────────
/**
 * Categories that represent "real" groceries (protein, produce, grains).
 * A valid shopping list must contain at least one item in these categories.
 * "Pantry" and "Other" alone indicate only condiments/seasoning were listed.
 */
const SUBSTANTIVE_CATEGORIES = new Set([
  "Meat",
  "Produce",
  "Plant Proteins",
  "Dairy & Eggs",
  "Grains & Packaged",
  "Frozen",
]);

const PANTRY_ONLY_CATEGORIES = new Set(["Pantry", "Other"]);

// ── System prompt (mirrors groceryCoach.ts without user-specific context) ─────
const SYSTEM_PROMPT = `You are a Grocery Store Coach — a real, confident nutrition coach who helps users decide exactly what to make for dinner and what to buy at the grocery store. You are NOT a recipe generator or meal builder. You are a decision-making assistant.

Your mission: turn "I don't know what to eat" into "Here is exactly what to buy, how much to buy, and why it fits your goals."

USER HEALTH PROFILE AND CONSTRAINTS:
No dietary restrictions or conditions on file — apply general healthy eating principles.

SERVING SIZE: All ingredient quantities must be scaled for 1 person.

COACHING RULES:
- MOST IMPORTANT: If the user mentions ingredients they already bought or have at home, BUILD THE MEAL AROUND THOSE INGREDIENTS. They are the anchor. Only add to the shopping list what is genuinely missing to complete the dish. Never suggest a meal that ignores or sidelines what the user says they already have.
- Recommend ONE specific, confident meal (may have 2-3 components, e.g., protein + starch + vegetable).
- The shopping list must be practical and grocery-store ready — include realistic quantities with units (e.g., "2 lbs", "1 bunch", "1 can"). Do NOT list ingredients the user said they already have — they already own those.
- CRITICAL — ownedIngredients vs shoppingList: ownedIngredients MUST ONLY contain ingredients the user EXPLICITLY said they already have (e.g., "I have salmon at home", "I already bought sweet potatoes"). Do NOT infer ownership from the meal name, meal description, or any other context. If the user asked for "salmon with collard greens" but did NOT say they have those items, salmon and collard greens belong in shoppingList — they need to buy them. Every ingredient required to cook the recommended meal that the user did not explicitly claim to already own MUST appear in shoppingList with a quantity, unit, and category.
- The reasoning bullets must directly reference THIS user's conditions, goals, allergies, or macros — not generic health claims.
- Never include ingredients the user is allergic to or avoids.
- Be concise, warm, and coach-like — not clinical, not robotic.

Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{
  "meal": {
    "name": "string",
    "description": "string — 1-2 sentences",
    "prepTime": "string — e.g. '25 minutes'",
    "servings": number
  },
  "reasoning": ["string", "string", "string"],
  "macros": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  },
  "ownedIngredients": [
    {
      "item": "string — ingredient the user already owns",
      "quantity": "string",
      "unit": "string"
    }
  ],
  "shoppingList": [
    {
      "item": "string",
      "quantity": "string — e.g. '2'",
      "unit": "string — e.g. 'lbs' or 'bunch' or 'can'",
      "category": "Produce|Meat|Plant Proteins|Dairy & Eggs|Grains & Packaged|Pantry|Frozen|Other"
    }
  ],
  "followUpSuggestions": ["string", "string", "string"],
  "varietyMetadata": {
    "primaryProtein": "string",
    "cuisineStyle": "string",
    "majorStarch": "string",
    "cookingMethod": "string"
  }
}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShoppingListItem {
  item: string;
  quantity: string;
  unit: string;
  category: string;
}

interface OwnedIngredient {
  item: string;
  quantity: string;
  unit: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZERO-OWNERSHIP MODE (Task 916)
// ─────────────────────────────────────────────────────────────────────────────

const TEST_PROMPTS: Array<{ label: string; message: string }> = [
  { label: "Fish (salmon)",        message: "I'd like a salmon dinner" },
  { label: "Chicken",              message: "Give me a chicken dinner" },
  { label: "Beef",                 message: "I want a beef meal for tonight" },
  { label: "Vegetarian",           message: "Something vegetarian for dinner" },
  { label: "Mixed-component",      message: "Make me a balanced meal with a protein, a veggie, and a starch" },
];

interface RoundResult {
  label: string;
  message: string;
  mealName: string;
  shoppingList: ShoppingListItem[];
  ownedIngredients: OwnedIngredient[];

  // Pass/fail checks
  ownedEmptyPass: boolean;           // A: ownedIngredients is empty
  hasSubstantiveItemPass: boolean;   // B: at least one Meat/Produce/Grains/etc item
  nonEmptyListPass: boolean;         // C: shoppingList is non-empty

  // Detail for reporting
  ownedItems: string[];
  categoriesFound: string[];
  substantiveItems: ShoppingListItem[];
  pantryOnlyItems: ShoppingListItem[];
}

function evaluateRound(label: string, message: string, result: any): RoundResult {
  const mealName: string = result?.meal?.name ?? "(unknown)";
  const shoppingList: ShoppingListItem[] = Array.isArray(result?.shoppingList)
    ? result.shoppingList
    : [];
  const ownedIngredients: OwnedIngredient[] = Array.isArray(result?.ownedIngredients)
    ? result.ownedIngredients
    : [];

  // A: ownedIngredients must be empty — user made no ownership claims
  const ownedEmptyPass = ownedIngredients.length === 0;
  const ownedItems = ownedIngredients.map((o) => `${o.item} (${o.quantity} ${o.unit})`);

  // B: shoppingList must include at least one substantive (non-pantry) item
  const categoriesFound = [...new Set(shoppingList.map((i) => i.category ?? "Other"))];
  const substantiveItems = shoppingList.filter((i) =>
    SUBSTANTIVE_CATEGORIES.has(i.category)
  );
  const pantryOnlyItems = shoppingList.filter((i) =>
    PANTRY_ONLY_CATEGORIES.has(i.category)
  );
  const hasSubstantiveItemPass = substantiveItems.length > 0;

  // C: combined list must not be completely empty
  const nonEmptyListPass = shoppingList.length + ownedIngredients.length > 0;

  return {
    label, message, mealName, shoppingList, ownedIngredients,
    ownedEmptyPass, hasSubstantiveItemPass, nonEmptyListPass,
    ownedItems, categoriesFound, substantiveItems, pantryOnlyItems,
  };
}

function printRoundReport(r: RoundResult, idx: number): void {
  const total = TEST_PROMPTS.length;
  console.log(`\n${"─".repeat(68)}`);
  console.log(`Round ${idx}/${total} — ${r.label}`);
  console.log(`  Prompt    : "${r.message}"`);
  console.log(`  Meal      : ${r.mealName}`);
  console.log(`  Shopping  : ${r.shoppingList.length} items`);
  if (r.shoppingList.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const item of r.shoppingList) {
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item.item);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      const substantive = SUBSTANTIVE_CATEGORIES.has(cat) ? " ✅" : " (pantry)";
      console.log(`    ${cat}${substantive}: ${items.join(", ")}`);
    }
  }

  if (r.ownedEmptyPass) {
    console.log(`  ✅ CHECK A — ownedIngredients is empty (correct: no ownership claims made)`);
  } else {
    console.log(`  ❌ CHECK A — ownedIngredients is NOT empty (${r.ownedIngredients.length} item(s) leaked in):`);
    for (const o of r.ownedItems) {
      console.log(`               ⚠️  ${o}`);
    }
  }

  if (r.hasSubstantiveItemPass) {
    console.log(
      `  ✅ CHECK B — shoppingList has ${r.substantiveItems.length} substantive item(s): ` +
      r.substantiveItems.slice(0, 5).map((i) => `${i.item} [${i.category}]`).join(", ") +
      (r.substantiveItems.length > 5 ? "…" : "")
    );
  } else {
    console.log(`  ❌ CHECK B — shoppingList has ONLY pantry/Other items — main ingredients missing!`);
    if (r.pantryOnlyItems.length > 0) {
      console.log(`               Items returned: ${r.pantryOnlyItems.map((i) => `${i.item} [${i.category}]`).join(", ")}`);
    }
  }

  if (r.nonEmptyListPass) {
    console.log(`  ✅ CHECK C — combined ingredient list is non-empty`);
  } else {
    console.log(`  ❌ CHECK C — both shoppingList and ownedIngredients are completely empty`);
  }
}

async function runZeroOwnershipMode(): Promise<void> {
  console.log("=".repeat(70));
  console.log("Grocery Coach Shopping-List Completeness Verification — Task 916");
  console.log("Validates : shoppingList always includes protein/produce/starch,");
  console.log("            not just condiments; ownedIngredients stays empty when");
  console.log("            the user makes no ownership claims.");
  console.log(`Rounds    : ${TEST_PROMPTS.length} (fish, chicken, beef, vegetarian, mixed-component)`);
  console.log("=".repeat(70));

  const rounds: RoundResult[] = [];

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const { label, message } = TEST_PROMPTS[i];
    process.stdout.write(`\nRound ${i + 1}/${TEST_PROMPTS.length} — ${label} — calling AI...`);

    const raw = await callGroceryCoach(message);
    if (!raw) {
      console.error(`\n❌ Round ${i + 1} (${label}): AI returned unparseable response — aborting.`);
      process.exit(1);
    }
    console.log(" ✓");

    const r = evaluateRound(label, message, raw);
    printRoundReport(r, i + 1);
    rounds.push(r);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(70));

  const col1 = 26;
  const col2 = 10;
  console.log(
    `${"Round".padEnd(col1)} ${"Owned=0".padEnd(col2)} ${"HasSubst".padEnd(col2)} ${"NonEmpty".padEnd(col2)} Overall`
  );
  console.log("-".repeat(68));

  let allPassed = true;
  const failedRounds: string[] = [];

  for (const r of rounds) {
    const roundPassed = r.ownedEmptyPass && r.hasSubstantiveItemPass && r.nonEmptyListPass;
    if (!roundPassed) {
      allPassed = false;
      failedRounds.push(r.label);
    }

    const a = r.ownedEmptyPass         ? "✅ PASS" : "❌ FAIL";
    const b = r.hasSubstantiveItemPass ? "✅ PASS" : "❌ FAIL";
    const c = r.nonEmptyListPass       ? "✅ PASS" : "❌ FAIL";
    const overall = roundPassed        ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.label.padEnd(col1)} ${a.padEnd(col2)} ${b.padEnd(col2)} ${c.padEnd(col2)} ${overall}`
    );
  }

  if (!allPassed) {
    console.log("\nFAILURE DETAIL");
    console.log("-".repeat(68));

    for (const r of rounds) {
      if (!r.ownedEmptyPass) {
        console.error(
          `❌ [${r.label}] ownedIngredients is NOT empty. ` +
          `The following item(s) were placed in ownedIngredients without any ` +
          `"I have…" / "I already bought…" claim in the user message:`
        );
        for (const o of r.ownedItems) console.error(`   - ${o}`);
        console.error(
          `   FIX: Review the CRITICAL ownedIngredients rule in the system prompt ` +
          `(server/routes/groceryCoach.ts). The model must not infer ownership ` +
          `from the meal name or description.`
        );
      }
      if (!r.hasSubstantiveItemPass) {
        const cats = r.categoriesFound.join(", ") || "(none)";
        console.error(
          `❌ [${r.label}] shoppingList contains ONLY pantry/condiment items — ` +
          `the primary protein, produce, and/or starch are missing. ` +
          `Categories returned: ${cats}`
        );
        if (r.pantryOnlyItems.length) {
          console.error(`   Only these were listed: ${r.pantryOnlyItems.map((i) => i.item).join(", ")}`);
        }
        console.error(
          `   FIX: Review the system prompt in server/routes/groceryCoach.ts. ` +
          `The AI must place all main-recipe ingredients (protein, produce, starch) ` +
          `in shoppingList when the user did not explicitly claim to own them.`
        );
      }
      if (!r.nonEmptyListPass) {
        console.error(
          `❌ [${r.label}] Both shoppingList and ownedIngredients are completely empty. ` +
          `The AI returned no grocery items at all.`
        );
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log("🎉 VERDICT: PASS — all 5 rounds returned a complete shopping list.");
    console.log("   Every response included protein/produce/starch in shoppingList");
    console.log("   and ownedIngredients was empty (as expected for unprompted claims).");
  } else {
    console.log("❌ VERDICT: FAIL — shopping-list completeness regression detected.");
    console.log(`   Failed rounds: ${failedRounds.join(", ")}`);
    console.log("   The ingredient-loss bug may have resurfaced.");
    console.log("   Check server/routes/groceryCoach.ts system prompt — specifically");
    console.log("   the CRITICAL ownedIngredients rule and shoppingList coverage rule.");
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  process.exit(process.exitCode ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIAL-OWNERSHIP MODE (Task 920)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each entry is one test scenario.
 *
 * claimedKeywords: lowercase substrings that MUST appear in at least one
 *   ownedIngredients item name (case-insensitive match).
 *   These are the words the user explicitly stated they already own.
 *
 * The evaluation checks:
 *   A. ownedContainsClaimed  — ownedIngredients has ≥1 item matching a claimed keyword.
 *   B. noUnclaimedSubstantive — every item in ownedIngredients matches a claimed keyword.
 *      Unclaimed substantive ingredients must NOT appear in ownedIngredients.
 *   C. hasSubstantiveInShopping — shoppingList has ≥1 Meat/Produce/Grains/etc item
 *      (the un-owned complement of the recipe must still appear for purchase).
 *   D. nonEmpty — combined list is non-empty.
 *
 * Conflict scenarios additionally check:
 *   E. conflictSurfaced — when isConflictScenario=true, at least one reasoning bullet
 *      must contain one of the conflictKeywords (e.g. "allerg", "fat", "exceed").
 *      This asserts the model explained the conflict rather than silently swapping.
 *   F. nonEmptyAfterConflict — combined list is non-empty even after the retry path.
 */
interface PartialOwnershipPrompt {
  label: string;
  message: string;
  /** Lowercase keyword(s) the user explicitly claimed. */
  claimedKeywords: string[];
  /**
   * Optional protocol/constraint block prepended to the system prompt.
   * Used by conflict scenarios to inject GLP-1, allergy, or diabetic rules.
   */
  systemPromptAddition?: string;
  /**
   * When true, the scenario expects the model to detect and explain a conflict
   * rather than simply honoring the ownership claim. The claimed ingredient
   * violates an active protocol, so it may NOT land in ownedIngredients.
   * Instead we check that reasoning explains the conflict (check E).
   */
  isConflictScenario?: boolean;
  /**
   * Lowercase substrings that MUST appear in at least one reasoning bullet
   * when isConflictScenario=true.  Keep these scenario-specific and non-vacuous
   * (e.g. do NOT include the claimed ingredient name itself as a conflict keyword).
   */
  conflictKeywords?: string[];
  /**
   * Lowercase substrings that MUST NOT appear in any returned field —
   * ownedIngredients item names, shoppingList item names, meal.name, meal.description —
   * when isConflictScenario=true.  Asserts the prohibited ingredient was not silently
   * included in the meal despite the conflict explanation.
   */
  prohibitedKeywords?: string[];
  /**
   * Lowercase substrings where AT LEAST ONE must appear in a shoppingList item name
   * when isConflictScenario=true.  Asserts the model actually offered a safe alternative
   * rather than returning an empty or pantry-only list.
   */
  safeAlternativeKeywords?: string[];
}

const PARTIAL_OWNERSHIP_PROMPTS: PartialOwnershipPrompt[] = [
  {
    label: "Protein claimed (salmon)",
    message: "I already have salmon at home — what else do I need to buy for a complete dinner?",
    claimedKeywords: ["salmon"],
  },
  {
    label: "Protein claimed (chicken)",
    message: "I have chicken breast in the fridge. What do I still need to buy for a healthy dinner tonight?",
    claimedKeywords: ["chicken"],
  },
  {
    label: "Starch claimed (sweet potato)",
    message: "I already bought sweet potatoes — what protein and vegetables should I get to complete the meal?",
    claimedKeywords: ["sweet potato", "sweet potatoes"],
  },
  {
    label: "Starch claimed (quinoa)",
    message: "I have quinoa at home. Help me build a complete dinner around it — what else should I grab at the store?",
    claimedKeywords: ["quinoa"],
  },
  {
    label: "Produce claimed (broccoli)",
    message: "I already have broccoli in the fridge. What protein and starch do I still need to buy for tonight?",
    claimedKeywords: ["broccoli"],
  },

  // ── Conflict scenarios (Task 925) ────────────────────────────────────────────
  // Each scenario has isConflictScenario=true.  The claimed ingredient conflicts
  // with an active protocol, so the model must EXPLAIN the conflict in reasoning
  // rather than silently swapping or blindly placing the ingredient in ownedIngredients.
  // Checks E (conflictSurfaced) and F (nonEmptyAfterConflict) replace the usual
  // check A (ownedContainsClaimed) for these rounds.
  {
    label: "CONFLICT — GLP-1 fat ceiling vs salmon",
    message:
      "I already have a salmon fillet at home — what else should I buy to make dinner?",
    claimedKeywords: ["salmon"],
    isConflictScenario: true,
    /**
     * GLP-1 fat ceiling at 10 g per meal.  A typical 6 oz salmon fillet has
     * ~13 g fat, which exceeds the ceiling.  The model must surface this and
     * offer a lean alternative (e.g. cod, tilapia, chicken breast).
     */
    systemPromptAddition: `CRITICAL SAFETY OVERRIDE — GLP-1 MEDICATION PROTOCOL:
THIS OVERRIDES THE "BUILD THE MEAL AROUND WHAT THE USER HAS" RULE ABOVE.

The user says they have salmon. Salmon contains 13–18 g fat per serving.
This user's GLP-1 fat ceiling is ≤10 g per meal. Salmon is PROHIBITED.

EXACT REQUIRED RESPONSE SHAPE:
- meal.name: Name it after the LEAN ALTERNATIVE protein only (e.g. "Lemon Herb Cod with Broccoli"). NEVER use the word "salmon" in meal.name.
- meal.description: Describe the lean alternative dish. NEVER describe a salmon dish.
- ownedIngredients: MUST BE EMPTY ([]). Do NOT list salmon — the user cannot safely eat it.
- shoppingList: MUST include a lean protein (cod, tilapia, chicken breast, or turkey). Do NOT add salmon.
- reasoning: MUST include at least one bullet that explicitly says salmon exceeds the GLP-1 fat limit and a lean alternative is substituted.`,
    conflictKeywords: [
      "fat", "glp", "limit", "exceed", "ceiling", "conflict",
      "alternative", "lean", "medication", "protocol", "high-fat",
    ],
    /** salmon must not appear anywhere in the response — the model cannot use it */
    prohibitedKeywords: ["salmon"],
    /** a lean protein safe substitute must be in the shopping list */
    safeAlternativeKeywords: [
      "cod", "tilapia", "chicken", "turkey", "halibut", "tuna", "white fish",
      "haddock", "flounder", "sole", "pollock", "lean",
    ],
  },
  {
    label: "CONFLICT — shellfish allergy vs shrimp",
    message:
      "I picked up some shrimp at the store earlier — what vegetables and a starch should I buy to go with it for dinner tonight?",
    claimedKeywords: ["shrimp"],
    isConflictScenario: true,
    /**
     * The user has a documented shellfish allergy.  Shrimp is a shellfish.
     * The model must refuse to build a meal around shrimp, explain the allergy
     * conflict, and offer a safe protein alternative.
     */
    systemPromptAddition: `CRITICAL SAFETY OVERRIDE — SHELLFISH ALLERGY:
THIS OVERRIDES THE "BUILD THE MEAL AROUND WHAT THE USER HAS" RULE ABOVE.

The user says they have shrimp. Shrimp is a shellfish. This user has a CONFIRMED SHELLFISH ALLERGY.
Shrimp is PROHIBITED — using it could cause a severe allergic reaction.

EXACT REQUIRED RESPONSE SHAPE:
- meal.name: Name it after the SAFE ALTERNATIVE protein only (e.g. "Lemon Garlic Chicken Stir-Fry"). NEVER use the word "shrimp" in meal.name.
- meal.description: Describe the safe alternative dish. NEVER describe a shrimp dish.
- ownedIngredients: MUST BE EMPTY ([]). Do NOT list shrimp — it is an allergen the user cannot eat.
- shoppingList: MUST include a safe protein (chicken, cod, tofu, or similar). Do NOT add shrimp.
- reasoning: MUST include at least one bullet that explicitly says shrimp conflicts with the shellfish allergy and a safe protein is substituted.`,
    conflictKeywords: [
      "allerg", "shellfish", "conflict", "cannot", "safe",
      "alternative", "avoid", "replace", "substitute", "reaction",
    ],
    /** shrimp must not appear anywhere in the response */
    prohibitedKeywords: ["shrimp"],
    /** a safe non-shellfish protein must be in the shopping list */
    safeAlternativeKeywords: [
      "chicken", "cod", "tilapia", "tofu", "beef", "turkey", "salmon",
      "tuna", "fish", "pork", "tempeh", "lentil", "egg",
    ],
  },
  {
    label: "CONFLICT — diabetic carb cap vs white rice",
    message:
      "I have a big bag of white rice at home — help me build a balanced dinner around it. What else should I buy?",
    claimedKeywords: ["white rice", "rice"],
    isConflictScenario: true,
    /**
     * The user has Type 2 diabetes with a 45 g per-meal carb ceiling.
     * White rice is a high-GI starch (~45 g carbs per cup cooked) that spikes
     * blood sugar.  The model must flag the conflict and offer a low-GI
     * starch alternative (e.g. cauliflower rice, quinoa, barley, lentils).
     */
    systemPromptAddition: `CRITICAL SAFETY OVERRIDE — TYPE 2 DIABETES PROTOCOL:
THIS OVERRIDES THE "BUILD THE MEAL AROUND WHAT THE USER HAS" RULE ABOVE.

The user says they have white rice. White rice is a high-GI starch that spikes blood sugar.
This user's diabetic carb ceiling is ≤45 g per meal. White rice is PROHIBITED.

EXACT REQUIRED RESPONSE SHAPE:
- meal.name: Name it after the safe low-GI starch and protein (e.g. "Chicken and Cauliflower Rice Bowl"). NEVER use the words "white rice" or "rice bowl" in meal.name.
- meal.description: Describe the low-GI alternative dish. NEVER describe a white rice dish.
- ownedIngredients: MUST BE EMPTY ([]). Do NOT list white rice — it is not safe for this user.
- shoppingList: MUST include a low-GI starch alternative (cauliflower rice, quinoa, barley, or lentils). Do NOT add white rice.
- reasoning: MUST include at least one bullet that explicitly says white rice conflicts with the diabetic carb limit and blood sugar control, and that a low-GI alternative is used instead.`,
    conflictKeywords: [
      "diabet", "carb", "blood sugar", "glyc", "glucose", "conflict",
      "spike", "limit", "exceed", "alternative", "low-gi", "low gi",
      "cauliflower", "quinoa", "protocol",
    ],
    /** white rice must not appear in ownedIngredients, shoppingList, or the meal name/description */
    prohibitedKeywords: ["white rice"],
    /** a low-GI starch alternative must appear in shoppingList */
    safeAlternativeKeywords: [
      "quinoa", "cauliflower", "barley", "lentil", "brown rice", "farro",
      "bulgur", "chickpea", "wild rice", "oat",
    ],
  },
];

interface PartialRoundResult {
  label: string;
  message: string;
  claimedKeywords: string[];
  mealName: string;
  shoppingList: ShoppingListItem[];
  ownedIngredients: OwnedIngredient[];
  reasoning: string[];

  // Whether this is a conflict scenario (changes which checks apply)
  isConflictScenario: boolean;

  // Pass/fail checks — happy-path (non-conflict) rounds
  ownedContainsClaimedPass: boolean;   // A: ownedIngredients has the claimed item
  noUnclaimedSubstantivePass: boolean; // B: no unclaimed items leaked into ownedIngredients
  hasSubstantiveInShoppingPass: boolean; // C: shoppingList still has substantive items
  nonEmptyPass: boolean;               // D: combined list non-empty

  // Pass/fail checks — conflict rounds
  conflictSurfacedPass: boolean;       // E: ≥1 reasoning bullet contains a conflictKeyword
  nonEmptyAfterConflictPass: boolean;  // F: combined list still non-empty after conflict
  prohibitedAbsentPass: boolean;       // G: prohibited ingredient absent from all returned fields
  safeAlternativeOfferedPass: boolean; // H: a safe-alternative keyword appears in shoppingList items

  // Detail for reporting
  matchedOwned: OwnedIngredient[];       // owned items that matched a claimed keyword
  unclaimedOwned: OwnedIngredient[];     // owned items that did NOT match any claimed keyword
  substantiveShoppingItems: ShoppingListItem[];
  categoriesFound: string[];
  allConflictKeywords: string[];         // the full list expected by this scenario
  matchedConflictKeywords: string[];     // which conflictKeywords appeared in reasoning
  foundProhibitedIn: string[];           // field descriptions where prohibited keyword was found
  matchedSafeAlternatives: string[];     // safe-alt keywords that appear in shoppingList items
}

/**
 * Returns true when the ingredient name contains at least one claimed keyword.
 */
function matchesClaimed(itemName: string, claimedKeywords: string[]): boolean {
  const lower = itemName.toLowerCase();
  return claimedKeywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function evaluatePartialRound(
  prompt: PartialOwnershipPrompt,
  result: any
): PartialRoundResult {
  const {
    label, message, claimedKeywords,
    isConflictScenario = false,
    conflictKeywords = [],
    prohibitedKeywords = [],
    safeAlternativeKeywords = [],
  } = prompt;
  const mealName: string = result?.meal?.name ?? "(unknown)";
  const mealDescription: string = result?.meal?.description ?? "";
  const shoppingList: ShoppingListItem[] = Array.isArray(result?.shoppingList)
    ? result.shoppingList
    : [];
  const ownedIngredients: OwnedIngredient[] = Array.isArray(result?.ownedIngredients)
    ? result.ownedIngredients
    : [];
  const reasoning: string[] = Array.isArray(result?.reasoning)
    ? result.reasoning.filter((r: any) => typeof r === "string")
    : [];

  // A: ownedIngredients must contain at least one item matching a claimed keyword
  //    (only meaningful for non-conflict rounds)
  const matchedOwned = ownedIngredients.filter((o) =>
    matchesClaimed(o.item, claimedKeywords)
  );
  const ownedContainsClaimedPass = matchedOwned.length > 0;

  // B: no unclaimed item should appear in ownedIngredients
  //    (the model must not extend ownership to ingredients the user never mentioned)
  const unclaimedOwned = ownedIngredients.filter(
    (o) => !matchesClaimed(o.item, claimedKeywords)
  );
  const noUnclaimedSubstantivePass = unclaimedOwned.length === 0;

  // C: shoppingList must still have at least one substantive item
  //    (the non-owned recipe ingredients must be available to buy)
  const categoriesFound = [...new Set(shoppingList.map((i) => i.category ?? "Other"))];
  const substantiveShoppingItems = shoppingList.filter((i) =>
    SUBSTANTIVE_CATEGORIES.has(i.category)
  );
  const hasSubstantiveInShoppingPass = substantiveShoppingItems.length > 0;

  // D: combined list must be non-empty
  const nonEmptyPass = shoppingList.length + ownedIngredients.length > 0;

  // E: conflict must be surfaced in reasoning (conflict scenarios only)
  //    At least one reasoning bullet must contain one of the conflictKeywords.
  const reasoningText = reasoning.join(" ").toLowerCase();
  const matchedConflictKeywords = conflictKeywords.filter((kw) =>
    reasoningText.includes(kw.toLowerCase())
  );
  const conflictSurfacedPass = !isConflictScenario || matchedConflictKeywords.length > 0;

  // F: combined list still non-empty even after the conflict rejection path
  //    (the model must still propose a safe meal with a complete shopping list)
  const nonEmptyAfterConflictPass = !isConflictScenario || (shoppingList.length + ownedIngredients.length > 0);

  // G: prohibited ingredient absent from all returned fields
  //    Checks ownedIngredients item names, shoppingList item names, meal.name, meal.description.
  const foundProhibitedIn: string[] = [];
  if (isConflictScenario && prohibitedKeywords.length > 0) {
    for (const kw of prohibitedKeywords) {
      const kwLower = kw.toLowerCase();
      if (mealName.toLowerCase().includes(kwLower)) {
        foundProhibitedIn.push(`meal.name ("${mealName}")`);
      }
      if (mealDescription.toLowerCase().includes(kwLower)) {
        foundProhibitedIn.push(`meal.description ("${mealDescription.slice(0, 80)}…")`);
      }
      for (const o of ownedIngredients) {
        if (o.item.toLowerCase().includes(kwLower)) {
          foundProhibitedIn.push(`ownedIngredients item "${o.item}"`);
        }
      }
      for (const s of shoppingList) {
        if (s.item.toLowerCase().includes(kwLower)) {
          foundProhibitedIn.push(`shoppingList item "${s.item}"`);
        }
      }
    }
  }
  const prohibitedAbsentPass = !isConflictScenario || foundProhibitedIn.length === 0;

  // H: at least one shoppingList item matches a safe-alternative keyword
  //    (the model must offer a concrete safe replacement, not just explain the conflict)
  const matchedSafeAlternatives = safeAlternativeKeywords.filter((kw) =>
    shoppingList.some((s) => s.item.toLowerCase().includes(kw.toLowerCase()))
  );
  const safeAlternativeOfferedPass = !isConflictScenario || safeAlternativeKeywords.length === 0 || matchedSafeAlternatives.length > 0;

  return {
    label, message, claimedKeywords, mealName, shoppingList, ownedIngredients, reasoning,
    isConflictScenario,
    ownedContainsClaimedPass, noUnclaimedSubstantivePass,
    hasSubstantiveInShoppingPass, nonEmptyPass,
    conflictSurfacedPass, nonEmptyAfterConflictPass,
    prohibitedAbsentPass, safeAlternativeOfferedPass,
    matchedOwned, unclaimedOwned, substantiveShoppingItems, categoriesFound,
    allConflictKeywords: conflictKeywords,
    matchedConflictKeywords,
    foundProhibitedIn,
    matchedSafeAlternatives,
  };
}

function printPartialRoundReport(r: PartialRoundResult, idx: number, total: number): void {
  console.log(`\n${"─".repeat(68)}`);
  const modeTag = r.isConflictScenario ? " [CONFLICT]" : "";
  console.log(`Round ${idx}/${total} — ${r.label}${modeTag}`);
  console.log(`  Prompt     : "${r.message}"`);
  console.log(`  Claimed    : ${r.claimedKeywords.map((k) => `"${k}"`).join(", ")}`);
  console.log(`  Meal       : ${r.mealName}`);

  // Print reasoning bullets
  if (r.reasoning.length > 0) {
    console.log(`  Reasoning  :`);
    for (const bullet of r.reasoning) {
      console.log(`    • ${bullet}`);
    }
  }

  // Print ownedIngredients
  console.log(`  Owned (${r.ownedIngredients.length}): ${
    r.ownedIngredients.length === 0
      ? "(none)"
      : r.ownedIngredients.map((o) => `${o.item} [${o.quantity} ${o.unit}]`).join(", ")
  }`);

  // Print shoppingList by category
  console.log(`  Shopping (${r.shoppingList.length} items):`);
  if (r.shoppingList.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const item of r.shoppingList) {
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item.item);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      const tag = SUBSTANTIVE_CATEGORIES.has(cat) ? " ✅" : " (pantry)";
      console.log(`    ${cat}${tag}: ${items.join(", ")}`);
    }
  }

  if (!r.isConflictScenario) {
    // ── Happy-path checks (A–D) ────────────────────────────────────────────────

    // Check A
    if (r.ownedContainsClaimedPass) {
      console.log(
        `  ✅ CHECK A — ownedIngredients contains the claimed item: ` +
        r.matchedOwned.map((o) => `"${o.item}"`).join(", ")
      );
    } else {
      console.log(
        `  ❌ CHECK A — ownedIngredients does NOT contain the claimed ingredient` +
        ` (keyword(s): ${r.claimedKeywords.map((k) => `"${k}"`).join(", ")}). ` +
        `ownedIngredients is: ${
          r.ownedIngredients.length === 0
            ? "(empty)"
            : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
        }`
      );
    }

    // Check B
    if (r.noUnclaimedSubstantivePass) {
      console.log(
        `  ✅ CHECK B — no unclaimed items in ownedIngredients` +
        ` (model did not over-extend ownership)`
      );
    } else {
      console.log(
        `  ❌ CHECK B — unclaimed item(s) leaked into ownedIngredients: ` +
        r.unclaimedOwned.map((o) => `"${o.item}"`).join(", ")
      );
      console.log(
        `               The user never said they owned these — they must appear in shoppingList.`
      );
    }

    // Check C
    if (r.hasSubstantiveInShoppingPass) {
      console.log(
        `  ✅ CHECK C — shoppingList has ${r.substantiveShoppingItems.length} substantive item(s): ` +
        r.substantiveShoppingItems.slice(0, 5).map((i) => `${i.item} [${i.category}]`).join(", ") +
        (r.substantiveShoppingItems.length > 5 ? "…" : "")
      );
    } else {
      const cats = r.categoriesFound.join(", ") || "(none)";
      console.log(
        `  ❌ CHECK C — shoppingList has ONLY pantry/Other items. ` +
        `The claimed item was owned, but the remaining main ingredients ` +
        `(protein, produce, starch) are MISSING from shoppingList. ` +
        `Categories found: ${cats}`
      );
    }

    // Check D
    if (r.nonEmptyPass) {
      console.log(`  ✅ CHECK D — combined ingredient list is non-empty`);
    } else {
      console.log(`  ❌ CHECK D — both shoppingList and ownedIngredients are completely empty`);
    }

  } else {
    // ── Conflict-scenario checks (E–H) ────────────────────────────────────────
    // For conflict rounds the model MUST explain the conflict in reasoning (E),
    // still produce a well-formed non-empty response (F), exclude the prohibited
    // ingredient from all returned fields (G), and include a concrete safe
    // alternative in shoppingList (H).

    // Check E — conflict surfaced in reasoning
    if (r.conflictSurfacedPass) {
      console.log(
        `  ✅ CHECK E — conflict surfaced in reasoning` +
        ` (matched keyword(s): ${r.matchedConflictKeywords.map((k) => `"${k}"`).join(", ")})`
      );
    } else {
      console.log(
        `  ❌ CHECK E — conflict NOT mentioned in reasoning. ` +
        `The model silently swapped the ingredient without explaining why.\n` +
        `               Expected one of: ${r.allConflictKeywords.map((k) => `"${k}"`).join(", ")}\n` +
        `               Reasoning text was: "${r.reasoning.join(" | ")}"`
      );
    }

    // Check F — combined list non-empty after conflict
    if (r.nonEmptyAfterConflictPass) {
      console.log(
        `  ✅ CHECK F — response is still well-formed after conflict` +
        ` (${r.shoppingList.length} shopping items, ${r.ownedIngredients.length} owned items)`
      );
    } else {
      console.log(
        `  ❌ CHECK F — both shoppingList and ownedIngredients are empty after the conflict path.` +
        ` The model must still return a complete safe alternative meal.`
      );
    }

    // Check G — prohibited ingredient absent from all returned fields
    if (r.prohibitedAbsentPass) {
      console.log(
        `  ✅ CHECK G — prohibited ingredient absent from ownedIngredients, shoppingList, ` +
        `meal.name, meal.description`
      );
    } else {
      console.log(
        `  ❌ CHECK G — prohibited ingredient FOUND in response despite the conflict:\n` +
        r.foundProhibitedIn.map((loc) => `               • ${loc}`).join("\n")
      );
    }

    // Check H — safe alternative keyword present in shoppingList
    if (r.safeAlternativeOfferedPass) {
      console.log(
        `  ✅ CHECK H — safe alternative offered in shoppingList` +
        ` (matched: ${r.matchedSafeAlternatives.map((k) => `"${k}"`).join(", ")})`
      );
    } else {
      console.log(
        `  ❌ CHECK H — NO safe alternative found in shoppingList items.\n` +
        `               Expected one of: ${r.matchedSafeAlternatives.length === 0
          ? "(none matched)"
          : r.matchedSafeAlternatives.join(", ")}\n` +
        `               shoppingList items: ${r.shoppingList.map((s) => `"${s.item}"`).join(", ") || "(empty)"}`
      );
    }

    // Check C (shared) — shoppingList still has substantive items
    if (r.hasSubstantiveInShoppingPass) {
      console.log(
        `  ✅ CHECK C — shoppingList has ${r.substantiveShoppingItems.length} substantive item(s)` +
        ` (safe alternative meal is present): ` +
        r.substantiveShoppingItems.slice(0, 5).map((i) => `${i.item} [${i.category}]`).join(", ") +
        (r.substantiveShoppingItems.length > 5 ? "…" : "")
      );
    } else {
      const cats = r.categoriesFound.join(", ") || "(none)";
      console.log(
        `  ❌ CHECK C — shoppingList has ONLY pantry/Other items after the conflict path. ` +
        `The safe alternative meal is MISSING main ingredients. ` +
        `Categories found: ${cats}`
      );
    }
  }
}

async function runPartialOwnershipMode(): Promise<void> {
  const happyPathCount = PARTIAL_OWNERSHIP_PROMPTS.filter((p) => !p.isConflictScenario).length;
  const conflictCount  = PARTIAL_OWNERSHIP_PROMPTS.filter((p) =>  p.isConflictScenario).length;
  const total = PARTIAL_OWNERSHIP_PROMPTS.length;

  console.log("=".repeat(70));
  console.log("Grocery Coach Partial-Ownership Verification — Tasks 920 + 925");
  console.log("Happy-path checks: when the user claims ONE compatible ingredient,");
  console.log("  A. it lands in ownedIngredients,");
  console.log("  B. no unclaimed items bleed into ownedIngredients,");
  console.log("  C. shoppingList still has remaining substantive ingredients.");
  console.log("Conflict checks: when the claimed ingredient violates a protocol,");
  console.log("  E. the conflict is surfaced in reasoning (not a silent swap),");
  console.log("  F. the response is still non-empty and well-formed,");
  console.log("  G. the prohibited ingredient is absent from all returned fields,");
  console.log("  H. a concrete safe alternative appears in shoppingList items.");
  console.log(`Rounds    : ${total} total (${happyPathCount} happy-path, ${conflictCount} conflict)`);
  console.log("=".repeat(70));

  const rounds: PartialRoundResult[] = [];

  for (let i = 0; i < PARTIAL_OWNERSHIP_PROMPTS.length; i++) {
    const prompt = PARTIAL_OWNERSHIP_PROMPTS[i];
    const modeLabel = prompt.isConflictScenario ? "[CONFLICT]" : "[HAPPY]";
    process.stdout.write(`\nRound ${i + 1}/${total} ${modeLabel} — ${prompt.label} — calling AI...`);

    // Protocol block goes AFTER the base prompt so recency bias reinforces it.
    const systemPromptOverride = prompt.systemPromptAddition
      ? `${SYSTEM_PROMPT}\n\n${prompt.systemPromptAddition}`
      : undefined;

    // Conflict scenarios use temperature=0 so the strict override is applied
    // deterministically — a non-zero temperature makes the safety instruction
    // non-reproducible across runs.
    const temperature = prompt.isConflictScenario ? 0 : 0.75;
    const raw = await callGroceryCoach(prompt.message, systemPromptOverride, temperature);
    if (!raw) {
      console.error(`\n❌ Round ${i + 1} (${prompt.label}): AI returned unparseable response — aborting.`);
      process.exit(1);
    }
    console.log(" ✓");

    const r = evaluatePartialRound(prompt, raw);
    printPartialRoundReport(r, i + 1, total);
    rounds.push(r);
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY — Partial-Ownership + Conflict Mode");
  console.log("=".repeat(70));

  const col1 = 36;
  const col2 = 9;
  // Header varies by scenario type; A/B apply to happy-path, E/F/G/H to conflict.
  console.log(`${"Round".padEnd(col1)} ${"A/E".padEnd(col2)} ${"B/F".padEnd(col2)} ${"C/G".padEnd(col2)} ${"H".padEnd(col2)} Overall`);
  console.log(`${"".padEnd(col1)} ${"Claim/Conflict".padEnd(col2)} ${"NoLeak/NonEmp".padEnd(col2)} ${"Subst/NoProhib".padEnd(col2)} ${"SafeAlt".padEnd(col2)}`);
  console.log("-".repeat(82));

  let allPassed = true;
  const failedRounds: string[] = [];

  for (const r of rounds) {
    let roundPassed: boolean;
    let colA: string;
    let colB: string;
    let colC: string;
    let colH: string;

    if (r.isConflictScenario) {
      roundPassed =
        r.conflictSurfacedPass &&
        r.nonEmptyAfterConflictPass &&
        r.prohibitedAbsentPass &&
        r.safeAlternativeOfferedPass &&
        r.hasSubstantiveInShoppingPass;
      colA = r.conflictSurfacedPass        ? "✅ PASS" : "❌ FAIL";
      colB = r.nonEmptyAfterConflictPass   ? "✅ PASS" : "❌ FAIL";
      colC = r.prohibitedAbsentPass        ? "✅ PASS" : "❌ FAIL";
      colH = r.safeAlternativeOfferedPass  ? "✅ PASS" : "❌ FAIL";
    } else {
      roundPassed =
        r.ownedContainsClaimedPass &&
        r.noUnclaimedSubstantivePass &&
        r.hasSubstantiveInShoppingPass &&
        r.nonEmptyPass;
      colA = r.ownedContainsClaimedPass   ? "✅ PASS" : "❌ FAIL";
      colB = r.noUnclaimedSubstantivePass ? "✅ PASS" : "❌ FAIL";
      colC = r.hasSubstantiveInShoppingPass ? "✅ PASS" : "❌ FAIL";
      colH = "  n/a  ";
    }

    if (!roundPassed) {
      allPassed = false;
      failedRounds.push(r.label);
    }

    const overall = roundPassed ? "✅ PASS" : "❌ FAIL";
    const tag = r.isConflictScenario ? " [C]" : " [H]";
    const labelCol = (r.label + tag).padEnd(col1);
    console.log(`${labelCol} ${colA.padEnd(col2)} ${colB.padEnd(col2)} ${colC.padEnd(col2)} ${colH.padEnd(col2)} ${overall}`);
  }
  console.log("  [H] = Happy-path  [C] = Conflict  (A–D = happy checks, E–H = conflict checks)");

  // ── Failure detail ───────────────────────────────────────────────────────────
  if (!allPassed) {
    console.log("\nFAILURE DETAIL");
    console.log("-".repeat(70));

    for (const r of rounds) {
      if (r.isConflictScenario) {
        if (!r.conflictSurfacedPass) {
          console.error(
            `❌ [${r.label}] CHECK E FAIL — conflict NOT surfaced in reasoning.\n` +
            `   The model silently swapped the ingredient without explaining why.\n` +
            `   Expected one of: ${r.allConflictKeywords.map((k) => `"${k}"`).join(", ")}\n` +
            `   Reasoning text: "${r.reasoning.join(" | ")}"\n` +
            `   FIX: The system prompt conflict instruction in this scenario must be\n` +
            `   stronger, OR the groceryCoach.ts system prompt exception clause\n` +
            `   ("Exception: if using a stated ingredient would violate a safety,\n` +
            `   allergy, clinical, dietary, or protocol constraint, explain the conflict\n` +
            `   clearly…") needs to be reinforced.`
          );
        }
        if (!r.nonEmptyAfterConflictPass) {
          console.error(
            `❌ [${r.label}] CHECK F FAIL — both shoppingList and ownedIngredients\n` +
            `   are empty after the conflict path. The model must still return a\n` +
            `   safe alternative meal after rejecting the conflicting ingredient.`
          );
        }
        if (!r.prohibitedAbsentPass) {
          console.error(
            `❌ [${r.label}] CHECK G FAIL — prohibited ingredient found in response:\n` +
            r.foundProhibitedIn.map((loc) => `   • ${loc}`).join("\n") + "\n" +
            `   FIX: The conflict protocol must fully exclude the prohibited ingredient\n` +
            `   from the meal name, description, ownedIngredients, and shoppingList.\n` +
            `   Review the system prompt conflict instruction and the exception clause\n` +
            `   in server/routes/groceryCoach.ts.`
          );
        }
        if (!r.safeAlternativeOfferedPass) {
          console.error(
            `❌ [${r.label}] CHECK H FAIL — no safe alternative found in shoppingList.\n` +
            `   shoppingList items: ${r.shoppingList.map((s) => `"${s.item}"`).join(", ") || "(empty)"}\n` +
            `   FIX: After rejecting the conflict ingredient the model must add a\n` +
            `   concrete safe replacement to shoppingList (not just explain the conflict).`
          );
        }
        if (!r.hasSubstantiveInShoppingPass) {
          const cats = r.categoriesFound.join(", ") || "(none)";
          console.error(
            `❌ [${r.label}] CHECK C FAIL — shoppingList has only pantry/condiment items.\n` +
            `   Categories: ${cats}\n` +
            `   FIX: After rejecting the conflict ingredient the model must still add\n` +
            `   a safe alternative protein/produce/starch to shoppingList.`
          );
        }
      } else {
        if (!r.ownedContainsClaimedPass) {
          console.error(
            `❌ [${r.label}] The claimed ingredient ` +
            `(keyword: ${r.claimedKeywords.map((k) => `"${k}"`).join(", ")}) ` +
            `was NOT placed in ownedIngredients.\n` +
            `   ownedIngredients contains: ${
              r.ownedIngredients.length === 0
                ? "(nothing)"
                : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
            }\n` +
            `   FIX: The model ignored the user's explicit ownership claim. ` +
            `Check the CRITICAL ownedIngredients rule in server/routes/groceryCoach.ts.`
          );
        }
        if (!r.noUnclaimedSubstantivePass) {
          console.error(
            `❌ [${r.label}] Unclaimed item(s) leaked into ownedIngredients:\n` +
            r.unclaimedOwned.map((o) => `   - "${o.item}"`).join("\n") + "\n" +
            `   These ingredients were NOT mentioned by the user as already owned.\n` +
            `   FIX: The model over-extended ownership — it inferred ownership from the\n` +
            `   meal name or description instead of from explicit user claims.\n` +
            `   Check the CRITICAL ownedIngredients rule in server/routes/groceryCoach.ts.`
          );
        }
        if (!r.hasSubstantiveInShoppingPass) {
          const cats = r.categoriesFound.join(", ") || "(none)";
          console.error(
            `❌ [${r.label}] shoppingList contains ONLY pantry/condiment items after\n` +
            `   partial ownership was applied. The remaining main ingredients ` +
            `(protein, produce, starch) are missing.\n` +
            `   Categories returned: ${cats}\n` +
            `   FIX: This is the partial-ownership ingredient-loss bug. After placing the\n` +
            `   claimed item in ownedIngredients, the model failed to put the rest of the\n` +
            `   recipe into shoppingList. Review the system prompt in groceryCoach.ts —\n` +
            `   specifically: "Every ingredient required to cook the recommended meal that\n` +
            `   the user did not explicitly claim to already own MUST appear in shoppingList."`
          );
        }
        if (!r.nonEmptyPass) {
          console.error(
            `❌ [${r.label}] Both shoppingList and ownedIngredients are completely empty.`
          );
        }
      }
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log(`🎉 VERDICT: PASS — all ${total} rounds passed (${happyPathCount} happy-path, ${conflictCount} conflict).`);
    console.log("   Happy-path: each claimed ingredient landed in ownedIngredients,");
    console.log("   no unclaimed items bled in, shoppingList had remaining substantive items.");
    console.log("   Conflict:   each protocol conflict was explained in reasoning,");
    console.log("   responses were still non-empty and shoppingList offered a safe alternative.");
  } else {
    console.log("❌ VERDICT: FAIL — partial-ownership (or conflict) ingredient handling is broken.");
    console.log(`   Failed rounds: ${failedRounds.join(", ")}`);
    console.log("   See FAILURE DETAIL above for per-round root cause and fix guidance.");
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  process.exit(process.exitCode ?? 0);
}

// ── Shared AI call ────────────────────────────────────────────────────────────
/**
 * Call the Grocery Coach model with the given user message.
 * @param message      The user's message.
 * @param systemPrompt Optional full system prompt override.  When omitted the
 *                     default SYSTEM_PROMPT is used.  Conflict scenarios pass a
 *                     version with the protocol constraint appended for recency priority.
 * @param temperature  Sampling temperature.  Use 0 for deterministic conflict
 *                     scenarios so the override is reliably applied.
 */
async function callGroceryCoach(
  message: string,
  systemPrompt?: string,
  temperature: number = 0.75,
): Promise<any | null> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt ?? SYSTEM_PROMPT },
      { role: "user",   content: message },
    ],
    response_format: { type: "json_object" },
    temperature,
    max_tokens: 1400,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    console.error("  ❌ Failed to parse JSON response");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-OWNERSHIP MODE (Task 926)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each entry claims EXACTLY 2 ingredients. The evaluation checks:
 *   A. bothClaimedPresent — BOTH claimed keywords appear in ownedIngredients
 *      (at least one owned item must match each keyword).
 *   B. noUnclaimedSubstantive — every item in ownedIngredients matches one of
 *      the two claimed keywords; no other ingredients leak into ownedIngredients.
 *   C. hasSubstantiveInShopping — shoppingList still has ≥1 Meat/Produce/Grains/etc
 *      item (the unclaimed recipe complement must still be purchasable).
 *   D. nonEmpty — combined list is non-empty.
 *
 * Re-uses PartialOwnershipPrompt / PartialRoundResult / evaluatePartialRound —
 * those are already multi-keyword-aware via matchesClaimed().
 * The only additional check is that EVERY keyword is individually represented.
 */
interface MultiOwnershipRoundResult extends PartialRoundResult {
  /** For each claimed keyword, whether at least one owned item matched it. */
  perKeywordHit: Map<string, boolean>;
  /** true iff every keyword has at least one owned-item match */
  bothClaimedPresentPass: boolean;
}

function evaluateMultiRound(
  prompt: PartialOwnershipPrompt,
  result: any
): MultiOwnershipRoundResult {
  // Run the base partial evaluation (covers B, C, D, and the union A check).
  const base = evaluatePartialRound(prompt, result);

  // Additional check: every keyword must have at least one matching owned item.
  const ownedIngredients = base.ownedIngredients;
  const perKeywordHit = new Map<string, boolean>();
  for (const kw of prompt.claimedKeywords) {
    const hit = ownedIngredients.some((o) =>
      o.item.toLowerCase().includes(kw.toLowerCase())
    );
    perKeywordHit.set(kw, hit);
  }
  const bothClaimedPresentPass = [...perKeywordHit.values()].every(Boolean);

  return {
    ...base,
    perKeywordHit,
    bothClaimedPresentPass,
  };
}

const MULTI_OWNERSHIP_PROMPTS: PartialOwnershipPrompt[] = [
  {
    label: "Protein + starch (chicken + rice)",
    message:
      "I have chicken breast and rice at home — what else do I need to buy to make a complete dinner tonight?",
    claimedKeywords: ["chicken", "rice"],
  },
  {
    label: "Protein + produce (salmon + broccoli)",
    message:
      "I already have salmon and broccoli in my fridge. What else should I grab from the store to round out the meal?",
    claimedKeywords: ["salmon", "broccoli"],
  },
  {
    label: "Starch + produce (sweet potato + spinach)",
    message:
      "I bought sweet potatoes and spinach earlier — what protein and anything else do I still need to buy?",
    claimedKeywords: ["sweet potato", "spinach"],
  },
  {
    label: "Two proteins (ground beef + black beans)",
    message:
      "I have ground beef and black beans at home. What vegetables and other items do I need to pick up for a healthy dinner?",
    claimedKeywords: ["ground beef", "black bean"],
  },
];

function printMultiRoundReport(r: MultiOwnershipRoundResult, idx: number, total: number): void {
  console.log(`\n${"─".repeat(68)}`);
  console.log(`Round ${idx}/${total} — ${r.label}`);
  console.log(`  Prompt     : "${r.message}"`);
  console.log(`  Claimed    : ${r.claimedKeywords.map((k) => `"${k}"`).join(", ")}`);
  console.log(`  Meal       : ${r.mealName}`);

  // Print ownedIngredients
  console.log(`  Owned (${r.ownedIngredients.length}): ${
    r.ownedIngredients.length === 0
      ? "(none)"
      : r.ownedIngredients.map((o) => `${o.item} [${o.quantity} ${o.unit}]`).join(", ")
  }`);

  // Print shoppingList by category
  console.log(`  Shopping (${r.shoppingList.length} items):`);
  if (r.shoppingList.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const item of r.shoppingList) {
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item.item);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      const tag = SUBSTANTIVE_CATEGORIES.has(cat) ? " ✅" : " (pantry)";
      console.log(`    ${cat}${tag}: ${items.join(", ")}`);
    }
  }

  // Check A — both claimed keywords must appear in ownedIngredients
  if (r.bothClaimedPresentPass) {
    console.log(
      `  ✅ CHECK A — BOTH claimed items appear in ownedIngredients: ` +
      r.matchedOwned.map((o) => `"${o.item}"`).join(", ")
    );
  } else {
    const missing = r.claimedKeywords.filter((kw) => !r.perKeywordHit.get(kw));
    console.log(
      `  ❌ CHECK A — NOT all claimed items appear in ownedIngredients.` +
      ` Missing keyword(s): ${missing.map((k) => `"${k}"`).join(", ")}.` +
      ` ownedIngredients is: ${
        r.ownedIngredients.length === 0
          ? "(empty)"
          : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
      }`
    );
  }

  // Check B — no unclaimed items in ownedIngredients
  if (r.noUnclaimedSubstantivePass) {
    console.log(`  ✅ CHECK B — no unclaimed items in ownedIngredients (model did not over-extend ownership)`);
  } else {
    console.log(
      `  ❌ CHECK B — unclaimed item(s) leaked into ownedIngredients: ` +
      r.unclaimedOwned.map((o) => `"${o.item}"`).join(", ")
    );
    console.log(`               The user never claimed these — they must appear in shoppingList.`);
  }

  // Check C — shoppingList still has substantive items
  if (r.hasSubstantiveInShoppingPass) {
    console.log(
      `  ✅ CHECK C — shoppingList has ${r.substantiveShoppingItems.length} substantive item(s): ` +
      r.substantiveShoppingItems.slice(0, 5).map((i) => `${i.item} [${i.category}]`).join(", ") +
      (r.substantiveShoppingItems.length > 5 ? "…" : "")
    );
  } else {
    const cats = r.categoriesFound.join(", ") || "(none)";
    console.log(
      `  ❌ CHECK C — shoppingList has ONLY pantry/Other items. ` +
      `Both claimed items were owned, but the remaining main ingredients ` +
      `(produce, sauce, starch, etc.) are MISSING. Categories found: ${cats}`
    );
  }

  // Check D
  if (r.nonEmptyPass) {
    console.log(`  ✅ CHECK D — combined ingredient list is non-empty`);
  } else {
    console.log(`  ❌ CHECK D — both shoppingList and ownedIngredients are completely empty`);
  }
}

async function runMultiOwnershipMode(): Promise<void> {
  const total = MULTI_OWNERSHIP_PROMPTS.length;

  console.log("=".repeat(70));
  console.log("Grocery Coach Multi-Ownership Verification — Task 926");
  console.log("Validates : when the user claims TWO ingredients explicitly,");
  console.log("  A. BOTH claimed items land in ownedIngredients,");
  console.log("  B. no unclaimed items bleed into ownedIngredients,");
  console.log("  C. shoppingList still contains the remaining substantive");
  console.log("     ingredients (produce, sauce, etc.) for the meal.");
  console.log(`Rounds    : ${total} scenarios (protein+starch, protein+produce,`);
  console.log("           starch+produce, two-protein)");
  console.log("=".repeat(70));

  const rounds: MultiOwnershipRoundResult[] = [];

  for (let i = 0; i < MULTI_OWNERSHIP_PROMPTS.length; i++) {
    const prompt = MULTI_OWNERSHIP_PROMPTS[i];
    process.stdout.write(`\nRound ${i + 1}/${total} — ${prompt.label} — calling AI...`);

    const raw = await callGroceryCoach(prompt.message);
    if (!raw) {
      console.error(`\n❌ Round ${i + 1} (${prompt.label}): AI returned unparseable response — aborting.`);
      process.exit(1);
    }
    console.log(" ✓");

    const r = evaluateMultiRound(prompt, raw);
    printMultiRoundReport(r, i + 1, total);
    rounds.push(r);
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY — Multi-Ownership Mode");
  console.log("=".repeat(70));

  const col1 = 36;
  const col2 = 10;
  console.log(
    `${"Round".padEnd(col1)} ${"BothOwned".padEnd(col2 + 2)} ${"NoUnclaimed".padEnd(col2 + 2)} ${"HasSubst".padEnd(col2)} Overall`
  );
  console.log("-".repeat(70));

  let allPassed = true;
  const failedRounds: string[] = [];

  for (const r of rounds) {
    const roundPassed =
      r.bothClaimedPresentPass &&
      r.noUnclaimedSubstantivePass &&
      r.hasSubstantiveInShoppingPass &&
      r.nonEmptyPass;
    if (!roundPassed) {
      allPassed = false;
      failedRounds.push(r.label);
    }

    const a = r.bothClaimedPresentPass      ? "✅ PASS" : "❌ FAIL";
    const b = r.noUnclaimedSubstantivePass  ? "✅ PASS" : "❌ FAIL";
    const c = r.hasSubstantiveInShoppingPass ? "✅ PASS" : "❌ FAIL";
    const overall = roundPassed             ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.label.padEnd(col1)} ${a.padEnd(col2 + 2)} ${b.padEnd(col2 + 2)} ${c.padEnd(col2)} ${overall}`
    );
  }

  // ── Failure detail ───────────────────────────────────────────────────────────
  if (!allPassed) {
    console.log("\nFAILURE DETAIL");
    console.log("-".repeat(70));

    for (const r of rounds) {
      if (!r.bothClaimedPresentPass) {
        const missing = r.claimedKeywords.filter((kw) => !r.perKeywordHit.get(kw));
        console.error(
          `❌ [${r.label}] One or more claimed keywords were NOT placed in ownedIngredients.\n` +
          `   Missing: ${missing.map((k) => `"${k}"`).join(", ")}\n` +
          `   ownedIngredients contains: ${
            r.ownedIngredients.length === 0
              ? "(nothing)"
              : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
          }\n` +
          `   FIX: The model missed one of the two explicit ownership claims. ` +
          `Check the CRITICAL ownedIngredients rule in server/routes/groceryCoach.ts — ` +
          `it must honour ALL explicitly stated ingredients, not just the first one.`
        );
      }
      if (!r.noUnclaimedSubstantivePass) {
        console.error(
          `❌ [${r.label}] Unclaimed item(s) leaked into ownedIngredients:\n` +
          r.unclaimedOwned.map((o) => `   - "${o.item}"`).join("\n") + "\n" +
          `   These ingredients were NOT mentioned by the user as already owned.\n` +
          `   FIX: The model over-extended ownership — it inferred ownership from the\n` +
          `   meal name or description. Check the CRITICAL ownedIngredients rule in\n` +
          `   server/routes/groceryCoach.ts.`
        );
      }
      if (!r.hasSubstantiveInShoppingPass) {
        const cats = r.categoriesFound.join(", ") || "(none)";
        console.error(
          `❌ [${r.label}] shoppingList contains ONLY pantry/condiment items.\n` +
          `   Both claimed items were placed in ownedIngredients, but the remaining\n` +
          `   main recipe ingredients are missing from shoppingList.\n` +
          `   Categories returned: ${cats}\n` +
          `   FIX: After anchoring the two owned items, the model dropped the rest of\n` +
          `   the recipe from shoppingList. Review the system prompt in groceryCoach.ts —\n` +
          `   "Every ingredient required to cook the recommended meal that the user did\n` +
          `   not explicitly claim to already own MUST appear in shoppingList."`
        );
      }
      if (!r.nonEmptyPass) {
        console.error(
          `❌ [${r.label}] Both shoppingList and ownedIngredients are completely empty.`
        );
      }
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log(`🎉 VERDICT: PASS — all ${total} multi-ownership rounds are correct.`);
    console.log("   Both claimed ingredients landed in ownedIngredients,");
    console.log("   no unclaimed items bled in, and shoppingList still contained");
    console.log("   the remaining substantive recipe ingredients.");
  } else {
    console.log("❌ VERDICT: FAIL — multi-ownership ingredient handling is broken.");
    console.log(`   Failed rounds: ${failedRounds.join(", ")}`);
    console.log("   The model either missed a claimed item in ownedIngredients,");
    console.log("   over-extended ownership to unclaimed ingredients, or");
    console.log("   dropped remaining recipe ingredients from shoppingList.");
    console.log("   Root cause: review the CRITICAL ownedIngredients rule in");
    console.log("   server/routes/groceryCoach.ts.");
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  process.exit(process.exitCode ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIPLE-OWNERSHIP MODE (Task 928)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each entry claims EXACTLY 3 ingredients. The evaluation checks:
 *   A. allClaimedPresent — ALL THREE claimed keywords appear in ownedIngredients
 *      (at least one owned item must match each keyword).
 *   B. noUnclaimedSubstantive — every item in ownedIngredients matches one of
 *      the three claimed keywords; no other ingredients leak into ownedIngredients.
 *   C. hasSubstantiveInShopping — shoppingList still has ≥1 Meat/Produce/Grains/etc
 *      item (the unclaimed recipe complement must still be purchasable).
 *   D. nonEmpty — combined list is non-empty.
 *
 * Re-uses PartialOwnershipPrompt / evaluateMultiRound — those functions are
 * already fully generic (they handle any number of claimed keywords).
 * MultiOwnershipRoundResult.bothClaimedPresentPass covers the "all N keywords
 * matched" check regardless of N; the field name is reused as allClaimedPresentPass.
 */

const TRIPLE_OWNERSHIP_PROMPTS: PartialOwnershipPrompt[] = [
  {
    label: "Protein + starch + produce (chicken + quinoa + spinach)",
    message:
      "I already have chicken breast, quinoa, and spinach at home — what else do I need to pick up from the store to complete a healthy dinner tonight?",
    claimedKeywords: ["chicken", "quinoa", "spinach"],
  },
  {
    label: "Protein + starch + sauce (salmon + brown rice + soy sauce)",
    message:
      "I have salmon, brown rice, and soy sauce at home. What else should I grab from the grocery store to make a full balanced meal?",
    claimedKeywords: ["salmon", "brown rice", "soy sauce"],
  },
  {
    label: "Two produce + starch (broccoli + bell pepper + sweet potato)",
    message:
      "I already bought broccoli, bell peppers, and sweet potatoes. What protein and any other items do I still need to buy for a complete dinner?",
    claimedKeywords: ["broccoli", "bell pepper", "sweet potato"],
  },
  {
    label: "Protein + legume + produce (ground turkey + lentils + kale)",
    message:
      "I have ground turkey, lentils, and kale at home. What other ingredients should I add to the shopping list to round out a nutritious dinner?",
    claimedKeywords: ["ground turkey", "lentil", "kale"],
  },
];

function printTripleRoundReport(r: MultiOwnershipRoundResult, idx: number, total: number): void {
  console.log(`\n${"─".repeat(68)}`);
  console.log(`Round ${idx}/${total} — ${r.label}`);
  console.log(`  Prompt     : "${r.message}"`);
  console.log(`  Claimed    : ${r.claimedKeywords.map((k) => `"${k}"`).join(", ")}`);
  console.log(`  Meal       : ${r.mealName}`);

  // Print ownedIngredients
  console.log(`  Owned (${r.ownedIngredients.length}): ${
    r.ownedIngredients.length === 0
      ? "(none)"
      : r.ownedIngredients.map((o) => `${o.item} [${o.quantity} ${o.unit}]`).join(", ")
  }`);

  // Print shoppingList by category
  console.log(`  Shopping (${r.shoppingList.length} items):`);
  if (r.shoppingList.length > 0) {
    const byCategory: Record<string, string[]> = {};
    for (const item of r.shoppingList) {
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item.item);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      const tag = SUBSTANTIVE_CATEGORIES.has(cat) ? " ✅" : " (pantry)";
      console.log(`    ${cat}${tag}: ${items.join(", ")}`);
    }
  }

  // Check A — all three claimed keywords must appear in ownedIngredients
  if (r.bothClaimedPresentPass) {
    console.log(
      `  ✅ CHECK A — ALL claimed items appear in ownedIngredients: ` +
      r.matchedOwned.map((o) => `"${o.item}"`).join(", ")
    );
  } else {
    const missing = r.claimedKeywords.filter((kw) => !r.perKeywordHit.get(kw));
    console.log(
      `  ❌ CHECK A — NOT all claimed items appear in ownedIngredients.` +
      ` Missing keyword(s): ${missing.map((k) => `"${k}"`).join(", ")}.` +
      ` ownedIngredients is: ${
        r.ownedIngredients.length === 0
          ? "(empty)"
          : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
      }`
    );
  }

  // Check B — no unclaimed items in ownedIngredients
  if (r.noUnclaimedSubstantivePass) {
    console.log(`  ✅ CHECK B — no unclaimed items in ownedIngredients (model did not over-extend ownership)`);
  } else {
    console.log(
      `  ❌ CHECK B — unclaimed item(s) leaked into ownedIngredients: ` +
      r.unclaimedOwned.map((o) => `"${o.item}"`).join(", ")
    );
    console.log(`               The user never claimed these — they must appear in shoppingList.`);
  }

  // Check C — shoppingList still has substantive items
  if (r.hasSubstantiveInShoppingPass) {
    console.log(
      `  ✅ CHECK C — shoppingList has ${r.substantiveShoppingItems.length} substantive item(s): ` +
      r.substantiveShoppingItems.slice(0, 5).map((i) => `${i.item} [${i.category}]`).join(", ") +
      (r.substantiveShoppingItems.length > 5 ? "…" : "")
    );
  } else {
    const cats = r.categoriesFound.join(", ") || "(none)";
    console.log(
      `  ❌ CHECK C — shoppingList has ONLY pantry/Other items. ` +
      `All three claimed items were owned, but the remaining main ingredients ` +
      `are MISSING from shoppingList. Categories found: ${cats}`
    );
  }

  // Check D
  if (r.nonEmptyPass) {
    console.log(`  ✅ CHECK D — combined ingredient list is non-empty`);
  } else {
    console.log(`  ❌ CHECK D — both shoppingList and ownedIngredients are completely empty`);
  }
}

async function runTripleOwnershipMode(): Promise<void> {
  const total = TRIPLE_OWNERSHIP_PROMPTS.length;

  console.log("=".repeat(70));
  console.log("Grocery Coach Triple-Ownership Verification — Task 928");
  console.log("Validates : when the user claims THREE ingredients explicitly,");
  console.log("  A. ALL three claimed items land in ownedIngredients,");
  console.log("  B. no unclaimed items bleed into ownedIngredients,");
  console.log("  C. shoppingList still contains at least one substantive");
  console.log("     (non-pantry) item representing the unclaimed recipe complement.");
  console.log(`Rounds    : ${total} scenarios (protein+starch+produce, protein+starch+sauce,`);
  console.log("           two-produce+starch, protein+legume+produce)");
  console.log("=".repeat(70));

  const rounds: MultiOwnershipRoundResult[] = [];

  for (let i = 0; i < TRIPLE_OWNERSHIP_PROMPTS.length; i++) {
    const prompt = TRIPLE_OWNERSHIP_PROMPTS[i];
    process.stdout.write(`\nRound ${i + 1}/${total} — ${prompt.label} — calling AI...`);

    const raw = await callGroceryCoach(prompt.message);
    if (!raw) {
      console.error(`\n❌ Round ${i + 1} (${prompt.label}): AI returned unparseable response — aborting.`);
      process.exit(1);
    }
    console.log(" ✓");

    const r = evaluateMultiRound(prompt, raw);
    printTripleRoundReport(r, i + 1, total);
    rounds.push(r);
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY — Triple-Ownership Mode");
  console.log("=".repeat(70));

  const col1 = 46;
  const col2 = 10;
  console.log(
    `${"Round".padEnd(col1)} ${"AllOwned".padEnd(col2)} ${"NoUnclaimed".padEnd(col2 + 2)} ${"HasSubst".padEnd(col2)} Overall`
  );
  console.log("-".repeat(80));

  let allPassed = true;
  const failedRounds: string[] = [];

  for (const r of rounds) {
    const roundPassed =
      r.bothClaimedPresentPass &&
      r.noUnclaimedSubstantivePass &&
      r.hasSubstantiveInShoppingPass &&
      r.nonEmptyPass;
    if (!roundPassed) {
      allPassed = false;
      failedRounds.push(r.label);
    }

    const a = r.bothClaimedPresentPass       ? "✅ PASS" : "❌ FAIL";
    const b = r.noUnclaimedSubstantivePass   ? "✅ PASS" : "❌ FAIL";
    const c = r.hasSubstantiveInShoppingPass ? "✅ PASS" : "❌ FAIL";
    const overall = roundPassed              ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.label.padEnd(col1)} ${a.padEnd(col2)} ${b.padEnd(col2 + 2)} ${c.padEnd(col2)} ${overall}`
    );
  }

  // ── Failure detail ───────────────────────────────────────────────────────────
  if (!allPassed) {
    console.log("\nFAILURE DETAIL");
    console.log("-".repeat(70));

    for (const r of rounds) {
      if (!r.bothClaimedPresentPass) {
        const missing = r.claimedKeywords.filter((kw) => !r.perKeywordHit.get(kw));
        console.error(
          `❌ [${r.label}] One or more of the three claimed keywords were NOT placed in ownedIngredients.\n` +
          `   Missing: ${missing.map((k) => `"${k}"`).join(", ")}\n` +
          `   ownedIngredients contains: ${
            r.ownedIngredients.length === 0
              ? "(nothing)"
              : r.ownedIngredients.map((o) => `"${o.item}"`).join(", ")
          }\n` +
          `   FIX: The model missed one of the three explicit ownership claims. ` +
          `Check the CRITICAL ownedIngredients rule in server/routes/groceryCoach.ts — ` +
          `it must honour ALL explicitly stated ingredients, not just the first one or two.`
        );
      }
      if (!r.noUnclaimedSubstantivePass) {
        console.error(
          `❌ [${r.label}] Unclaimed item(s) leaked into ownedIngredients:\n` +
          r.unclaimedOwned.map((o) => `   - "${o.item}"`).join("\n") + "\n" +
          `   These ingredients were NOT mentioned by the user as already owned.\n` +
          `   FIX: The model over-extended ownership — it inferred ownership from the\n` +
          `   meal name or description. Check the CRITICAL ownedIngredients rule in\n` +
          `   server/routes/groceryCoach.ts.`
        );
      }
      if (!r.hasSubstantiveInShoppingPass) {
        const cats = r.categoriesFound.join(", ") || "(none)";
        console.error(
          `❌ [${r.label}] shoppingList contains ONLY pantry/condiment items.\n` +
          `   All three claimed items were placed in ownedIngredients, but the remaining\n` +
          `   main recipe ingredients are missing from shoppingList.\n` +
          `   Categories returned: ${cats}\n` +
          `   FIX: After anchoring the three owned items, the model dropped the rest of\n` +
          `   the recipe from shoppingList. Review the system prompt in groceryCoach.ts —\n` +
          `   "Every ingredient required to cook the recommended meal that the user did\n` +
          `   not explicitly claim to already own MUST appear in shoppingList."`
        );
      }
      if (!r.nonEmptyPass) {
        console.error(
          `❌ [${r.label}] Both shoppingList and ownedIngredients are completely empty.`
        );
      }
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  if (allPassed) {
    console.log(`🎉 VERDICT: PASS — all ${total} triple-ownership rounds are correct.`);
    console.log("   All three claimed ingredients landed in ownedIngredients,");
    console.log("   no unclaimed items bled in, and shoppingList still contained");
    console.log("   at least one substantive (non-pantry) recipe ingredient.");
  } else {
    console.log("❌ VERDICT: FAIL — triple-ownership ingredient handling is broken.");
    console.log(`   Failed rounds: ${failedRounds.join(", ")}`);
    console.log("   The model either missed a claimed item in ownedIngredients,");
    console.log("   over-extended ownership to unclaimed ingredients, or");
    console.log("   dropped remaining recipe ingredients from shoppingList.");
    console.log("   Root cause: review the CRITICAL ownedIngredients rule in");
    console.log("   server/routes/groceryCoach.ts.");
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  process.exit(process.exitCode ?? 0);
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isPartialOwnership = args.includes("--partial-ownership");
  const isMultiOwnership   = args.includes("--multi-ownership");
  const isTripleOwnership  = args.includes("--triple-ownership");

  if (isTripleOwnership) {
    await runTripleOwnershipMode();
  } else if (isMultiOwnership) {
    await runMultiOwnershipMode();
  } else if (isPartialOwnership) {
    await runPartialOwnershipMode();
  } else {
    await runZeroOwnershipMode();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
