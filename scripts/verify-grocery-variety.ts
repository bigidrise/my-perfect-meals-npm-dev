/**
 * Grocery Coach Variety Verification
 *
 * Simulates 10 sequential "give me dinner" requests for the same user,
 * using the same OpenAI prompt + DB history pattern the /recommend route uses.
 *
 * Modes:
 *   npx tsx scripts/verify-grocery-variety.ts
 *     → Task 892 baseline: no dietary constraints, wide-open meal pool
 *
 *   npx tsx scripts/verify-grocery-variety.ts --constrained
 *     → Task 895 constraint sim: gluten-free + dairy-free protocol active.
 *       Verifies variety still rotates when the safe-meal pool is restricted,
 *       and that scanGeneratedOutput passes 100% of rounds (no protocol violations).
 */
import OpenAI from "openai";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import {
  buildGuestEnvelope,
  deriveProcedureRules,
  enforceBeforeGenerate,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "../server/services/protocolEnvelope";

// ── CLI flags ──────────────────────────────────────────────────────────────────
const CONSTRAINED_MODE = process.argv.includes("--constrained");

const TEST_USER_ID = CONSTRAINED_MODE
  ? "verify-variety-895-constrained"
  : "verify-variety-892";

const MEAL_REQUEST = "give me dinner";
const ROUNDS = 10;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ──────────────────────────────────────────────────────────────────────
interface VarietyMeta {
  primaryProtein: string;
  cuisineStyle: string;
  majorStarch: string;
  cookingMethod: string;
}

interface Round {
  round: number;
  mealName: string;
  meta: VarietyMeta;
  scanPassed: boolean;
  scanViolations: string[];
}

// ── Envelope builder ───────────────────────────────────────────────────────────

/**
 * Build a UserProtocolEnvelope for gluten-free + dairy-free constraints.
 * dietaryIdentity: ["gluten-free"] — activates the GF procedure rules (no wheat,
 *   no soy sauce, cross-contamination prevention, etc.)
 * allergies: ["dairy"] — hard stop on all dairy derivatives.
 * This mirrors a realistic constrained user without medical conditions, so the
 * simulation focuses purely on dietary restriction + variety interaction.
 */
function buildConstrainedEnvelope(): UserProtocolEnvelope {
  const base = buildGuestEnvelope();
  return {
    ...base,
    userId: TEST_USER_ID,
    dietaryIdentity: ["gluten-free"],
    allergies: ["dairy"],
    procedural: deriveProcedureRules(["gluten-free"]),
  };
}

// ── Variety block (mirrors groceryCoach.ts logic exactly) ─────────────────────
function buildVarietyBlock(
  dbHistory: Array<{
    mealName: string;
    primaryProtein: string | null;
    cuisineStyle: string | null;
    majorStarch: string | null;
    cookingMethod: string | null;
  }>
): string {
  if (dbHistory.length === 0) return "";

  const avoidList = dbHistory
    .slice(0, 20)
    .map((e) => `- ${e.mealName}`)
    .join("\n");

  const recentPatterns = dbHistory
    .slice(0, 5)
    .map((e) => {
      const dims = [
        e.primaryProtein,
        e.cuisineStyle,
        e.majorStarch,
        e.cookingMethod,
      ].filter(Boolean);
      return dims.length
        ? `- ${e.mealName} (${dims.join(", ")})`
        : `- ${e.mealName}`;
    })
    .join("\n");

  return `

VARIETY RULES:
- NEVER recommend a meal whose name or core structure matches anything in the PREVIOUSLY RECOMMENDED list below.
- Actively rotate: protein type, cuisine/regional style, major starch, and cooking method. If recent meals all used chicken, pick a different protein. If they all used Italian style, try another cuisine.
- If the user explicitly names a food they want (e.g. "I want chicken pasta again"), honour that — explicit intent overrides variety.

PREVIOUSLY RECOMMENDED — DO NOT REPEAT:
${avoidList}${recentPatterns ? `\n\nRECENT PATTERNS TO ROTATE AWAY FROM:\n${recentPatterns}` : ""}`;
}

// ── DB history helpers (mirror the route exactly) ─────────────────────────────
async function loadHistory(): Promise<
  Array<{
    mealName: string;
    primaryProtein: string | null;
    cuisineStyle: string | null;
    majorStarch: string | null;
    cookingMethod: string | null;
  }>
> {
  const rows = await db.execute(sql`
    SELECT meal_name, primary_protein, cuisine_style, major_starch, cooking_method
    FROM grocery_coach_recommendation_history
    WHERE user_id = ${TEST_USER_ID}
    ORDER BY created_at DESC
    LIMIT 20
  `);
  return (rows.rows as any[]).map((r: any) => ({
    mealName: r.meal_name,
    primaryProtein: r.primary_protein ?? null,
    cuisineStyle: r.cuisine_style ?? null,
    majorStarch: r.major_starch ?? null,
    cookingMethod: r.cooking_method ?? null,
  }));
}

async function saveHistory(mealName: string, meta: VarietyMeta): Promise<void> {
  await db.execute(sql`
    INSERT INTO grocery_coach_recommendation_history
      (user_id, meal_name, primary_protein, cuisine_style, major_starch, cooking_method)
    VALUES
      (${TEST_USER_ID}, ${mealName}, ${meta.primaryProtein}, ${meta.cuisineStyle},
       ${meta.majorStarch}, ${meta.cookingMethod})
  `);
  // Keep last 20 only (mirrors route behaviour)
  await db.execute(sql`
    DELETE FROM grocery_coach_recommendation_history
    WHERE user_id = ${TEST_USER_ID}
      AND id NOT IN (
        SELECT id FROM grocery_coach_recommendation_history
        WHERE user_id = ${TEST_USER_ID}
        ORDER BY created_at DESC
        LIMIT 20
      )
  `);
}

// ── AI call ───────────────────────────────────────────────────────────────────
async function recommendMeal(
  protocolContext: string,
  varietyBlock: string
): Promise<{ name: string; meta: VarietyMeta; rawResult: any } | null> {
  const constraintLabel = CONSTRAINED_MODE
    ? "Gluten-free + dairy-free protocol active — see constraints below."
    : "No dietary restrictions or conditions on file — apply general healthy eating principles.";

  const systemPrompt = `You are a Grocery Store Coach — a real, confident nutrition coach who helps users decide exactly what to make for dinner and what to buy at the grocery store.

Your mission: turn "I don't know what to eat" into "Here is exactly what to buy, how much to buy, and why it fits your goals."

USER HEALTH PROFILE AND CONSTRAINTS:
${protocolContext || constraintLabel}${varietyBlock}

SERVING SIZE: All ingredient quantities must be scaled for 1 person.

COACHING RULES:
- Recommend ONE specific, confident meal (may have 2-3 components, e.g., protein + starch + vegetable).
- The shopping list must be practical and grocery-store ready.
- Never include ingredients the user is allergic to or that violate their dietary protocol.
- Be concise, warm, and coach-like — not clinical, not robotic.

Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{
  "meal": {
    "name": "string",
    "description": "string — 1-2 sentences",
    "prepTime": "string",
    "servings": number
  },
  "reasoning": ["string"],
  "macros": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "ownedIngredients": [],
  "shoppingList": [
    { "item": "string", "quantity": "string", "unit": "string", "category": "string" }
  ],
  "followUpSuggestions": ["string"],
  "varietyMetadata": {
    "primaryProtein": "string — main protein source (e.g. 'chicken', 'tofu', 'salmon', 'beef', 'lentils')",
    "cuisineStyle": "string — cuisine or regional style (e.g. 'Italian', 'Asian', 'Mediterranean', 'American', 'Mexican')",
    "majorStarch": "string — primary starch or carb (e.g. 'rice', 'quinoa', 'potato', 'none')",
    "cookingMethod": "string — dominant cooking method (e.g. 'stir-fry', 'baked', 'grilled', 'raw', 'slow-cooked', 'sautéed')"
  }
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: MEAL_REQUEST },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
    max_tokens: 900,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: any;
  try {
    result = JSON.parse(raw);
  } catch {
    console.error("  ❌ Failed to parse JSON response");
    return null;
  }

  const name = result?.meal?.name;
  const vm = result?.varietyMetadata;
  if (!name || !vm) {
    console.error("  ❌ Missing meal.name or varietyMetadata in response");
    return null;
  }

  return {
    name,
    meta: {
      primaryProtein: vm.primaryProtein ?? "unknown",
      cuisineStyle: vm.cuisineStyle ?? "unknown",
      majorStarch: vm.majorStarch ?? "unknown",
      cookingMethod: vm.cookingMethod ?? "unknown",
    },
    rawResult: result,
  };
}

// ── Results analysis ──────────────────────────────────────────────────────────
function analyzeResults(rounds: Round[]): boolean {
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(70));

  // Table header
  console.log(
    `${"#".padEnd(3)} ${"Meal Name".padEnd(38)} ${"Protein".padEnd(12)} ${"Cuisine".padEnd(14)} ${"Starch".padEnd(12)} ${"Method".padEnd(12)} ${"Scan".padEnd(5)}`
  );
  console.log("-".repeat(101));
  for (const r of rounds) {
    const scanIcon = r.scanPassed ? "✅" : "❌";
    console.log(
      `${String(r.round).padEnd(3)} ${r.mealName.slice(0, 37).padEnd(38)} ${r.meta.primaryProtein.slice(0, 11).padEnd(12)} ${r.meta.cuisineStyle.slice(0, 13).padEnd(14)} ${r.meta.majorStarch.slice(0, 11).padEnd(12)} ${r.meta.cookingMethod.slice(0, 11).padEnd(12)} ${scanIcon}`
    );
    if (!r.scanPassed && r.scanViolations.length > 0) {
      for (const v of r.scanViolations) {
        console.log(`     ⚠️  Violation: ${v}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("VARIETY ANALYSIS");
  console.log("=".repeat(70));

  // 1. Consecutive protein+cuisine collisions
  let consecutiveCollisions = 0;
  for (let i = 1; i < rounds.length; i++) {
    const prev = rounds[i - 1].meta;
    const curr = rounds[i].meta;
    if (
      prev.primaryProtein.toLowerCase() === curr.primaryProtein.toLowerCase() &&
      prev.cuisineStyle.toLowerCase() === curr.cuisineStyle.toLowerCase()
    ) {
      console.warn(
        `  ⚠️  Rounds ${i} → ${i + 1}: same protein+cuisine (${curr.primaryProtein}, ${curr.cuisineStyle})`
      );
      consecutiveCollisions++;
    }
  }
  if (consecutiveCollisions === 0) {
    console.log("  ✅ No consecutive protein+cuisine collisions");
  }

  // 2. Unique proteins
  const proteins = rounds.map((r) => r.meta.primaryProtein.toLowerCase());
  const uniqueProteins = new Set(proteins);
  console.log(`  Unique proteins     : ${uniqueProteins.size}/10 — [${[...uniqueProteins].join(", ")}]`);
  if (uniqueProteins.size >= 4) {
    console.log("  ✅ Protein variety good (≥ 4 different proteins)");
  } else {
    console.warn(`  ⚠️  Only ${uniqueProteins.size} distinct proteins across 10 rounds`);
  }

  // 3. Unique cuisines
  const cuisines = rounds.map((r) => r.meta.cuisineStyle.toLowerCase());
  const uniqueCuisines = new Set(cuisines);
  console.log(`  Unique cuisines     : ${uniqueCuisines.size}/10 — [${[...uniqueCuisines].join(", ")}]`);
  if (uniqueCuisines.size >= 4) {
    console.log("  ✅ Cuisine variety good (≥ 4 different cuisines)");
  } else {
    console.warn(`  ⚠️  Only ${uniqueCuisines.size} distinct cuisines across 10 rounds`);
  }

  // 4. Unique starches
  const starches = rounds.map((r) => r.meta.majorStarch.toLowerCase());
  const uniqueStarches = new Set(starches);
  console.log(`  Unique starches     : ${uniqueStarches.size}/10 — [${[...uniqueStarches].join(", ")}]`);

  // 5. Unique cooking methods
  const methods = rounds.map((r) => r.meta.cookingMethod.toLowerCase());
  const uniqueMethods = new Set(methods);
  console.log(`  Unique cook methods : ${uniqueMethods.size}/10 — [${[...uniqueMethods].join(", ")}]`);

  // 6. Unique meal names
  const names = rounds.map((r) => r.mealName.toLowerCase());
  const uniqueNames = new Set(names);
  console.log(`  Unique meal names   : ${uniqueNames.size}/10`);
  if (uniqueNames.size === 10) {
    console.log("  ✅ All 10 meal names are distinct");
  } else {
    console.warn(`  ⚠️  Only ${uniqueNames.size} distinct meal names`);
  }

  // 7. Protocol scan pass rate (constrained mode only)
  const scansPassed = rounds.filter((r) => r.scanPassed).length;
  const scansTotal = rounds.length;
  console.log(`\n  Protocol scan rate  : ${scansPassed}/${scansTotal} passed`);
  if (scansPassed === scansTotal) {
    console.log("  ✅ 100% scan pass rate — no protocol violations across all rounds");
  } else {
    const failedRounds = rounds.filter((r) => !r.scanPassed).map((r) => r.round);
    console.warn(`  ❌ Scan failures in round(s): ${failedRounds.join(", ")}`);
  }

  // Overall verdict
  console.log("\n" + "=".repeat(70));
  const passed =
    consecutiveCollisions === 0 &&
    uniqueProteins.size >= 4 &&
    uniqueCuisines.size >= 4 &&
    uniqueNames.size >= 9 &&
    scansPassed === scansTotal;

  if (passed) {
    console.log("🎉 VERDICT: PASS — variety enforcement is working correctly.");
    if (CONSTRAINED_MODE) {
      console.log("   Constrained pool (gluten-free + dairy-free) maintained full variety");
      console.log("   AND 100% protocol compliance across all 10 rounds.");
    }
  } else {
    console.log("❌ VERDICT: FAIL — variety enforcement needs investigation.");
    if (scansPassed < scansTotal) {
      console.log("   One or more rounds had protocol violations (gluten/dairy ingredients returned).");
    }
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  return passed;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("=".repeat(70));
  if (CONSTRAINED_MODE) {
    console.log("Grocery Coach Variety Verification — Task 895 (Constrained)");
    console.log("Constraints : gluten-free + dairy-free protocol active");
    console.log("Validates   : variety rotation AND 100% scanGeneratedOutput pass rate");
  } else {
    console.log("Grocery Coach Variety Verification — Task 892 (Baseline)");
    console.log("Constraints : none (wide-open meal pool)");
  }
  console.log(`User ID  : ${TEST_USER_ID}`);
  console.log(`Request  : "${MEAL_REQUEST}" × ${ROUNDS} rounds`);
  console.log("=".repeat(70));

  // Build the protocol envelope for this run
  const envelope: UserProtocolEnvelope = CONSTRAINED_MODE
    ? buildConstrainedEnvelope()
    : buildGuestEnvelope();

  // Build protocol context block from the envelope (mirrors groceryCoach.ts)
  const { combined: protocolContext } = CONSTRAINED_MODE
    ? enforceBeforeGenerate(envelope, { generatorName: "verify_variety_895" })
    : { combined: "" };

  if (CONSTRAINED_MODE) {
    console.log("\nProtocol context injected into every prompt:");
    console.log(protocolContext.slice(0, 500) + (protocolContext.length > 500 ? "…" : ""));
    console.log();
  }

  // Clear any leftover history from previous runs
  await db.execute(sql`
    DELETE FROM grocery_coach_recommendation_history WHERE user_id = ${TEST_USER_ID}
  `);
  console.log("✓ Cleared prior history for test user\n");

  const rounds: Round[] = [];

  for (let i = 1; i <= ROUNDS; i++) {
    process.stdout.write(`Round ${i}/${ROUNDS} — loading history...`);
    const history = await loadHistory();
    const varietyBlock = buildVarietyBlock(history);
    process.stdout.write(` (${history.length} prior entries) — calling AI...`);

    const result = await recommendMeal(protocolContext, varietyBlock);
    if (!result) {
      console.error(`\nRound ${i} failed — aborting.`);
      process.exit(1);
    }

    // ── Post-generation protocol scan (mirrors groceryCoach.ts) ──────────────
    const mealForScan = {
      name: result.rawResult?.meal?.name ?? result.name,
      description: result.rawResult?.meal?.description,
      ingredients: [
        ...(result.rawResult?.shoppingList ?? []).map((x: any) => ({ name: x.item ?? "" })),
        ...(result.rawResult?.ownedIngredients ?? []).map((x: any) => ({ name: x.item ?? "" })),
      ],
    };

    const scan = scanGeneratedOutput(mealForScan, envelope, {
      generatorName: "verify_variety_895",
      skipAdaptableConflicts: true,
    });

    const scanViolations = [
      ...scan.violations.map((v: any) => `[ingredient] ${v.term ?? v.reason ?? String(v)}`),
      ...scan.instructionViolations.map((v: any) => `[instruction] ${String(v)}`),
    ];

    await saveHistory(result.name, result.meta);

    const scanIcon = scan.passed ? "✅ scan:pass" : "❌ scan:FAIL";
    console.log(` ✓`);
    console.log(`  Meal    : ${result.name}`);
    console.log(`  Protein : ${result.meta.primaryProtein}  |  Cuisine: ${result.meta.cuisineStyle}  |  Starch: ${result.meta.majorStarch}  |  Method: ${result.meta.cookingMethod}`);
    console.log(`  ${scanIcon}`);
    if (!scan.passed) {
      for (const v of scanViolations) {
        console.log(`  ⚠️  ${v}`);
      }
    }

    rounds.push({
      round: i,
      mealName: result.name,
      meta: result.meta,
      scanPassed: scan.passed,
      scanViolations,
    });
  }

  analyzeResults(rounds);

  // Verify DB state
  const finalCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM grocery_coach_recommendation_history WHERE user_id = ${TEST_USER_ID}
  `);
  const cnt = (finalCount.rows[0] as any)?.cnt;
  console.log(`DB check: grocery_coach_recommendation_history has ${cnt} rows for test user ✓`);

  // Cleanup
  await db.execute(sql`
    DELETE FROM grocery_coach_recommendation_history WHERE user_id = ${TEST_USER_ID}
  `);
  console.log("Cleaned up test rows.\n");

  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
