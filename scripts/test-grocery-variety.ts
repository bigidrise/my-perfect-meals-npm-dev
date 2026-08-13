/**
 * Grocery Coach Variety Proof
 * ───────────────────────────
 * Runs 10 generic dinner requests for a synthetic test user, accumulating
 * history in grocery_coach_recommendation_history between each call exactly
 * as the live route does. Then runs one explicit-intent override test.
 *
 * Usage:  npx tsx scripts/test-grocery-variety.ts
 */

import "dotenv/config";
import OpenAI from "openai";
import { Pool } from "pg";
import { sql as drizzleSql, neon } from "drizzle-orm";

// ─── DB (same connection string the app uses) ────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function dbQuery(text: string, values?: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Synthetic test user ──────────────────────────────────────────────────────
const TEST_USER_ID = "variety-proof-test-user-001";

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function clearHistory() {
  await dbQuery(
    "DELETE FROM grocery_coach_recommendation_history WHERE user_id = $1",
    [TEST_USER_ID]
  );
}

async function loadHistory() {
  const r = await dbQuery(
    `SELECT meal_name, primary_protein, cuisine_style, major_starch, cooking_method
       FROM grocery_coach_recommendation_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20`,
    [TEST_USER_ID]
  );
  return r.rows as Array<{
    meal_name: string;
    primary_protein: string | null;
    cuisine_style: string | null;
    major_starch: string | null;
    cooking_method: string | null;
  }>;
}

async function saveToHistory(
  mealName: string,
  vm: { primaryProtein?: string; cuisineStyle?: string; majorStarch?: string; cookingMethod?: string }
) {
  await dbQuery(
    `INSERT INTO grocery_coach_recommendation_history
       (user_id, meal_name, primary_protein, cuisine_style, major_starch, cooking_method)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [TEST_USER_ID, mealName, vm.primaryProtein ?? null, vm.cuisineStyle ?? null, vm.majorStarch ?? null, vm.cookingMethod ?? null]
  );
  // Prune to 20
  await dbQuery(
    `DELETE FROM grocery_coach_recommendation_history
      WHERE user_id = $1
        AND id NOT IN (
          SELECT id FROM grocery_coach_recommendation_history
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 20
        )`,
    [TEST_USER_ID]
  );
}

function buildVarietyBlock(
  dbHistory: Awaited<ReturnType<typeof loadHistory>>,
  sessionNames: string[]
): string {
  const allAvoidNames = [
    ...dbHistory.map((e) => e.meal_name),
    ...sessionNames,
  ].filter(Boolean);

  if (allAvoidNames.length === 0) return "";

  const avoidList = allAvoidNames.slice(0, 20).map((n) => `- ${n}`).join("\n");
  const recentPatterns = dbHistory.slice(0, 5).map((e) => {
    const dims = [e.primary_protein, e.cuisine_style, e.major_starch, e.cooking_method].filter(Boolean);
    return dims.length ? `- ${e.meal_name} (${dims.join(", ")})` : `- ${e.meal_name}`;
  }).join("\n");

  return `

VARIETY RULES:
- NEVER recommend a meal whose name or core structure matches anything in the PREVIOUSLY RECOMMENDED list below.
- Actively rotate: protein type, cuisine/regional style, major starch, and cooking method. If recent meals all used chicken, pick a different protein. If they all used Italian style, try another cuisine.
- If the user explicitly names a food they want (e.g. "I want chicken pasta again"), honour that — explicit intent overrides variety.
- Saved Groceries preferences may still guide product choices inside the new meal; variety applies to the meal structure, not saved product brands.

PREVIOUSLY RECOMMENDED — DO NOT REPEAT:
${avoidList}${recentPatterns ? `\n\nRECENT PATTERNS TO ROTATE AWAY FROM:\n${recentPatterns}` : ""}`;
}

function buildSystemPrompt(varietyBlock: string): string {
  return `You are a Grocery Store Coach — a real, confident nutrition coach who helps users decide exactly what to make for dinner and what to buy at the grocery store.

USER HEALTH PROFILE AND CONSTRAINTS:
No dietary restrictions or conditions on file — apply general healthy eating principles.${varietyBlock}

COACHING RULES:
- Recommend ONE specific, confident dinner meal (protein + starch + vegetable).
- Be concise.

Respond ONLY with valid JSON:
{
  "meal": { "name": "string", "description": "string" },
  "varietyMetadata": {
    "primaryProtein": "string",
    "cuisineStyle": "string",
    "majorStarch": "string",
    "cookingMethod": "string"
  }
}`;
}

async function ask(message: string, varietyBlock: string): Promise<{
  mealName: string;
  primaryProtein: string;
  cuisineStyle: string;
  majorStarch: string;
  cookingMethod: string;
}> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: buildSystemPrompt(varietyBlock) },
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
    temperature: 0.85,
    max_tokens: 400,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const r = JSON.parse(raw);
  const vm = r.varietyMetadata ?? {};

  return {
    mealName: r.meal?.name ?? "(no name)",
    primaryProtein: vm.primaryProtein ?? "—",
    cuisineStyle: vm.cuisineStyle ?? "—",
    majorStarch: vm.majorStarch ?? "—",
    cookingMethod: vm.cookingMethod ?? "—",
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🧪 Grocery Coach — Variety Proof\n");
  console.log("Clearing previous test history...");
  await clearHistory();

  const rows: Array<{
    n: number;
    mealName: string;
    primaryProtein: string;
    cuisineStyle: string;
    majorStarch: string;
    cookingMethod: string;
  }> = [];

  for (let i = 1; i <= 10; i++) {
    process.stdout.write(`  [${i}/10] Asking for dinner...`);

    const dbHistory = await loadHistory();
    const varietyBlock = buildVarietyBlock(dbHistory, []);
    const result = await ask("give me dinner", varietyBlock);

    rows.push({ n: i, ...result });
    await saveToHistory(result.mealName, {
      primaryProtein: result.primaryProtein,
      cuisineStyle: result.cuisineStyle,
      majorStarch: result.majorStarch,
      cookingMethod: result.cookingMethod,
    });

    process.stdout.write(` → ${result.mealName}\n`);
  }

  // ── Print results table ───────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────────────────────────────────");
  console.log("  #  | Meal                                    | Protein   | Cuisine       | Starch     | Method");
  console.log("─────────────────────────────────────────────────────────────────────────────────────");
  for (const r of rows) {
    const n = String(r.n).padStart(3);
    const meal = r.mealName.padEnd(40).slice(0, 40);
    const prot = r.primaryProtein.padEnd(10).slice(0, 10);
    const cui  = r.cuisineStyle.padEnd(14).slice(0, 14);
    const sta  = r.majorStarch.padEnd(11).slice(0, 11);
    const meth = r.cookingMethod;
    console.log(`  ${n} | ${meal} | ${prot} | ${cui} | ${sta} | ${meth}`);
  }
  console.log("─────────────────────────────────────────────────────────────────────────────────────");

  // ── Diversity score ───────────────────────────────────────────────────────
  const uniqueProteins = new Set(rows.map((r) => r.primaryProtein.toLowerCase())).size;
  const uniqueCuisines  = new Set(rows.map((r) => r.cuisineStyle.toLowerCase())).size;
  const uniqueStarches  = new Set(rows.map((r) => r.majorStarch.toLowerCase())).size;
  const uniqueMethods   = new Set(rows.map((r) => r.cookingMethod.toLowerCase())).size;
  const uniqueMeals     = new Set(rows.map((r) => r.mealName.toLowerCase())).size;

  console.log("\n📊 Diversity Scores (out of 10 calls):");
  console.log(`  Unique meal names:     ${uniqueMeals}/10 ${uniqueMeals >= 9 ? "✅" : uniqueMeals >= 7 ? "⚠️" : "❌"}`);
  console.log(`  Unique proteins:       ${uniqueProteins}/10 ${uniqueProteins >= 5 ? "✅" : uniqueProteins >= 3 ? "⚠️" : "❌"}`);
  console.log(`  Unique cuisines:       ${uniqueCuisines}/10 ${uniqueCuisines >= 5 ? "✅" : uniqueCuisines >= 3 ? "⚠️" : "❌"}`);
  console.log(`  Unique starches:       ${uniqueStarches}/10 ${uniqueStarches >= 4 ? "✅" : uniqueStarches >= 3 ? "⚠️" : "❌"}`);
  console.log(`  Unique cook methods:   ${uniqueMethods}/10 ${uniqueMethods >= 4 ? "✅" : uniqueMethods >= 3 ? "⚠️" : "❌"}`);

  // ── Explicit-intent override test ─────────────────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────────────────────────────────");
  console.log('🧪 Explicit-intent override: "I want the turkey meatballs you gave me before"');
  console.log("   (history now contains 10 meals — turkey meatballs is NOT one of them)");
  console.log("   Expected: coach honours the request despite variety rules\n");

  const finalHistory = await loadHistory();
  const overrideVarietyBlock = buildVarietyBlock(finalHistory, []);
  const overrideResult = await ask("I want the turkey meatballs you gave me before", overrideVarietyBlock);

  console.log(`  Meal returned:  ${overrideResult.mealName}`);
  console.log(`  Protein:        ${overrideResult.primaryProtein}`);
  console.log(`  Cuisine:        ${overrideResult.cuisineStyle}`);

  const honoured = overrideResult.mealName.toLowerCase().includes("turkey") ||
                   overrideResult.primaryProtein.toLowerCase().includes("turkey") ||
                   overrideResult.mealName.toLowerCase().includes("meatball");
  console.log(`\n  Override result: ${honoured ? "✅ PASS — coach honoured explicit intent" : "❌ FAIL — coach ignored explicit intent"}`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  await clearHistory();
  await pool.end();
  console.log("\n✅ Test complete. History cleared.\n");
}

main().catch((e) => {
  console.error("❌ Test failed:", e.message);
  pool.end();
  process.exit(1);
});
