import { Router } from "express";
import { db } from "../db";
import { mealBoards, mealBoardItems } from "../db/schema/mealBoards";
import { careTeamMember } from "../db/schema/careTeam";
import { clientNotes, studios } from "../db/schema/studio";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { requireBoardAccess, BoardAccessRequest } from "../middleware/requireBoardAccess";
import { logActivityFireAndForget } from "../services/activityLog";
import { pushToUser } from "../services/pushNotify";

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

router.patch(
  "/clients/:clientId/board-access",
  requireAuth,
  async (req, res) => {
    try {
      const authUser = (req as AuthenticatedRequest).authUser;
      const { clientId } = req.params;
      const { clientCanEdit } = req.body as { clientCanEdit: boolean };

      if (typeof clientCanEdit !== "boolean") {
        return res.status(400).json({ error: "clientCanEdit must be a boolean" });
      }

      const [relation] = await db
        .select()
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, clientId),
            eq(careTeamMember.proUserId, authUser.id),
            eq(careTeamMember.status, "active")
          )
        )
        .limit(1);

      if (!relation) {
        return res.status(403).json({ error: "No active relationship with this client" });
      }

      const now = new Date();
      const changedByRole = relation.role;

      await db
        .update(careTeamMember)
        .set({
          clientCanEdit,
          clientEditLastChangedAt: now,
          clientEditLastChangedByRole: changedByRole,
          updatedAt: now,
        })
        .where(eq(careTeamMember.id, relation.id));

      const accessLabel = clientCanEdit ? "Collaborative" : "Coach Managed";
      const notifyBody = clientCanEdit
        ? "Your coach enabled editing access on your shared meal plan."
        : "Your meal plan is now coach-managed.";

      const [studio] = await db
        .select({ id: studios.id })
        .from(studios)
        .where(eq(studios.ownerUserId, authUser.id))
        .limit(1);

      if (studio) {
        await db.insert(clientNotes).values({
          studioId: studio.id,
          clientUserId: clientId,
          authorUserId: authUser.id,
          entryType: "message",
          sender: "pro",
          visibility: "shared_with_client",
          body: notifyBody,
          tags: ["system:board_access_changed"],
        });
      }

      logActivityFireAndForget(
        clientId,
        authUser.id,
        "board_access_changed",
        "meal_board",
        relation.id,
        { clientCanEdit, accessLabel, changedByRole }
      );

      pushToUser(clientId, {
        title: "Shared Plan Access Updated",
        body: notifyBody,
        url: "/care-team/trainer",
      }).catch(() => {});

      return res.json({
        ok: true,
        clientCanEdit,
        clientEditLastChangedAt: now,
        clientEditLastChangedByRole: changedByRole,
      });
    } catch (error) {
      console.error("Error updating board access:", error);
      return res.status(500).json({ error: "Failed to update board access" });
    }
  }
);

router.get(
  "/clients/:clientId/board-access",
  requireAuth,
  async (req, res) => {
    try {
      const authUser = (req as AuthenticatedRequest).authUser;
      const { clientId } = req.params;

      const [relation] = await db
        .select({
          clientCanEdit: careTeamMember.clientCanEdit,
          clientEditLastChangedAt: careTeamMember.clientEditLastChangedAt,
          clientEditLastChangedByRole: careTeamMember.clientEditLastChangedByRole,
          role: careTeamMember.role,
        })
        .from(careTeamMember)
        .where(
          and(
            eq(careTeamMember.userId, clientId),
            eq(careTeamMember.proUserId, authUser.id),
            eq(careTeamMember.status, "active")
          )
        )
        .limit(1);

      if (!relation) {
        return res.status(403).json({ error: "No active relationship with this client" });
      }

      return res.json({
        clientCanEdit: relation.clientCanEdit,
        clientEditLastChangedAt: relation.clientEditLastChangedAt,
        clientEditLastChangedByRole: relation.clientEditLastChangedByRole,
      });
    } catch (error) {
      console.error("Error fetching board access:", error);
      return res.status(500).json({ error: "Failed to fetch board access" });
    }
  }
);

export default router;
