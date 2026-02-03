
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { mealBoards, mealBoardItems } from "../db/schema/mealBoards";
import { eq, and, desc } from "drizzle-orm";
import { logActivityFireAndForget } from "../services/activityLog";
import { enforceBuilderFromParam } from "../middleware/studioAccess";

const router = Router();

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

    res.json(item);
  } catch (error) {
    console.error("Error adding board item:", error);
    res.status(400).json({ error: "Failed to add item" });
  }
});

// Delete item from board
router.delete("/boards/:boardId/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId));
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

    res.json({ ok: true });
  } catch (error) {
    console.error("Error repeating day:", error);
    res.status(500).json({ error: "Failed to repeat day" });
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
