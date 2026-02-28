import { Router } from "express";
import { db } from "../db";
import { mealBoards, mealBoardItems } from "../db/schema/mealBoards";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireBoardAccess, BoardAccessRequest } from "../middleware/requireBoardAccess";
import { logActivityFireAndForget } from "../services/activityLog";

const router = Router();

router.get(
  "/clients/:clientId/boards/:program/current",
  requireAuth,
  requireBoardAccess,
  async (req, res) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const { program } = req.params;
      const { days = "7", start } = req.query as { days?: string; start?: string };

      if (!access.permissions.canViewMacros && access.role !== "client") {
        return res.status(403).json({ error: "Permission denied: cannot view this board" });
      }

      const startDate = start ? new Date(start) : new Date();
      startDate.setHours(0, 0, 0, 0);

      let [board] = await db
        .select()
        .from(mealBoards)
        .where(
          and(
            eq(mealBoards.userId, access.clientUserId),
            eq(mealBoards.program, program),
            eq(mealBoards.startDate, startDate)
          )
        )
        .limit(1);

      if (!board) {
        [board] = await db
          .insert(mealBoards)
          .values({
            userId: access.clientUserId,
            program,
            startDate,
            days: Number(days),
          })
          .returning();
      }

      const items = await db
        .select()
        .from(mealBoardItems)
        .where(eq(mealBoardItems.boardId, board.id))
        .orderBy(desc(mealBoardItems.createdAt));

      res.json({
        board,
        items,
        accessRole: access.role,
        permissions: access.permissions,
      });
    } catch (error) {
      console.error("Error fetching pro board:", error);
      res.status(500).json({ error: "Failed to fetch board" });
    }
  }
);

router.post(
  "/clients/:clientId/boards/:boardId/items",
  requireAuth,
  requireBoardAccess,
  async (req, res) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const authUser = (req as AuthenticatedRequest).authUser;

      if (!access.permissions.canAddMeals && access.role !== "client") {
        return res.status(403).json({ error: "Permission denied: cannot add meals" });
      }

      const { boardId } = req.params;
      const { dayIndex, slot, mealId, title, servings, macros, ingredients } = req.body;

      const [board] = await db
        .select()
        .from(mealBoards)
        .where(eq(mealBoards.id, boardId))
        .limit(1);

      if (!board || board.userId !== access.clientUserId) {
        return res.status(404).json({ error: "Board not found or access denied" });
      }

      const [item] = await db
        .insert(mealBoardItems)
        .values({
          boardId,
          dayIndex,
          slot,
          mealId,
          title,
          servings: servings ? servings.toString() : "1",
          macros,
          ingredients: ingredients || [],
        })
        .returning();

      await db
        .update(mealBoards)
        .set({
          lastUpdatedByUserId: authUser.id,
          lastUpdatedByRole: access.role,
          updatedAt: new Date(),
        })
        .where(eq(mealBoards.id, boardId));

      logActivityFireAndForget(
        access.clientUserId,
        authUser.id,
        "board_updated",
        "meal_board",
        boardId,
        { role: access.role, title, action: "item_added" }
      );

      res.json(item);
    } catch (error) {
      console.error("Error adding pro board item:", error);
      res.status(400).json({ error: "Failed to add item" });
    }
  }
);

router.delete(
  "/clients/:clientId/boards/:boardId/items/:itemId",
  requireAuth,
  requireBoardAccess,
  async (req, res) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const authUser = (req as AuthenticatedRequest).authUser;

      if (!access.permissions.canEditPlan && access.role !== "client") {
        return res.status(403).json({ error: "Permission denied: cannot edit plan" });
      }

      const { boardId, itemId } = req.params;

      const [board] = await db
        .select()
        .from(mealBoards)
        .where(eq(mealBoards.id, boardId))
        .limit(1);

      if (!board || board.userId !== access.clientUserId) {
        return res.status(404).json({ error: "Board not found or access denied" });
      }

      await db.delete(mealBoardItems).where(eq(mealBoardItems.id, itemId));

      await db
        .update(mealBoards)
        .set({
          lastUpdatedByUserId: authUser.id,
          lastUpdatedByRole: access.role,
          updatedAt: new Date(),
        })
        .where(eq(mealBoards.id, boardId));

      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting pro board item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  }
);

router.post(
  "/clients/:clientId/boards/:boardId/repeat-day",
  requireAuth,
  requireBoardAccess,
  async (req, res) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const authUser = (req as AuthenticatedRequest).authUser;

      if (!access.permissions.canEditPlan && access.role !== "client") {
        return res.status(403).json({ error: "Permission denied: cannot edit plan" });
      }

      const { boardId } = req.params;
      const { sourceDayIndex } = req.body as { sourceDayIndex: number };

      const [board] = await db
        .select()
        .from(mealBoards)
        .where(eq(mealBoards.id, boardId))
        .limit(1);

      if (!board || board.userId !== access.clientUserId) {
        return res.status(404).json({ error: "Board not found or access denied" });
      }

      const source = await db
        .select()
        .from(mealBoardItems)
        .where(and(eq(mealBoardItems.boardId, boardId), eq(mealBoardItems.dayIndex, sourceDayIndex)));

      const targets = Array.from({ length: board.days }, (_, d) => d).filter(
        (d) => d !== sourceDayIndex
      );

      for (const dayIndex of targets) {
        await db
          .delete(mealBoardItems)
          .where(and(eq(mealBoardItems.boardId, boardId), eq(mealBoardItems.dayIndex, dayIndex)));
      }

      const clones = targets.flatMap((d) =>
        source.map((s) => ({
          boardId,
          dayIndex: d,
          slot: s.slot,
          mealId: s.mealId,
          title: s.title,
          servings: s.servings,
          macros: s.macros,
          ingredients: s.ingredients,
        }))
      );

      if (clones.length) {
        await db.insert(mealBoardItems).values(clones);
      }

      await db
        .update(mealBoards)
        .set({
          lastUpdatedByUserId: authUser.id,
          lastUpdatedByRole: access.role,
          updatedAt: new Date(),
        })
        .where(eq(mealBoards.id, boardId));

      res.json({ ok: true });
    } catch (error) {
      console.error("Error repeating day on pro board:", error);
      res.status(500).json({ error: "Failed to repeat day" });
    }
  }
);

export default router;
