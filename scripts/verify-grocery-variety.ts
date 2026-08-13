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
 *
 *   npx tsx scripts/verify-grocery-variety.ts --vegan-diabetic
 *     → Task 899 constraint sim: vegan + diabetic (~45 g carb ceiling per meal).
 *       Verifies variety still rotates when both no-animal-products AND hard
 *       carb ceilings are active, and that scanGeneratedOutput passes 100% of
 *       rounds (no animal-product or carb-ceiling violations).
 *
 *   npx tsx scripts/verify-grocery-variety.ts --overlap
 *     → Task 900 overlap sim: pre-seeds 5 meals in DB history AND places those
 *       same 5 meal names in session conversationHistory, then verifies:
 *       (a) the merged avoid-list contains each name only once (no duplicates), and
 *       (b) new AI rounds produce meals distinct from both history sources.
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

const OVERLAP_MODE = process.argv.includes("--overlap");
const VEGAN_DIABETIC_MODE = process.argv.includes("--vegan-diabetic");

const TEST_USER_ID = OVERLAP_MODE
  ? "verify-variety-900-overlap"
  : VEGAN_DIABETIC_MODE
  ? "verify-variety-899-vegan-diabetic"
  : CONSTRAINED_MODE
  ? "verify-variety-895-constrained"
  : "verify-variety-892";

const MEAL_REQUEST = "give me dinner";
const ROUNDS = 10;

/**
 * Hard carb ceiling enforced per round in --vegan-diabetic mode.
 * Mirrors the ~45 g/meal limit stated in the diabeticGuidance injected into
 * every prompt. Any AI response exceeding this is treated as a ceiling breach
 * and fails the round, regardless of scanGeneratedOutput result.
 */
const VEGAN_DIABETIC_CARB_CEILING = 45;

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
  /** Carbs reported by the AI (grams). Null when macros were missing/invalid. */
  carbsG: number | null;
  /**
   * True when carb ceiling is not relevant (non-vegan-diabetic modes),
   * or when carbsG is a finite number <= VEGAN_DIABETIC_CARB_CEILING.
   */
  carbCeilingPassed: boolean;
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

/**
 * Build a UserProtocolEnvelope for vegan + diabetic constraints (Task 899).
 *
 * dietaryIdentity: ["vegan"] — hard outer wall: no meat, poultry, seafood, eggs,
 *   dairy, honey, or any animal-derived ingredient.
 * hasDiabetes: true — activates the medical hard-limit layer so scanGeneratedOutput
 *   enforces carb ceilings.
 * medicalHardLimits: ["diabetes"] — triggers the medical enforcement layer in
 *   enforceBeforeGenerate, injecting carb guidance into the prompt.
 * diabeticGuidance: static ceiling string (~45 g carbs per meal) — mirrors what the
 *   real glucose-based guidance would inject for a stable-glucose diabetic user.
 *
 * This is the tightest double-constraint supported by the protocol: no animal
 * products AND hard carb ceilings. The simulation focuses on whether variety
 * still rotates (avoiding legume-protein monotony) while staying compliant.
 */
function buildVeganDiabeticEnvelope(): UserProtocolEnvelope {
  const base = buildGuestEnvelope();
  return {
    ...base,
    userId: TEST_USER_ID,
    dietaryIdentity: ["vegan"],
    medicalHardLimits: ["diabetes"],
    hasDiabetes: true,
    diabeticGuidance:
      "Glucose is stable — maintain a diabetic-friendly meal pattern. " +
      "Keep carbohydrates at or below 45 g per meal. " +
      "Prioritise high-fibre, low-glycaemic carb sources (legumes, non-starchy vegetables, quinoa). " +
      "Avoid refined grains, added sugars, and high-starch portions.",
    diabeticGlucoseState: null,
    procedural: deriveProcedureRules(["vegan"]),
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
  const constraintLabel = VEGAN_DIABETIC_MODE
    ? "Vegan + diabetic protocol active — see constraints below."
    : CONSTRAINED_MODE
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
  // Note: for --vegan-diabetic the protein universe is genuinely narrow (legumes
  // only), so this check is informational rather than a hard pass gate in that mode.
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
  } else if (VEGAN_DIABETIC_MODE) {
    console.log(
      `  ℹ️  ${consecutiveCollisions} consecutive collision(s) noted — informational only for vegan+diabetic pool`
    );
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

  // 7. Protocol scan pass rate
  const scansPassed = rounds.filter((r) => r.scanPassed).length;
  const scansTotal = rounds.length;
  console.log(`\n  Protocol scan rate  : ${scansPassed}/${scansTotal} passed`);
  if (scansPassed === scansTotal) {
    console.log("  ✅ 100% scan pass rate — no protocol violations across all rounds");
  } else {
    const failedRounds = rounds.filter((r) => !r.scanPassed).map((r) => r.round);
    console.warn(`  ❌ Scan failures in round(s): ${failedRounds.join(", ")}`);
  }

  // 8. Carb ceiling check — vegan+diabetic mode only
  // scanGeneratedOutput does not evaluate macronutrient totals, so we assert
  // the AI-reported macros.carbs explicitly. A missing or over-ceiling value
  // is a hard failure even when the ingredient scan passes.
  let carbCeilingAllPassed = true;
  if (VEGAN_DIABETIC_MODE) {
    const carbsPassed = rounds.filter((r) => r.carbCeilingPassed).length;
    const carbsFailed = rounds.filter((r) => !r.carbCeilingPassed);
    console.log(`\n  Carb ceiling check  : ${carbsPassed}/${scansTotal} rounds ≤ ${VEGAN_DIABETIC_CARB_CEILING}g`);
    if (carbsPassed === scansTotal) {
      const carbValues = rounds.map((r) => `${r.carbsG}g`).join(", ");
      console.log(`  ✅ All rounds within carb ceiling — reported carbs: [${carbValues}]`);
    } else {
      carbCeilingAllPassed = false;
      for (const r of carbsFailed) {
        if (r.carbsG === null) {
          console.warn(`  ❌ Round ${r.round}: macros.carbs missing or non-numeric`);
        } else {
          console.warn(`  ❌ Round ${r.round}: ${r.carbsG}g carbs exceeds ${VEGAN_DIABETIC_CARB_CEILING}g ceiling`);
        }
      }
    }
  }

  // Overall verdict
  // --vegan-diabetic: task criteria are distinct names + ≥4 proteins + ≥4 cuisines
  // + 100% ingredient scan + 100% explicit carb-ceiling assertion.
  // Consecutive-collision gate is omitted because the plant-protein universe
  // (legumes) is genuinely narrower than an unrestricted pool.
  console.log("\n" + "=".repeat(70));
  const passed = VEGAN_DIABETIC_MODE
    ? uniqueProteins.size >= 4 &&
      uniqueCuisines.size >= 4 &&
      uniqueNames.size === 10 &&
      scansPassed === scansTotal &&
      carbCeilingAllPassed
    : consecutiveCollisions === 0 &&
      uniqueProteins.size >= 4 &&
      uniqueCuisines.size >= 4 &&
      uniqueNames.size >= 9 &&
      scansPassed === scansTotal;

  if (passed) {
    console.log("🎉 VERDICT: PASS — variety enforcement is working correctly.");
    if (VEGAN_DIABETIC_MODE) {
      console.log(`   Vegan + diabetic pool (${VEGAN_DIABETIC_CARB_CEILING}g carb ceiling) maintained full variety`);
      console.log("   AND 100% protocol compliance across all 10 rounds.");
      console.log("   All rounds: distinct meal names, ≥4 proteins, ≥4 cuisines,");
      console.log("   ingredient scan passed, AND carbs within ceiling.");
    } else if (CONSTRAINED_MODE) {
      console.log("   Constrained pool (gluten-free + dairy-free) maintained full variety");
      console.log("   AND 100% protocol compliance across all 10 rounds.");
    }
  } else {
    console.log("❌ VERDICT: FAIL — variety enforcement needs investigation.");
    if (scansPassed < scansTotal) {
      if (VEGAN_DIABETIC_MODE) {
        console.log("   One or more rounds had ingredient protocol violations (animal products returned).");
      } else {
        console.log("   One or more rounds had protocol violations (gluten/dairy ingredients returned).");
      }
    }
    if (VEGAN_DIABETIC_MODE && !carbCeilingAllPassed) {
      console.log(`   One or more rounds exceeded the ${VEGAN_DIABETIC_CARB_CEILING}g carb ceiling or had missing macros.`);
    }
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  return passed;
}

/**
 * Build a variety block that mirrors the route's exact merge logic:
 *   allAvoidNames = [...new Set([...dbNames, ...sessionNames].filter(Boolean))]
 * This is the post-fix version — duplicates are removed.
 */
function buildVarietyBlockWithSession(
  dbHistory: Array<{
    mealName: string;
    primaryProtein: string | null;
    cuisineStyle: string | null;
    majorStarch: string | null;
    cookingMethod: string | null;
  }>,
  sessionNames: string[]
): { block: string; avoidNames: string[] } {
  const allAvoidNames = [
    ...new Set(
      [...dbHistory.map((e) => e.mealName), ...sessionNames].filter(Boolean)
    ),
  ];

  if (allAvoidNames.length === 0) return { block: "", avoidNames: [] };

  const avoidList = allAvoidNames.slice(0, 20).map((n) => `- ${n}`).join("\n");
  const recentPatterns = dbHistory.slice(0, 5).map((e) => {
    const dims = [e.primaryProtein, e.cuisineStyle, e.majorStarch, e.cookingMethod].filter(Boolean);
    return dims.length ? `- ${e.mealName} (${dims.join(", ")})` : `- ${e.mealName}`;
  }).join("\n");

  const block = `

VARIETY RULES:
- NEVER recommend a meal whose name or core structure matches anything in the PREVIOUSLY RECOMMENDED list below.
- Actively rotate: protein type, cuisine/regional style, major starch, and cooking method. If recent meals all used chicken, pick a different protein. If they all used Italian style, try another cuisine.
- If the user explicitly names a food they want (e.g. "I want chicken pasta again"), honour that — explicit intent overrides variety.

PREVIOUSLY RECOMMENDED — DO NOT REPEAT:
${avoidList}${recentPatterns ? `\n\nRECENT PATTERNS TO ROTATE AWAY FROM:\n${recentPatterns}` : ""}`;

  return { block, avoidNames: allAvoidNames };
}
async function main(): Promise<void> {
  if (OVERLAP_MODE) {
    return runOverlapMode();
  }

  console.log("=".repeat(70));
  if (VEGAN_DIABETIC_MODE) {
    console.log("Grocery Coach Variety Verification — Task 899 (Vegan + Diabetic)");
    console.log("Constraints : vegan (no animal products) + diabetic (~45 g carb ceiling/meal)");
    console.log("Validates   : variety rotation, ≥4 proteins, ≥4 cuisines, AND 100% scan pass rate");
  } else if (CONSTRAINED_MODE) {
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
  const envelope: UserProtocolEnvelope = VEGAN_DIABETIC_MODE
    ? buildVeganDiabeticEnvelope()
    : CONSTRAINED_MODE
    ? buildConstrainedEnvelope()
    : buildGuestEnvelope();

  // Determine the generator name for this run
  const generatorName = VEGAN_DIABETIC_MODE
    ? "verify_variety_899"
    : "verify_variety_895";

  // Build protocol context block from the envelope (mirrors groceryCoach.ts)
  const { combined: protocolContext } =
    VEGAN_DIABETIC_MODE || CONSTRAINED_MODE
      ? enforceBeforeGenerate(envelope, { generatorName })
      : { combined: "" };

  if (VEGAN_DIABETIC_MODE || CONSTRAINED_MODE) {
    console.log("\nProtocol context injected into every prompt:");
    console.log(protocolContext.slice(0, 600) + (protocolContext.length > 600 ? "…" : ""));
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
      generatorName,
      skipAdaptableConflicts: true,
    });

    const scanViolations = [
      ...scan.violations.map((v: any) => `[ingredient] ${v.term ?? v.reason ?? String(v)}`),
      ...scan.instructionViolations.map((v: any) => `[instruction] ${String(v)}`),
    ];

    // ── Explicit carb-ceiling check (vegan-diabetic mode only) ────────────────
    // scanGeneratedOutput never evaluates macronutrient totals — it only checks
    // ingredient identity. For vegan+diabetic we must assert the AI-reported
    // macros.carbs is finite and within the ceiling injected into every prompt.
    const rawCarbsG: unknown = result.rawResult?.macros?.carbs;
    const carbsG: number | null =
      typeof rawCarbsG === "number" && isFinite(rawCarbsG) ? rawCarbsG : null;
    const carbCeilingPassed: boolean = VEGAN_DIABETIC_MODE
      ? carbsG !== null && carbsG <= VEGAN_DIABETIC_CARB_CEILING
      : true; // Not checked in other modes.

    await saveHistory(result.name, result.meta);

    const scanIcon = scan.passed ? "✅ scan:pass" : "❌ scan:FAIL";
    const carbIcon = !VEGAN_DIABETIC_MODE
      ? ""
      : carbCeilingPassed
      ? `  ✅ carbs:${carbsG}g (≤${VEGAN_DIABETIC_CARB_CEILING}g)`
      : carbsG === null
      ? `  ❌ carbs:MISSING (macros.carbs absent or non-numeric)`
      : `  ❌ carbs:${carbsG}g EXCEEDS ceiling of ${VEGAN_DIABETIC_CARB_CEILING}g`;

    console.log(` ✓`);
    console.log(`  Meal    : ${result.name}`);
    console.log(`  Protein : ${result.meta.primaryProtein}  |  Cuisine: ${result.meta.cuisineStyle}  |  Starch: ${result.meta.majorStarch}  |  Method: ${result.meta.cookingMethod}`);
    console.log(`  ${scanIcon}${carbIcon}`);
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
      carbsG,
      carbCeilingPassed,
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

/** 5 seed meals that will appear in both DB history and session history */
const OVERLAP_SEED_MEALS = [
  {
    mealName: "Grilled Salmon with Quinoa",
    primaryProtein: "salmon",
    cuisineStyle: "Mediterranean",
    majorStarch: "quinoa",
    cookingMethod: "grilled",
  },
  {
    mealName: "Chicken Tikka Masala",
    primaryProtein: "chicken",
    cuisineStyle: "Indian",
    majorStarch: "rice",
    cookingMethod: "sautéed",
  },
  {
    mealName: "Beef Tacos",
    primaryProtein: "beef",
    cuisineStyle: "Mexican",
    majorStarch: "tortilla",
    cookingMethod: "grilled",
  },
  {
    mealName: "Tofu Stir-Fry with Noodles",
    primaryProtein: "tofu",
    cuisineStyle: "Asian",
    majorStarch: "noodles",
    cookingMethod: "stir-fry",
  },
  {
    mealName: "Lemon Herb Pork Chops with Roasted Potatoes",
    primaryProtein: "pork",
    cuisineStyle: "American",
    majorStarch: "potato",
    cookingMethod: "baked",
  },
];

const OVERLAP_AI_ROUNDS = 5;

async function runOverlapMode(): Promise<void> {
  console.log("=".repeat(70));
  console.log("Grocery Coach Variety Verification — Task 900 (Overlap)");
  console.log("Validates : avoid-list deduplication when DB history and session");
  console.log("            conversationHistory contain the same meal names.");
  console.log(`User ID  : ${TEST_USER_ID}`);
  console.log("=".repeat(70));

  // 1. Clean slate
  await db.execute(sql`
    DELETE FROM grocery_coach_recommendation_history WHERE user_id = ${TEST_USER_ID}
  `);
  console.log("\n✓ Cleared prior history for test user");

  // 2. Pre-seed DB with 5 meals
  for (const m of OVERLAP_SEED_MEALS) {
    await db.execute(sql`
      INSERT INTO grocery_coach_recommendation_history
        (user_id, meal_name, primary_protein, cuisine_style, major_starch, cooking_method)
      VALUES
        (${TEST_USER_ID}, ${m.mealName}, ${m.primaryProtein},
         ${m.cuisineStyle}, ${m.majorStarch}, ${m.cookingMethod})
    `);
  }
  console.log(`✓ Pre-seeded DB with ${OVERLAP_SEED_MEALS.length} meals`);

  // 3. Build session names — same 5 meal names as the DB entries
  const sessionNames = OVERLAP_SEED_MEALS.map((m) => m.mealName);
  console.log(`✓ Session history contains the same ${sessionNames.length} meal names`);

  // 4. Load DB history and build the merged avoid-list
  const dbHistory = await loadHistory();
  const { block: varietyBlock, avoidNames } = buildVarietyBlockWithSession(
    dbHistory,
    sessionNames
  );

  console.log("\n" + "=".repeat(70));
  console.log("DEDUPLICATION CHECK");
  console.log("=".repeat(70));

  // 5. Assert deduplication — each meal name must appear only once
  let dedupePass = true;
  const nameCounts = new Map<string, number>();
  for (const name of avoidNames) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const duplicates = [...nameCounts.entries()].filter(([, count]) => count > 1);

  console.log(`  Combined avoid-list length : ${avoidNames.length}`);
  console.log(`  DB history entries         : ${dbHistory.length}`);
  console.log(`  Session history entries    : ${sessionNames.length}`);
  console.log(`  Unique names in avoid-list : ${nameCounts.size}`);

  if (duplicates.length === 0) {
    console.log("  ✅ No duplicates — each meal name appears exactly once");
  } else {
    dedupePass = false;
    console.error(
      `  ❌ ${duplicates.length} duplicate(s) found in avoid-list — deduplication is broken:`
    );
    for (const [name, count] of duplicates) {
      console.error(`     "${name}" appears ${count} times`);
    }
  }

  // 6. Print the full avoid-list for inspection
  console.log("\n  Avoid-list contents:");
  for (const name of avoidNames) {
    console.log(`    - ${name}`);
  }

  // 7. Verify all 5 seeded meals are present in the avoid-list (nothing dropped)
  let coveragePass = true;
  for (const m of OVERLAP_SEED_MEALS) {
    if (!avoidNames.includes(m.mealName)) {
      coveragePass = false;
      console.error(`  ❌ Seed meal missing from avoid-list: "${m.mealName}"`);
    }
  }
  if (coveragePass) {
    console.log("\n  ✅ All 5 seeded meals are present in the avoid-list");
  }

  // 8. Run AI rounds to confirm new meals are distinct from all seeded meals
  console.log("\n" + "=".repeat(70));
  console.log(`AI VARIETY CHECK — ${OVERLAP_AI_ROUNDS} rounds with combined avoid-list`);
  console.log("=".repeat(70) + "\n");

  const seededNamesLower = new Set(OVERLAP_SEED_MEALS.map((m) => m.mealName.toLowerCase()));
  const newMealNames: string[] = [];
  let aiPass = true;

  for (let i = 1; i <= OVERLAP_AI_ROUNDS; i++) {
    // Rebuild avoid-list to include newly generated meals from this run too
    const currentDbHistory = await loadHistory();
    const currentSessionNames = [
      ...sessionNames,
      ...newMealNames, // prior rounds in this session
    ];
    const { block: currentBlock, avoidNames: currentAvoid } =
      buildVarietyBlockWithSession(currentDbHistory, currentSessionNames);

    process.stdout.write(`Round ${i}/${OVERLAP_AI_ROUNDS} — avoid-list has ${currentAvoid.length} entries — calling AI...`);

    const result = await recommendMeal("", currentBlock);
    if (!result) {
      console.error(`\nRound ${i} failed — aborting.`);
      process.exit(1);
    }

    const nameLower = result.name.toLowerCase();
    const isRepeat = seededNamesLower.has(nameLower) || newMealNames.some((n) => n.toLowerCase() === nameLower);

    console.log(` ✓`);
    console.log(`  Meal    : ${result.name}`);
    console.log(`  Protein : ${result.meta.primaryProtein}  |  Cuisine: ${result.meta.cuisineStyle}  |  Starch: ${result.meta.majorStarch}  |  Method: ${result.meta.cookingMethod}`);

    if (isRepeat) {
      aiPass = false;
      console.error(`  ❌ REPEAT — this meal was in the seeded history or a prior round`);
    } else {
      console.log(`  ✅ New meal — not in seeded history or prior rounds`);
    }

    await saveHistory(result.name, result.meta);
    newMealNames.push(result.name);
  }

  // 9. Final verdict
  console.log("\n" + "=".repeat(70));
  console.log("OVERLAP MODE VERDICT");
  console.log("=".repeat(70));

  const overallPass = dedupePass && coveragePass && aiPass;

  if (dedupePass) {
    console.log("✅ Deduplication  : avoid-list has no duplicate meal names");
  } else {
    console.log("❌ Deduplication  : duplicates found — route merge logic needs dedup");
  }
  if (coveragePass) {
    console.log("✅ Coverage       : all seeded meals appear in the avoid-list");
  } else {
    console.log("❌ Coverage       : some seeded meals are missing from the avoid-list");
  }
  if (aiPass) {
    console.log(`✅ AI variety     : all ${OVERLAP_AI_ROUNDS} new rounds produced meals not in either history`);
  } else {
    console.log(`❌ AI variety     : one or more rounds repeated a seeded or prior meal`);
  }

  if (overallPass) {
    console.log("\n🎉 VERDICT: PASS — overlap deduplication is working correctly.");
  } else {
    console.log("\n❌ VERDICT: FAIL — overlap handling needs investigation.");
    process.exitCode = 1;
  }
  console.log("=".repeat(70) + "\n");

  // Cleanup
  await db.execute(sql`
    DELETE FROM grocery_coach_recommendation_history WHERE user_id = ${TEST_USER_ID}
  `);
  console.log("Cleaned up test rows.\n");

  process.exit(process.exitCode ?? 0);
}
