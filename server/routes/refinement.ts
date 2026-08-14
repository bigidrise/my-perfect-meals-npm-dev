/**
 * server/routes/refinement.ts
 *
 * Universal Meal Refinement — Stage 1: Weekly Meal Board replace_component
 *
 * POST /api/refinement/preview  — generates a component swap preview + confirmToken
 * POST /api/refinement/confirm  — atomically replaces the meal in the weekly board JSONB
 * POST /api/refinement/restore  — reverts the swap using a restoreToken
 *
 * All three endpoints require an authenticated session (requireAuth applied at mount).
 *
 * Storage model:
 *   The Weekly Meal Board stores meals in week_boards.boardJSON under
 *   board.days[dayISO][slot][]. Refinement reads and writes this JSONB directly
 *   via getWeekBoard / upsertWeekBoard — no meal_board_items involved.
 *
 * Security guarantees:
 *   • HMAC-SHA256 signed tokens — tampering or expiry is rejected at decode time.
 *   • Client sends only slot identifiers (weekStartISO, dayISO, slot, mealId);
 *     the server loads the board and verifies the meal still exists before acting.
 *   • Confirm: verifies original meal is still present by ID (replay → 409).
 *   • Restore: verifies refined meal is still present by ID (replay → 409).
 *
 * GLP-1 clinical safety:
 *   • slotContextResolver resolves GLP-1 targets fail-closed (throws 503 on failure).
 *   • GLP-1 fat-ceiling noncompliance after retry → hard error (never a warning).
 *   • mealId passed as excludeItemId so the replaced item doesn't count against budget.
 */

import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { lockedDays } from "../../shared/biometricsSchema";
import { getWeekBoard, upsertWeekBoard, conditionalUpdateWeekBoard } from "../data/weekBoardsRepo";
import { resolveSlotContext } from "../services/slotContextResolver";
import { getMealRefinementEngine, MealRefinementRetryableError } from "../services/mealRefinementEngine";
import { encodeToken, decodeToken, expireInMinutes } from "../lib/refinementToken";
import { findMealInSlot, replaceMealInBoard } from "./refinement-helpers";
import type {
  ConfirmTokenPayload,
  RestoreTokenPayload,
  RefinementPreviewResponse,
  RefinementConfirmResponse,
  RefinementRestoreResponse,
} from "../../shared/refinement";

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const SlotContextSchema = z.object({
  weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayISO:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot:         z.enum(["breakfast", "lunch", "dinner", "snacks"]),
  mealId:       z.string().min(1).max(128),
});

const PreviewBodySchema = z.object({
  slotContext:     SlotContextSchema,
  componentTarget: z.enum(["protein", "starch", "vegetable", "sauce", "side"]),
  userInstruction: z.string().min(1).max(500),
});

const ConfirmBodySchema = z.object({
  confirmToken: z.string().min(1),
});

const RestoreBodySchema = z.object({
  restoreToken: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function authUserId(req: any): string | null {
  return req.authUser?.id ?? req.session?.userId ?? null;
}

function computeMacroDiff(
  original: Record<string, unknown>,
  refined:  Record<string, unknown>,
) {
  const toNum = (obj: Record<string, unknown>, key: string): number => {
    const v = obj[key];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  };
  return {
    calories: toNum(refined, "calories") - toNum(original, "calories"),
    protein:  toNum(refined, "protein")  - toNum(original, "protein"),
    carbs:    toNum(refined, "carbs")    - toNum(original, "carbs"),
    fat:      toNum(refined, "fat")      - toNum(original, "fat"),
  };
}

// findMealInSlot and replaceMealInBoard are imported from ./refinement-helpers

/**
 * Rejects with a 423 response if the target day is locked.
 * Used by preview, confirm, and restore — all three must enforce the lock so
 * a token minted while a day was unlocked cannot later mutate a locked board.
 */
async function assertDayNotLocked(userId: string, dayISO: string, res: any): Promise<boolean> {
  const lockedRow = await db
    .select({ dateISO: lockedDays.dateISO })
    .from(lockedDays)
    .where(and(eq(lockedDays.userId, userId), eq(lockedDays.dateISO, dayISO)))
    .limit(1);
  if (lockedRow.length > 0) {
    res.status(423).json({ error: "This day is locked and cannot be modified.", code: "DAY_LOCKED" });
    return true;
  }
  return false;
}

// ── POST /preview ─────────────────────────────────────────────────────────────

router.post("/preview", async (req, res) => {
  try {
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = PreviewBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { slotContext, componentTarget, userInstruction } = parsed.data;

    // ── 0. Locked-day enforcement (server-side) ─────────────────────────────
    if (await assertDayNotLocked(userId, slotContext.dayISO, res)) return;

    // ── 1. Resolve slot — loads board, verifies meal exists, GLP-1 fail-closed ──
    const resolved = await resolveSlotContext(userId, slotContext);
    const { meal: originalMeal, glp1Targets, glp1Block, mealType, dateISO, boardVersion } = resolved;

    // Extract existing meal fields for the engine
    const existingMacros = (originalMeal.nutrition ?? originalMeal.macros ?? {}) as Record<string, unknown>;
    const rawIngredients = (originalMeal.ingredients ?? []) as Array<Record<string, unknown>>;
    const existingIngredients: Array<{ name: string; qty: string }> = rawIngredients.map((i: any) => ({
      name: String(i.name ?? i.item ?? ""),
      qty:  String(i.qty ?? i.quantity ?? i.amount ?? ""),
    }));

    // ── 2. Run replace_component engine ────────────────────────────────────
    const engine = getMealRefinementEngine();
    const result = await engine.refine({
      changeType:      "replace_component",
      userId,
      existingMeal: {
        title:       String(originalMeal.title ?? originalMeal.name ?? ""),
        macros:      existingMacros,
        ingredients: existingIngredients,
      },
      componentTarget,
      userInstruction,
      mealType,
      glp1Targets,
      glp1Block,
    });

    const updatedMeal = (result as any).updatedMeal as Record<string, unknown>;
    const newMacros   = (updatedMeal.macros ?? {}) as Record<string, unknown>;

    // ── 3. Build preview payload ────────────────────────────────────────────
    const originalMacrosForDiff = {
      calories: Number((existingMacros as any).calories ?? 0),
      protein:  Number((existingMacros as any).protein  ?? 0),
      carbs:    Number((existingMacros as any).carbs    ?? 0),
      fat:      Number((existingMacros as any).fat      ?? 0),
    };
    const macroDiff = computeMacroDiff(originalMacrosForDiff, newMacros);

    const refinedIngredients: Array<{ name: string; qty: string }> = Array.isArray(updatedMeal.ingredients)
      ? (updatedMeal.ingredients as any[]).map((i: any) => ({
          name: String(i.name ?? i.item ?? ""),
          qty:  String(i.qty ?? i.quantity ?? i.amount ?? ""),
        }))
      : existingIngredients.map((i: any) => ({ name: String(i.name ?? ""), qty: String(i.qty ?? i.quantity ?? "") }));

    // ── 4. Build refined meal object with a new ID (for restore replay guard) ─
    const newMealId = uuidv4();
    const refinedMealObj: Record<string, unknown> = {
      ...originalMeal,              // inherit imageUrl, badges, etc.
      ...updatedMeal,               // apply engine changes
      id:    newMealId,             // new ID so original is distinguishable
      title: String(updatedMeal.title ?? originalMeal.title ?? originalMeal.name ?? ""),
      name:  String(updatedMeal.title ?? originalMeal.name ?? ""),
    };

    // ── 5. Sign confirm token (10 min) ──────────────────────────────────────
    // boardVersion is embedded so confirm can reject stale tokens when the board
    // was concurrently edited between preview and confirm (version CAS).
    const confirmPayload: ConfirmTokenPayload = {
      type:           "refinement_confirm",
      exp:            expireInMinutes(10),
      userId,
      weekStartISO:   slotContext.weekStartISO,
      dayISO:         dateISO,
      slot:           slotContext.slot,
      originalMealId: slotContext.mealId,
      newMealId,
      boardVersion,
      refinedMeal:    refinedMealObj,
    };
    const confirmToken = encodeToken(confirmPayload);

    const response: RefinementPreviewResponse = {
      previewMeal: {
        title:         refinedMealObj.title as string,
        macros: {
          calories: Number(newMacros.calories ?? 0),
          protein:  Number(newMacros.protein  ?? 0),
          carbs:    Number(newMacros.carbs    ?? 0),
          fat:      Number(newMacros.fat      ?? 0),
        },
        ingredients:    refinedIngredients,
        changesSummary: (result as any).changesSummary ?? "Meal updated.",
        protocolNote:   (result as any).protocolNote   ?? null,
      },
      macroDiff,
      confirmToken,
    };

    return res.json(response);
  } catch (err: any) {
    const status = err.statusCode ?? (err instanceof MealRefinementRetryableError ? 503 : 500);
    console.error("[Refinement/preview]", err?.message);
    return res.status(status).json({ error: err.message ?? "Preview generation failed." });
  }
});

// ── POST /confirm ─────────────────────────────────────────────────────────────
//
// Atomically replaces the original meal with the refined meal in the board JSONB:
//   1. Verify HMAC token.
//   2. Load board for userId/weekStartISO.
//   3. Verify original meal still exists by originalMealId (replay → 409).
//   4. Replace original with refinedMeal in board.days[dayISO][slot].
//   5. Upsert board.
//   6. Return restoreToken.

router.post("/confirm", async (req, res) => {
  try {
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = ConfirmBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    // ── 1. Decode + verify token ────────────────────────────────────────────
    let payload: ConfirmTokenPayload;
    try {
      payload = decodeToken<ConfirmTokenPayload>(parsed.data.confirmToken);
    } catch (tokenErr: any) {
      return res.status(400).json({ error: tokenErr.message });
    }

    if (payload.type !== "refinement_confirm") {
      return res.status(400).json({ error: "Wrong token type — expected a confirm token." });
    }
    if (payload.userId !== userId) {
      return res.status(403).json({ error: "Token user does not match authenticated user." });
    }

    const { weekStartISO, dayISO, slot, originalMealId, newMealId, boardVersion, refinedMeal } = payload;

    // ── 1b. Locked-day enforcement on mutation ───────────────────────────────
    // Re-checked here so a token minted while the day was unlocked cannot
    // mutate a board that was subsequently locked in another tab or session.
    if (await assertDayNotLocked(userId, dayISO, res)) return;

    // ── 2. Load board ───────────────────────────────────────────────────────
    const board = await getWeekBoard(userId, weekStartISO, "");
    if (!board) {
      return res.status(404).json({ error: "Weekly board not found." });
    }

    // ── 3. Verify original meal still exists (replay protection) ────────────
    const found = findMealInSlot(board, dayISO, slot, originalMealId);
    if (!found.found) {
      return res.status(409).json({
        error: "This swap has already been applied — the original meal is no longer in the board.",
      });
    }
    const originalMeal = found.meal;

    // ── 4. Replace original with refined meal in JSONB ──────────────────────
    const updatedBoard = replaceMealInBoard(board, dayISO, slot, found.index, refinedMeal);

    // ── 5. Save board with version CAS (concurrent-edit protection) ─────────
    // If another edit happened between preview and confirm, the board version
    // will have advanced and this update will find 0 rows → 409.
    const { updated } = await conditionalUpdateWeekBoard(userId, weekStartISO, updatedBoard, boardVersion, "");
    if (!updated) {
      return res.status(409).json({
        error: "The board was updated between preview and confirm. Please preview again.",
      });
    }

    // ── 6. Build restore token (60 min) ────────────────────────────────────
    const restorePayload: RestoreTokenPayload = {
      type:          "refinement_restore",
      exp:           expireInMinutes(60),
      userId,
      weekStartISO,
      dayISO,
      slot,
      newMealId,
      originalMeal,
    };
    const restoreToken = encodeToken(restorePayload);

    const response: RefinementConfirmResponse = {
      ok:           true,
      newMealId,
      restoreToken,
    };
    return res.json(response);
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    console.error("[Refinement/confirm]", err?.message);
    return res.status(status).json({ error: err.message ?? "Confirm failed." });
  }
});

// ── POST /restore ─────────────────────────────────────────────────────────────
//
// Reverts a confirmed swap by replacing the refined meal with the original.
// Uses the same version-CAS pattern as /confirm:
//   1. Verify HMAC token.
//   2. Load board; capture boardVersion.
//   3. Verify refined meal still exists by newMealId (replay → 409).
//   4. Replace refined meal with originalMeal in JSONB.
//   5. Conditional update against boardVersion → 409 on concurrent edit.

router.post("/restore", async (req, res) => {
  try {
    const userId = authUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const parsed = RestoreBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    // ── 1. Decode + verify token ────────────────────────────────────────────
    let payload: RestoreTokenPayload;
    try {
      payload = decodeToken<RestoreTokenPayload>(parsed.data.restoreToken);
    } catch (tokenErr: any) {
      return res.status(400).json({ error: tokenErr.message });
    }

    if (payload.type !== "refinement_restore") {
      return res.status(400).json({ error: "Wrong token type — expected a restore token." });
    }
    if (payload.userId !== userId) {
      return res.status(403).json({ error: "Token user does not match authenticated user." });
    }

    const { weekStartISO, dayISO, slot, newMealId, originalMeal } = payload;

    // ── 1b. Locked-day enforcement on mutation ───────────────────────────────
    // Re-checked here so a restore token minted before a day was locked cannot
    // revert a board that the user subsequently locked.
    if (await assertDayNotLocked(userId, dayISO, res)) return;

    // ── 2. Load board + capture version for CAS ─────────────────────────────
    const board = await getWeekBoard(userId, weekStartISO, "");
    if (!board) {
      return res.status(404).json({ error: "Weekly board not found." });
    }
    const boardVersion = typeof board.version === "number" ? board.version : 1;

    // ── 3. Verify refined meal still exists (replay + concurrency guard) ─────
    const found = findMealInSlot(board, dayISO, slot, newMealId);
    if (!found.found) {
      return res.status(409).json({
        error: "The refined meal is no longer in the board — it may have been replaced or removed already.",
      });
    }

    // ── 4. Replace refined meal with original in JSONB ──────────────────────
    const updatedBoard = replaceMealInBoard(board, dayISO, slot, found.index, originalMeal);

    // ── 5. Conditional update against boardVersion ───────────────────────────
    // If a concurrent edit bumped the board version, return 409 so the client
    // can reload the board and decide whether to retry the restore.
    const { updated } = await conditionalUpdateWeekBoard(userId, weekStartISO, updatedBoard, boardVersion, "");
    if (!updated) {
      return res.status(409).json({
        error: "The board was updated concurrently. Please reload the board and try undoing again.",
      });
    }

    const response: RefinementRestoreResponse = {
      ok:              true,
      restoredMealId:  String((originalMeal as any).id ?? ""),
    };
    return res.json(response);
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    console.error("[Refinement/restore]", err?.message);
    return res.status(status).json({ error: err.message ?? "Restore failed." });
  }
});

export default router;
