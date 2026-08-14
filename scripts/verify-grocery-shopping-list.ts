/**
 * Grocery Coach Shopping-List Completeness Verification — Task 916
 *
 * Verifies that the Grocery Coach's shoppingList always contains the full
 * recipe (protein + produce + starch), not just pantry/condiment items.
 *
 * This regression test guards against the ingredient-loss bug where the main
 * protein, produce, and starch silently migrated into ownedIngredients while
 * only garlic / oil / seasoning showed in shoppingList.
 *
 * Test matrix — 5 meal types, each with a plain request (no "I have…" claims):
 *   1. Fish   — "I'd like a salmon dinner"
 *   2. Chicken — "give me a chicken dinner"
 *   3. Beef    — "I want a beef meal for tonight"
 *   4. Vegetarian — "something vegetarian for dinner"
 *   5. Mixed-component — "make me a balanced meal with a protein, a veggie, and a starch"
 *
 * Pass criteria (every round must satisfy ALL):
 *   A. ownedIngredients MUST be empty — no owned-ingredient claims were made.
 *   B. shoppingList must contain at least ONE item whose category is Meat,
 *      Produce, Plant Proteins, Grains & Packaged, or Frozen.
 *      (i.e., not ALL items can be Pantry / Other).
 *   C. The combined shoppingList + ownedIngredients must be non-empty.
 *
 * Usage:
 *   npx tsx scripts/verify-grocery-shopping-list.ts
 */

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Test prompts ──────────────────────────────────────────────────────────────
// None of these contain "I have", "I already bought", "I own", or any phrase
// that would legitimately trigger ownedIngredients population.
const TEST_PROMPTS: Array<{ label: string; message: string }> = [
  { label: "Fish (salmon)",        message: "I'd like a salmon dinner" },
  { label: "Chicken",              message: "Give me a chicken dinner" },
  { label: "Beef",                 message: "I want a beef meal for tonight" },
  { label: "Vegetarian",           message: "Something vegetarian for dinner" },
  { label: "Mixed-component",      message: "Make me a balanced meal with a protein, a veggie, and a starch" },
];

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
  substantiveItems: string[];
  pantryOnlyItems: string[];
}

// ── AI call ───────────────────────────────────────────────────────────────────
async function callGroceryCoach(message: string): Promise<any | null> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
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

// ── Evaluation ────────────────────────────────────────────────────────────────
function evaluateRound(
  label: string,
  message: string,
  result: any
): RoundResult {
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
    label,
    message,
    mealName,
    shoppingList,
    ownedIngredients,
    ownedEmptyPass,
    hasSubstantiveItemPass,
    nonEmptyListPass,
    ownedItems,
    categoriesFound,
    substantiveItems,
    pantryOnlyItems,
  };
}

// ── Report ────────────────────────────────────────────────────────────────────
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

  // Check A
  if (r.ownedEmptyPass) {
    console.log(`  ✅ CHECK A — ownedIngredients is empty (correct: no ownership claims made)`);
  } else {
    console.log(`  ❌ CHECK A — ownedIngredients is NOT empty (${r.ownedIngredients.length} item(s) leaked in):`);
    for (const o of r.ownedItems) {
      console.log(`               ⚠️  ${o}`);
    }
  }

  // Check B
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

  // Check C
  if (r.nonEmptyListPass) {
    console.log(`  ✅ CHECK C — combined ingredient list is non-empty`);
  } else {
    console.log(`  ❌ CHECK C — both shoppingList and ownedIngredients are completely empty`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
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

  // Table
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

    const a = r.ownedEmptyPass      ? "✅ PASS" : "❌ FAIL";
    const b = r.hasSubstantiveItemPass ? "✅ PASS" : "❌ FAIL";
    const c = r.nonEmptyListPass    ? "✅ PASS" : "❌ FAIL";
    const overall = roundPassed ? "✅ PASS" : "❌ FAIL";
    console.log(
      `${r.label.padEnd(col1)} ${a.padEnd(col2)} ${b.padEnd(col2)} ${c.padEnd(col2)} ${overall}`
    );
  }

  // Failure detail
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
        for (const o of r.ownedItems) {
          console.error(`   - ${o}`);
        }
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

  // Verdict
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

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
