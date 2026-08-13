
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { mealBoards, mealBoardItems } from "../db/schema/mealBoards";
import { macroLogs } from "../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logActivityFireAndForget } from "../services/activityLog";
import { enforceBuilderFromParam } from "../middleware/studioAccess";
import { requireAuth } from "../middleware/requireAuth";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";

const router = Router();

// All meal board routes require authentication and at minimum an Essential subscription.
// ProCare clients with studio membership are authenticated and pass requireAuth.
router.use(requireAuth, requireEssentialAccess);

// Get or create current board for user/program
// Studio clients can only access their assigned builder
router.get("/users/:userId/boards/:program/current", enforceBuilderFromParam("program"), async (req, res) => {
  try {
    const { userId, program } = req.params;
    const { days = "7", start } = req.query as { days?: string; start?: string };
    const startDate = start ? new Date(start) : new Date();
    startDate.setHours(0, 0, 0, 0);

    let [board] = await db.select().from(mealBoards)
      .where(and(
        eq(mealBoards.userId, userId),
        eq(mealBoards.program, program),
        eq(mealBoards.startDate, startDate)
      ))
      .limit(1);

    if (!board) {
      [board] = await db.insert(mealBoards).values({
        userId,
        program,
        startDate,
        days: Number(days)
      }).returning();

      logActivityFireAndForget(
        userId,
        userId,
        "board_created",
        "meal_board",
        board.id,
        { program, startDate: startDate.toISOString(), days: Number(days) }
      );
    }

    const items = await db.select().from(mealBoardItems)
      .where(eq(mealBoardItems.boardId, board.id))
      .orderBy(desc(mealBoardItems.createdAt));

    res.json({ board, items });
  } catch (error) {
    console.error("Error fetching meal board:", error);
    res.status(500).json({ error: "Failed to fetch board" });
  }
});

// Add item to board
router.post("/boards/:boardId/items", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { dayIndex, slot, mealId, title, servings, macros, ingredients } = req.body;

    const [item] = await db.insert(mealBoardItems).values({
      boardId,
      dayIndex,
      slot,
      mealId,
      title,
      servings: servings ? servings.toString() : "1",
      macros,
      ingredients: ingredients || []
    }).returning();

    const [board] = await db.select().from(mealBoards).where(eq(mealBoards.id, boardId)).limit(1);
    if (board) {
      await db.update(mealBoards).set({
        lastUpdatedByUserId: board.userId,
        lastUpdatedByRole: "client",
        updatedAt: new Date(),
      }).where(eq(mealBoards.id, boardId));
    }

    res.json(item);
  } catch (error) {
    console.error("Error adding board item:", error);
    res.status(400).json({ error: "Failed to add item" });
  }
});

// Delete item from board
router.delete("/boards/:boardId/items/:itemId", async (req, res) => {
  try {
    const { boardId, itemId } = req.params;

    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId));

    const [board] = await db.select().from(mealBoards).where(eq(mealBoards.id, boardId)).limit(1);
    if (board) {
      await db.update(mealBoards).set({
        lastUpdatedByUserId: board.userId,
        lastUpdatedByRole: "client",
        updatedAt: new Date(),
      }).where(eq(mealBoards.id, boardId));
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting board item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// Repeat day to the rest of the board
router.post("/boards/:boardId/repeat-day", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { sourceDayIndex } = req.body as { sourceDayIndex: number };

    const source = await db.select().from(mealBoardItems)
      .where(and(eq(mealBoardItems.boardId, boardId), eq(mealBoardItems.dayIndex, sourceDayIndex)));

    const [board] = await db.select().from(mealBoards).where(eq(mealBoards.id, boardId)).limit(1);
    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    const targets = Array.from({ length: board.days }, (_, d) => d).filter(d => d !== sourceDayIndex);

    // Clear other days
    for (const dayIndex of targets) {
      await db.delete(mealBoardItems).where(and(
        eq(mealBoardItems.boardId, boardId),
        eq(mealBoardItems.dayIndex, dayIndex)
      ));
    }

    // Copy source day to other days
    const clones = targets.flatMap(d =>
      source.map(s => ({
        boardId,
        dayIndex: d,
        slot: s.slot,
        mealId: s.mealId,
        title: s.title,
        servings: s.servings,
        macros: s.macros,
        ingredients: s.ingredients
      }))
    );

    if (clones.length) {
      await db.insert(mealBoardItems).values(clones);
    }

    await db.update(mealBoards).set({
      lastUpdatedByUserId: board.userId,
      lastUpdatedByRole: "client",
      updatedAt: new Date(),
    }).where(eq(mealBoards.id, boardId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error repeating day:", error);
    res.status(500).json({ error: "Failed to repeat day" });
  }
});

// Log a single board item as a macro_log entry (convert reservation → consumed)
//
// POST /boards/:boardId/items/:itemId/log
//
// Validates board ownership, then writes a macro_log row with board_item_reference
// set to itemId. The unique partial index on macro_logs(board_item_reference) ensures
// only one log can ever reference a given board item. A second call returns 409.
router.post("/boards/:boardId/items/:itemId/log", requireAuth, async (req, res) => {
  try {
    const authUserId: string = (req as any).authUser?.id || (req.session as any)?.userId;
    if (!authUserId) return res.status(401).json({ error: "Unauthorized" });

    const { boardId, itemId } = req.params;
    const { dateIso, source } = req.body;

    // ── 1. Verify board ownership ────────────────────────────────────────────
    const [board] = await db.select().from(mealBoards).where(eq(mealBoards.id, boardId)).limit(1);
    if (!board) return res.status(404).json({ error: "Board not found" });
    if (board.userId !== authUserId) {
      return res.status(403).json({ error: "Forbidden: board belongs to another user" });
    }

    // ── 2. Load the board item ────────────────────────────────────────────────
    const [item] = await db
      .select()
      .from(mealBoardItems)
      .where(and(eq(mealBoardItems.id, itemId), eq(mealBoardItems.boardId, boardId)))
      .limit(1);
    if (!item) return res.status(404).json({ error: "Board item not found" });

    // ── 3. Check for duplicate log (belt-and-suspenders before DB unique index) ─
    const [existingLog] = await db
      .select({ id: macroLogs.id })
      .from(macroLogs)
      .where(sql`${macroLogs.boardItemReference} = ${itemId}`)
      .limit(1);

    if (existingLog) {
      return res.status(409).json({
        error: "Board item has already been logged",
        code: "ALREADY_LOGGED",
        boardItemReference: itemId,
        existingLogId: existingLog.id,
      });
    }

    // ── 4. Extract macros from the board item ────────────────────────────────
    const mac = item.macros as Record<string, number> | null ?? {};
    const calories      = Number(mac.kcal    ?? mac.calories ?? 0);
    const protein       = Number(mac.protein  ?? 0);
    const carbs         = Number(mac.carbs    ?? 0);
    const fat           = Number(mac.fat      ?? 0);
    const starchyCarbs  = mac.starchyCarbs != null ? Number(mac.starchyCarbs) : null;
    const fibrousCarbs  = mac.fibrousCarbs != null ? Number(mac.fibrousCarbs) : null;

    // ── 5. Write the macro log with board_item_reference ─────────────────────
    const { writeMacroLog } = await import("../services/macroLogService");
    const logRow = await writeMacroLog({
      userId:               authUserId,
      calories,
      protein,
      carbohydrates:        carbs,
      fat,
      starchyCarbs,
      fibrousCarbs,
      classificationSource: "ingredient",
      source:               String(source || "board"),
      dateIso:              dateIso || new Date().toISOString(),
      boardItemReference:   itemId,
    });

    logActivityFireAndForget(
      authUserId,
      authUserId,
      "board_item_logged",
      "meal_board_item",
      itemId,
      { boardId, macros: mac, title: item.title },
    );

    return res.json({ ok: true, logRow, boardItemReference: itemId });
  } catch (err: any) {
    if (err?.code === "ALREADY_LOGGED") {
      return res.status(409).json({
        error: "Board item has already been logged",
        code: "ALREADY_LOGGED",
        boardItemReference: err.boardItemReference,
      });
    }
    console.error("Error logging board item:", err);
    return res.status(500).json({ error: "Failed to log board item" });
  }
});

// Commit board to shopping list + macros
router.post("/boards/:boardId/commit", async (req, res) => {
  try {
    const { boardId } = req.params;
    const { scope, dayIndex } = req.body as { scope: "day" | "week"; dayIndex?: number };

    const [board] = await db.select().from(mealBoards).where(eq(mealBoards.id, boardId)).limit(1);
    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    const items = await db.select().from(mealBoardItems).where(eq(mealBoardItems.boardId, boardId));

    const chosenDays = scope === "day" && typeof dayIndex === "number"
      ? [dayIndex]
      : Array.from({ length: board.days }, (_, i) => i);

    const selectedItems = items.filter(i => chosenDays.includes(i.dayIndex));
    
    const totals = selectedItems.reduce((a, i) => {
      const macros = i.macros as any;
      return {
        kcal: a.kcal + (macros.kcal || 0),
        protein: a.protein + (macros.protein || 0),
        carbs: a.carbs + (macros.carbs || 0),
        fat: a.fat + (macros.fat || 0),
      };
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const byDay = new Map<number, { macros: any; items: any[] }>();
    for (const d of chosenDays) {
      byDay.set(d, { macros: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, items: [] });
    }

    for (const item of selectedItems) {
      const bucket = byDay.get(item.dayIndex)!;
      const macros = item.macros as any;
      bucket.items.push(item);
      bucket.macros.kcal += macros.kcal || 0;
      bucket.macros.protein += macros.protein || 0;
      bucket.macros.carbs += macros.carbs || 0;
      bucket.macros.fat += macros.fat || 0;
    }

    // TODO: Wire to existing shopping list and food logs services
    console.log("Board commit:", { scope, totals, itemCount: selectedItems.length });

    logActivityFireAndForget(
      board.userId,
      board.userId,
      "board_updated",
      "meal_board",
      board.id,
      { action: "commit", scope, totals, itemCount: selectedItems.length }
    );

    res.json({
      ok: true,
      totals,
      byDay: Array.from(byDay.entries()).map(([dayIndex, v]) => ({ dayIndex, ...v }))
    });
  } catch (error) {
    console.error("Error committing board:", error);
    res.status(500).json({ error: "Failed to commit board" });
  }
});

export default router;
