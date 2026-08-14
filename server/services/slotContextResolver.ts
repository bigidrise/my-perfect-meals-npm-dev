/**
 * slotContextResolver.ts
 *
 * Resolves the full server-side context for a Weekly Meal Board slot before
 * refinement.  Loads the board from weekBoards JSONB storage, locates the
 * target meal, verifies the caller owns the board, and surfaces GLP-1 context.
 *
 * The Weekly Meal Board stores meals in board.days[dayISO][slot][] (JSONB).
 * This resolver works against that model exclusively — no meal_board_items.
 */

import { getWeekBoard } from "../data/weekBoardsRepo";
import type { SlotContext } from "../../shared/refinement";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "./glp1/resolveGLP1GlobalContext";
import type { ResolvedGLP1Targets } from "./glp1/resolveGLP1MealTargets";

export interface ResolvedSlotContext {
  /** The full meal object from the board. */
  meal:         Record<string, unknown>;
  glp1Targets:  ResolvedGLP1Targets | null;
  glp1Block:    string;
  /** Resolved meal type for the slot (used by GLP-1 resolver). */
  mealType:     "breakfast" | "lunch" | "dinner" | "snack";
  /** dayISO — the canonical date for GLP-1 nutrition state. */
  dateISO:      string;
  /** Board version at load time — embedded in the confirm token for version CAS. */
  boardVersion: number;
}

/**
 * Resolves and validates a board slot for refinement.
 *
 * @throws Error with .statusCode = 404 if board or meal not found
 * @throws Error with .statusCode = 503 if GLP-1 resolver fails (fail-closed)
 */
export async function resolveSlotContext(
  userId:      string,
  slotContext: SlotContext,
): Promise<ResolvedSlotContext> {
  const { weekStartISO, dayISO, slot, mealId } = slotContext;

  // ── 1. Load weekly board ──────────────────────────────────────────────────
  // The main board uses builderType = "" (no builder namespace).
  const board = await getWeekBoard(userId, weekStartISO, "");
  if (!board) {
    const err = new Error("Weekly board not found for this week.");
    (err as any).statusCode = 404;
    throw err;
  }

  // ── 2. Find the meal in board.days[dayISO][slot] ──────────────────────────
  const dayData    = (board.days ?? {})[dayISO] ?? {};
  const slotArr    = (dayData[slot] ?? []) as Array<Record<string, unknown>>;
  const meal       = slotArr.find((m: any) => m.id === mealId);
  const boardVersion = typeof board.version === "number" ? board.version : 1;
  if (!meal) {
    const err = new Error("Meal not found in board slot.");
    (err as any).statusCode = 404;
    throw err;
  }

  // ── 3. Resolve GLP-1 context — FAIL CLOSED ───────────────────────────────
  // Pass mealId as excludeItemId so the being-replaced meal is NOT counted
  // against its own replacement budget in the daily nutrition state query.
  const mealType = normalizeMealType(slot);
  let glp1Targets: ResolvedGLP1Targets | null = null;
  let glp1Block = "";

  let glp1Ctx: Awaited<ReturnType<typeof resolveGLP1GlobalContext>> | null = null;
  try {
    glp1Ctx = await resolveGLP1GlobalContext(userId, dayISO, mealType, mealId);
  } catch {
    glp1Ctx = null;
  }

  if (glp1Ctx === null) {
    const err = new Error("Clinical guidance temporarily unavailable — GLP-1 resolver failed. Please try again.");
    (err as any).statusCode = 503;
    throw err;
  }

  if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
    const err = new Error("GLP-1 clinical targets temporarily unavailable. Please try again.");
    (err as any).statusCode = 503;
    throw err;
  }

  if (glp1Ctx.isActive) {
    glp1Block   = buildGLP1RecommendationBlock(glp1Ctx);
    glp1Targets = glp1Ctx.resolvedTargets ?? null;
  }

  return {
    meal,
    glp1Targets,
    glp1Block,
    mealType,
    dateISO: dayISO,
    boardVersion,
  };
}

function normalizeMealType(slot: string): "breakfast" | "lunch" | "dinner" | "snack" {
  if (slot === "breakfast") return "breakfast";
  if (slot === "lunch")     return "lunch";
  if (slot === "dinner")    return "dinner";
  return "snack";
}
