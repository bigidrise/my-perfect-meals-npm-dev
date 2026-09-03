/**
 * server/routes/refinement-helpers.ts
 *
 * Pure board-mutation helpers shared between server/routes/refinement.ts
 * and its unit tests.  No DB dependencies — safe to import in test context.
 */

/**
 * Locate a meal by id within board.days[dayISO][slot].
 * Returns { found: true, index, meal } or { found: false }.
 */
export function findMealInSlot(
  board:  any,
  dayISO: string,
  slot:   string,
  mealId: string,
): { found: true; index: number; meal: Record<string, unknown> } | { found: false } {
  const slotArr = (board?.days?.[dayISO]?.[slot] ?? []) as Array<Record<string, unknown>>;
  const index   = slotArr.findIndex((m: any) => m.id === mealId);
  if (index === -1) return { found: false };
  return { found: true, index, meal: slotArr[index] };
}

/**
 * Replace the meal at [dayISO][slot][index] with newMeal and return the
 * updated board.  Does NOT mutate the original board.
 *
 * The returned board has `version` incremented by 1 and `meta.lastUpdatedAt`
 * set to the current time.
 */
export function replaceMealInBoard(
  board:   any,
  dayISO:  string,
  slot:    string,
  index:   number,
  newMeal: Record<string, unknown>,
): any {
  const daySlot = [...((board?.days?.[dayISO]?.[slot] ?? []) as any[])];
  daySlot[index] = newMeal;
  return {
    ...board,
    days: {
      ...(board.days ?? {}),
      [dayISO]: {
        ...((board.days ?? {})[dayISO] ?? {}),
        [slot]: daySlot,
      },
    },
    version: (board.version ?? 1) + 1,
    meta: {
      ...(board.meta ?? {}),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}
