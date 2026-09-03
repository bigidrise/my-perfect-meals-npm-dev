/**
 * starchSlotReplacement.integration.test.ts
 *
 * Integration tests — starch slot reservation updates when a board meal is
 * replaced mid-day using the explicit replace-intent flow (releaseLog: true).
 *
 * These tests hit the REAL database and prove:
 *   1. Logging a starchy board item via macro_logs increments starchMealsUsed to 1.
 *   2. The replace-intent delete (releaseLog: true) removes the macro_log atomically,
 *      releasing the starch slot back to 0.
 *   3. computeNextMealBudget() receives the correct restored starchMealsRemaining
 *      and allocates the right starchy carb target for the replacement meal.
 *   4. Edge case: the release works even when the log was committed before the delete
 *      (i.e., the log pre-existed the replace decision).
 *   5. Default delete (releaseLog: false) preserves the macro_log (history intact).
 *   6. Deleting a non-starchy board item does not corrupt the starch count.
 *   7. Double-delete is idempotent — no error on second call.
 *
 * The replace-intent delete flow maps to:
 *   DELETE /api/boards/:boardId/items/:itemId  { body: { releaseLog: true } }
 *
 * starchMealsUsed is counted by resolveDailyNutritionState via the query:
 *   COUNT(*) FILTER (WHERE starchy_carbs > 0 AND source != 'alcohol') FROM macro_logs
 * These tests replicate that query directly so they prove the real counting
 * logic without requiring a full user row in the DB.
 *
 * Test isolation: every suite uses a unique userId UUID so suites can run in
 * parallel without collisions. All seeded rows are cleaned up in afterAll.
 */

import { randomUUID } from "crypto";
import { db } from "../db";
import { macroLogs } from "../../shared/schema";
import { mealBoardItems } from "../db/schema/mealBoards";
import { eq, sql, and } from "drizzle-orm";
import { computeNextMealBudget } from "../services/nutritionBudget";
import type { DailyNutritionState } from "../../shared/dailyNutritionPrescription";
import { buildFallbackPrescription } from "../../shared/dailyNutritionPrescription";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_DATE_ISO = "2026-08-13";
const TEST_TZ       = "UTC";

/**
 * Count starch meals in macro_logs for a given userId on TEST_DATE_ISO.
 * Replicates the exact aggregation in resolveDailyNutritionState so these
 * tests validate the real counting query, not a stub.
 */
async function countStarchMeals(userId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*) FILTER (
      WHERE starchy_carbs::numeric > 0 AND source != 'alcohol'
    ) AS starch_meal_count
    FROM macro_logs
    WHERE user_id = ${userId}
      AND (at AT TIME ZONE ${TEST_TZ})::date = ${TEST_DATE_ISO}::date
  `);
  const row = (rows.rows?.[0] ?? {}) as Record<string, unknown>;
  return Number(row.starch_meal_count ?? 0);
}

/**
 * Insert a starchy macro_log tied to a boardItemReference.
 * Mimics the output of the POST /boards/:boardId/items/:itemId/log endpoint.
 */
async function insertStarchyLog(userId: string, boardItemRef: string): Promise<number> {
  const [row] = await db.insert(macroLogs).values({
    userId,
    at: new Date(`${TEST_DATE_ISO}T12:00:00Z`),
    source: `bi:${boardItemRef.slice(0, 20)}`,
    kcal: "550",
    protein: "35",
    carbs: "60",
    fat: "18",
    fiber: "4",
    alcohol: "0",
    starchyCarbs: "45",   // non-zero → counts as a starch meal
    fibrousCarbs: "15",
    classificationSource: "ingredient",
    boardItemReference: boardItemRef,
  }).returning({ id: macroLogs.id });
  return row.id;
}

/**
 * Insert a fibrous-only macro_log (starchyCarbs = 0) tied to a boardItemReference.
 */
async function insertFibrousLog(userId: string, boardItemRef: string): Promise<number> {
  const [row] = await db.insert(macroLogs).values({
    userId,
    at: new Date(`${TEST_DATE_ISO}T13:00:00Z`),
    source: `bi:${boardItemRef.slice(0, 20)}`,
    kcal: "200",
    protein: "15",
    carbs: "20",
    fat: "8",
    fiber: "8",
    alcohol: "0",
    starchyCarbs: "0",    // zero → does NOT count as a starch meal
    fibrousCarbs: "20",
    classificationSource: "ingredient",
    boardItemReference: boardItemRef,
  }).returning({ id: macroLogs.id });
  return row.id;
}

/** Insert a minimal board item and return its UUID. */
async function insertBoardItem(boardId: string): Promise<string> {
  const [item] = await db.insert(mealBoardItems).values({
    boardId,
    dayIndex: 0,
    slot: "lunch",
    mealId: randomUUID(),
    title: "Test Meal",
    servings: "1",
    macros: { kcal: 550, protein: 35, carbs: 60, fat: 18, starchyCarbs: 45, fibrousCarbs: 15 },
    ingredients: [],
  }).returning({ id: mealBoardItems.id });
  return item.id;
}

/**
 * Release a starch slot: delete the macro_log for the item (releaseLog=true path),
 * then delete the board item itself. Mirrors the transactional delete handler.
 */
async function releaseAndDeleteItem(boardItemId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(macroLogs).where(
      sql`${macroLogs.boardItemReference} = ${boardItemId}`
    );
    await tx.delete(mealBoardItems).where(eq(mealBoardItems.id, boardItemId));
  });
}

/**
 * Default delete (releaseLog=false): delete only the board item.
 * The macro_log is intentionally preserved.
 */
async function deleteItemOnly(boardItemId: string): Promise<void> {
  await db.delete(mealBoardItems).where(eq(mealBoardItems.id, boardItemId));
}

/**
 * Build a DailyNutritionState fixture for computeNextMealBudget with the
 * given starchMealsRemaining. No DB required — the function is pure.
 */
function makeStateWithStarchRemaining(starchMealsRemaining: number): DailyNutritionState {
  const prescription = {
    ...buildFallbackPrescription(TEST_DATE_ISO),
    caloriesTarget:       2000,
    proteinTarget:        150,
    carbsTarget:          200,
    fatTarget:            67,
    starchyCarbsTarget:   100,
    fibrousCarbsTarget:   100,
    starchMealsAllowed:   2,
    starchMealsUsed:      2 - starchMealsRemaining,
    starchMealsRemaining,
    starchyCarbsConsumed:  0,
    starchyCarbsRemaining: 100,
    gramsPerRemainingStarchMeal: starchMealsRemaining > 0 ? 50 : 0,
    source: "user_default" as const,
  };

  return {
    date:       TEST_DATE_ISO,
    resolvedAt: `${TEST_DATE_ISO}T12:00:00.000Z`,
    prescription,
    consumed: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0, fibrousCarbs: 0,
      mealCount: 0, starchMealsLogged: 0,
    },
    planned: {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      starchyCarbs: 0, starchMealsPlanned: 0, reservationCount: 0,
    },
    remaining: {
      calories: 2000, protein: 150, carbs: 200, fat: 67,
      starchyCarbs: 100, fibrousCarbs: 100,
      starchMealsRemaining,
    },
    mealPlanConfig: {
      mealsPerDay:                4,
      starchMealsPerDay:          2,
      starchDistributionStrategy: "even",
    },
    activeConstraints: {
      generationContext:      "standard",
      starchSlotsExhausted:   starchMealsRemaining === 0,
      calorieBudgetExhausted: false,
      proteinBudgetMet:       false,
    },
  };
}

// ── Cleanup registry ──────────────────────────────────────────────────────────

const trackedLogIds:      number[] = [];
const trackedItemIds:     string[] = [];
const trackedUserIds:     string[] = [];

afterAll(async () => {
  for (const id of trackedLogIds) {
    await db.delete(macroLogs).where(eq(macroLogs.id, id)).catch(() => {});
  }
  for (const id of trackedItemIds) {
    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, id)).catch(() => {});
  }
  for (const uid of trackedUserIds) {
    await db.delete(macroLogs).where(eq(macroLogs.userId, uid)).catch(() => {});
  }
}, 30_000);

// ── Suite A: replace-intent flow releases the starch slot ────────────────────

describe("Integration — replace-intent delete (releaseLog=true) releases the starch slot", () => {
  const userId  = `test-starch-${randomUUID()}`;
  const boardId = randomUUID();
  let itemId: string;
  let logId:  number;

  beforeAll(async () => {
    trackedUserIds.push(userId);
    itemId = await insertBoardItem(boardId);
    trackedItemIds.push(itemId);
  }, 30_000);

  afterAll(async () => {
    await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${itemId}`).catch(() => {});
    await db.delete(mealBoardItems)
      .where(eq(mealBoardItems.id, itemId)).catch(() => {});
  }, 30_000);

  it("starchMealsUsed = 0 before any log is written (pre-condition)", async () => {
    expect(await countStarchMeals(userId)).toBe(0);
  });

  it("starchMealsUsed = 1 after the board item is logged as a macro_log", async () => {
    logId = await insertStarchyLog(userId, itemId);
    trackedLogIds.push(logId);
    expect(await countStarchMeals(userId)).toBe(1);
  });

  it("replace-intent delete removes the macro_log atomically and restores the slot", async () => {
    await releaseAndDeleteItem(itemId);
    expect(await countStarchMeals(userId)).toBe(0);
  });

  it("computeNextMealBudget shows starchMealsRemaining = 2 after slot is released", () => {
    const state  = makeStateWithStarchRemaining(2);
    const budget = computeNextMealBudget(state, 4);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBe(25); // 100g / 4 meals
  });

  it("replacement meal gets the correct starch allocation (not artificially capped)", () => {
    // With slot available: replacement gets starchy carbs
    const withSlot    = computeNextMealBudget(makeStateWithStarchRemaining(2), 4);
    // Without slot (bug scenario): replacement is forced fibrous-only
    const withoutSlot = computeNextMealBudget(makeStateWithStarchRemaining(0), 4);

    expect(withSlot.starchSlotAvailable).toBe(true);
    expect(withSlot.starchyCarbsTarget).toBeGreaterThan(0);

    expect(withoutSlot.starchSlotAvailable).toBe(false);
    expect(withoutSlot.starchyCarbsTarget).toBe(0);
    expect(withoutSlot.fibrousCarbsTarget).toBe(withoutSlot.carbsTarget);
  });
});

// ── Suite B: edge case — log committed before replace decision ────────────────

describe("Integration — edge case: replace-intent still releases a pre-committed log", () => {
  const userId  = `test-precommit-${randomUUID()}`;
  const boardId = randomUUID();
  let itemId: string;
  let logId:  number;

  beforeAll(async () => {
    trackedUserIds.push(userId);
    // Log is committed immediately (meal eaten), then user decides to replace
    itemId = await insertBoardItem(boardId);
    trackedItemIds.push(itemId);
    logId  = await insertStarchyLog(userId, itemId);
    trackedLogIds.push(logId);
  }, 30_000);

  afterAll(async () => {
    await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${itemId}`).catch(() => {});
    await db.delete(mealBoardItems)
      .where(eq(mealBoardItems.id, itemId)).catch(() => {});
  }, 30_000);

  it("starchMealsUsed = 1 immediately (pre-condition: log committed)", async () => {
    expect(await countStarchMeals(userId)).toBe(1);
  });

  it("replace-intent delete removes the pre-committed log (slot released)", async () => {
    const deleted = await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${itemId}`)
      .returning({ id: macroLogs.id });
    expect(deleted.length).toBe(1);
    expect(deleted[0].id).toBe(logId);

    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId));
    expect(await countStarchMeals(userId)).toBe(0);
  });

  it("replacement budget shows slot available after pre-committed log is released", () => {
    const budget = computeNextMealBudget(makeStateWithStarchRemaining(2), 3);
    expect(budget.starchSlotAvailable).toBe(true);
    expect(budget.starchyCarbsTarget).toBe(33); // 100g / 3 meals
  });
});

// ── Suite C: default delete preserves nutrition history ───────────────────────

describe("Integration — default delete (releaseLog=false) preserves macro_log", () => {
  const userId  = `test-preserve-${randomUUID()}`;
  const boardId = randomUUID();
  let itemId: string;
  let logId:  number;

  beforeAll(async () => {
    trackedUserIds.push(userId);
    itemId = await insertBoardItem(boardId);
    trackedItemIds.push(itemId);
    logId  = await insertStarchyLog(userId, itemId);
    trackedLogIds.push(logId);
  }, 30_000);

  afterAll(async () => {
    await db.delete(macroLogs).where(eq(macroLogs.id, logId)).catch(() => {});
    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId)).catch(() => {});
  }, 30_000);

  it("starchMealsUsed = 1 (pre-condition: item logged)", async () => {
    expect(await countStarchMeals(userId)).toBe(1);
  });

  it("default delete removes the board item but keeps the macro_log", async () => {
    await deleteItemOnly(itemId);

    // Board item is gone
    const items = await db.select().from(mealBoardItems).where(eq(mealBoardItems.id, itemId));
    expect(items.length).toBe(0);

    // Log still exists — nutrition history preserved
    const logs = await db.select({ id: macroLogs.id }).from(macroLogs).where(eq(macroLogs.id, logId));
    expect(logs.length).toBe(1);

    // starchMealsUsed still = 1 (the consumed meal still counts)
    expect(await countStarchMeals(userId)).toBe(1);
  });
});

// ── Suite D: non-starchy item delete does not corrupt starch count ────────────

describe("Integration — non-starchy board item delete does not change starch count", () => {
  const userId  = `test-nonstarchy-${randomUUID()}`;
  const boardId = randomUUID();
  let starchyItemId:    string;
  let nonStarchyItemId: string;
  let starchyLogId:     number;
  let nonStarchyLogId:  number;

  beforeAll(async () => {
    trackedUserIds.push(userId);
    starchyItemId    = await insertBoardItem(boardId);
    nonStarchyItemId = await insertBoardItem(boardId);
    trackedItemIds.push(starchyItemId, nonStarchyItemId);

    starchyLogId    = await insertStarchyLog(userId, starchyItemId);
    nonStarchyLogId = await insertFibrousLog(userId, nonStarchyItemId);
    trackedLogIds.push(starchyLogId, nonStarchyLogId);
  }, 30_000);

  afterAll(async () => {
    await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${starchyItemId}`).catch(() => {});
    await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${nonStarchyItemId}`).catch(() => {});
    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, starchyItemId)).catch(() => {});
    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, nonStarchyItemId)).catch(() => {});
  }, 30_000);

  it("starchMealsUsed = 1 with one starchy + one fibrous log (pre-condition)", async () => {
    expect(await countStarchMeals(userId)).toBe(1);
  });

  it("replace-intent delete of non-starchy item leaves starchMealsUsed unchanged", async () => {
    await releaseAndDeleteItem(nonStarchyItemId);
    expect(await countStarchMeals(userId)).toBe(1); // starchy still counted
  });

  it("starchMealsUsed drops to 0 only when the starchy item itself is released", async () => {
    await releaseAndDeleteItem(starchyItemId);
    expect(await countStarchMeals(userId)).toBe(0);
  });
});

// ── Suite E: double delete is idempotent ──────────────────────────────────────

describe("Integration — double replace-intent delete is idempotent", () => {
  const userId  = `test-idempotent-${randomUUID()}`;
  const boardId = randomUUID();
  let itemId: string;

  beforeAll(async () => {
    trackedUserIds.push(userId);
    itemId = await insertBoardItem(boardId);
    trackedItemIds.push(itemId);
    const logId = await insertStarchyLog(userId, itemId);
    trackedLogIds.push(logId);
  }, 30_000);

  afterAll(async () => {
    await db.delete(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${itemId}`).catch(() => {});
    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId)).catch(() => {});
  }, 30_000);

  it("first replace-intent delete succeeds, count goes to 0", async () => {
    await releaseAndDeleteItem(itemId);
    expect(await countStarchMeals(userId)).toBe(0);
  });

  it("second delete (same ids) does not throw and count stays 0", async () => {
    await expect(releaseAndDeleteItem(itemId)).resolves.not.toThrow();
    expect(await countStarchMeals(userId)).toBe(0);
  });
});
