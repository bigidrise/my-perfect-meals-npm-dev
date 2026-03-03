import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireBoardAccess, BoardAccessRequest } from "../middleware/requireBoardAccess";
import { getWeekStartISO, isValidISODate } from "../utils/week";
import { getWeekBoard, upsertWeekBoard } from "../data/weekBoardsRepo";
import { processMealImageForSave } from "../services/imageLifecycle";
import { logActivityFireAndForget } from "../services/activityLog";

type WeekBoard = {
  id: string;
  version: number;
  lists: { breakfast: any[]; lunch: any[]; dinner: any[]; snacks: any[] };
  meta: { createdAt: string; lastUpdatedAt: string };
};

function getOrCreateWeek(weekStartISO: string): WeekBoard {
  return {
    id: `week-${weekStartISO}`,
    version: 1,
    lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    meta: {
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

function normalizeBoard(raw: any): any {
  const base = raw ?? {};
  const lists = base.lists ?? {};

  const normalizeMealArray = (arr: any): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((m: any, idx: number) => ({
      id: String(m?.id ?? `m-${idx}`),
      title: String(m?.title ?? "Untitled"),
      servings: Number(m?.servings ?? 1),
      ingredients: Array.isArray(m?.ingredients)
        ? m.ingredients.map((i: any) => ({
            item: String(i?.item ?? i?.name ?? ""),
            amount: String(i?.amount ?? i?.quantity ?? ""),
            unit: String(i?.unit ?? ""),
          }))
        : [],
      instructions:
        typeof m?.instructions === "string"
          ? m.instructions
          : Array.isArray(m?.instructions)
            ? m.instructions.map((s: any) => String(s))
            : [],
      nutrition: {
        calories: Number(m?.nutrition?.calories ?? m?.calories ?? 0),
        protein: Number(m?.nutrition?.protein ?? m?.protein ?? 0),
        carbs: Number(m?.nutrition?.carbs ?? m?.carbs ?? 0),
        fat: Number(m?.nutrition?.fat ?? m?.fat ?? 0),
      },
      badges: Array.isArray(m?.badges) ? m.badges.map(String) : undefined,
      technique: m?.technique ? String(m.technique) : undefined,
      cuisine: m?.cuisine ? String(m.cuisine) : undefined,
      orderIndex: typeof m?.orderIndex === "number" ? m.orderIndex : undefined,
      name: m?.name ? String(m.name) : undefined,
      description: m?.description ? String(m.description) : undefined,
      imageUrl: m?.imageUrl ? String(m.imageUrl) : undefined,
      cookingTime: m?.cookingTime ? String(m.cookingTime) : undefined,
      difficulty: m?.difficulty ? String(m.difficulty) : undefined,
      medicalBadges: Array.isArray(m?.medicalBadges)
        ? m.medicalBadges
        : undefined,
    }));
  };

  const normalized: any = {
    id: base.id ?? "default",
    version: Number(base.version ?? 1),
    lists: {
      breakfast: normalizeMealArray(lists.breakfast),
      lunch: normalizeMealArray(lists.lunch),
      dinner: normalizeMealArray(lists.dinner),
      snacks: normalizeMealArray(lists.snacks),
    },
    meta: {
      ...(base.meta ?? {}),
      createdAt: base.meta?.createdAt ?? new Date().toISOString(),
      lastUpdatedAt: base.meta?.lastUpdatedAt ?? new Date().toISOString(),
    },
  };

  if (base.days && typeof base.days === "object") {
    normalized.days = {};
    for (const [dateKey, dayVal] of Object.entries(base.days as Record<string, any>)) {
      normalized.days[dateKey] = {
        breakfast: normalizeMealArray(dayVal?.breakfast),
        lunch: normalizeMealArray(dayVal?.lunch),
        dinner: normalizeMealArray(dayVal?.dinner),
        snacks: normalizeMealArray(dayVal?.snacks),
      };
    }
  }

  return normalized;
}

async function processAllMealImagesForSave(
  board: any
): Promise<{ board: any; imagesProcessed: number; imagesPending: number }> {
  let imagesProcessed = 0;
  let imagesPending = 0;

  const processMeals = async (meals: any[]) => {
    for (const meal of meals) {
      if (meal.imageUrl) {
        try {
          const result = await processMealImageForSave(meal.imageUrl);
          if (result.processed) {
            meal.imageUrl = result.url;
            imagesProcessed++;
          }
          if (result.pending) imagesPending++;
        } catch {
          imagesPending++;
        }
      }
    }
  };

  if (board.lists) {
    await processMeals(board.lists.breakfast || []);
    await processMeals(board.lists.lunch || []);
    await processMeals(board.lists.dinner || []);
    await processMeals(board.lists.snacks || []);
  }

  if (board.days) {
    for (const dayVal of Object.values(board.days as Record<string, any>)) {
      await processMeals(dayVal?.breakfast || []);
      await processMeals(dayVal?.lunch || []);
      await processMeals(dayVal?.dinner || []);
      await processMeals(dayVal?.snacks || []);
    }
  }

  return { board, imagesProcessed, imagesPending };
}

const router = Router();

router.get(
  "/week-boards/:clientId/current-week",
  requireAuth,
  requireBoardAccess,
  async (req: Request, res: Response) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const clientUserId = access.clientUserId;
      const weekStartISO = getWeekStartISO();

      let board = await getWeekBoard(clientUserId, weekStartISO);
      if (!board) {
        board = getOrCreateWeek(weekStartISO);
        await upsertWeekBoard(clientUserId, weekStartISO, board);
      }

      return res.json({ weekStartISO, week: normalizeBoard(board), source: "db" });
    } catch (error) {
      console.error("Pro week board GET current-week error:", error);
      return res.status(500).json({ error: "Failed to load week board" });
    }
  }
);

router.get(
  "/week-board/:clientId/:weekStartISO",
  requireAuth,
  requireBoardAccess,
  async (req: Request, res: Response) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const clientUserId = access.clientUserId;
      const { weekStartISO } = req.params;

      if (!isValidISODate(weekStartISO)) {
        return res.status(400).json({ error: "Invalid weekStartISO format (YYYY-MM-DD)" });
      }

      let board = await getWeekBoard(clientUserId, weekStartISO);
      if (!board) {
        board = getOrCreateWeek(weekStartISO);
        await upsertWeekBoard(clientUserId, weekStartISO, board);
      }

      return res.json({ weekStartISO, week: normalizeBoard(board), source: "db" });
    } catch (error) {
      console.error("Pro week board GET by date error:", error);
      return res.status(500).json({ error: "Failed to load week board" });
    }
  }
);

router.get(
  "/weekly-board/:clientId",
  requireAuth,
  requireBoardAccess,
  async (req: Request, res: Response) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const clientUserId = access.clientUserId;
      const weekParam = req.query.week as string | undefined;
      const weekStartISO =
        weekParam && isValidISODate(weekParam) ? weekParam : getWeekStartISO();

      let board = await getWeekBoard(clientUserId, weekStartISO);
      let source = "db";

      if (!board) {
        board = getOrCreateWeek(weekStartISO);
        await upsertWeekBoard(clientUserId, weekStartISO, board);
        source = "seed";
      }

      return res.json({ weekStartISO, week: normalizeBoard(board), source });
    } catch (error) {
      console.error("Pro weekly-board GET error:", error);
      return res.status(500).json({ error: "Failed to load weekly board" });
    }
  }
);

router.put(
  "/week-board/:clientId/:weekStartISO",
  requireAuth,
  requireBoardAccess,
  async (req: Request, res: Response) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const clientUserId = access.clientUserId;
      const { weekStartISO } = req.params;

      if (!isValidISODate(weekStartISO)) {
        return res.status(400).json({ error: "Invalid weekStartISO format (YYYY-MM-DD)" });
      }

      const incoming = normalizeBoard(req.body?.week ?? req.body);

      const {
        board: processedBoard,
        imagesProcessed,
        imagesPending,
      } = await processAllMealImagesForSave(incoming);

      if (imagesProcessed > 0) {
        console.log(
          `Pro: Processed ${imagesProcessed} images (${imagesPending} pending) for client ${clientUserId} week ${weekStartISO}`
        );
      }

      const now = new Date().toISOString();
      const existingBoard = await getWeekBoard(clientUserId, weekStartISO);
      const saved: WeekBoard = {
        ...processedBoard,
        id: `week-${weekStartISO}`,
        meta: {
          ...existingBoard?.meta,
          ...processedBoard.meta,
          createdAt: existingBoard?.meta?.createdAt ?? now,
          lastUpdatedAt: now,
        },
      };

      await upsertWeekBoard(clientUserId, weekStartISO, saved);

      logActivityFireAndForget(
        access.proUserId,
        clientUserId,
        "board_updated",
        "weekly_board",
        `week-${weekStartISO}`,
        { weekStartISO, imagesProcessed, imagesPending, updatedBy: "pro" }
      );

      return res.json({
        weekStartISO,
        week: normalizeBoard(saved),
        source: "db",
        imagesProcessed,
        imagesPending,
      });
    } catch (error) {
      console.error("Pro week board PUT error:", error);
      return res.status(500).json({ error: "Failed to save week board" });
    }
  }
);

router.put(
  "/weekly-board/:clientId",
  requireAuth,
  requireBoardAccess,
  async (req: Request, res: Response) => {
    try {
      const access = (req as BoardAccessRequest).boardAccess!;
      const clientUserId = access.clientUserId;
      const weekParam = req.query.week as string | undefined;
      const weekStartISO =
        weekParam && isValidISODate(weekParam) ? weekParam : getWeekStartISO();

      const incoming = normalizeBoard(req.body?.week ?? req.body);

      const {
        board: processedBoard,
        imagesProcessed,
        imagesPending,
      } = await processAllMealImagesForSave(incoming);

      if (imagesProcessed > 0) {
        console.log(
          `Pro: Processed ${imagesProcessed} images (${imagesPending} pending) for client ${clientUserId} weekly board ${weekStartISO}`
        );
      }

      const now = new Date().toISOString();
      const existingBoard = await getWeekBoard(clientUserId, weekStartISO);
      const saved: WeekBoard = {
        ...processedBoard,
        id: `week-${weekStartISO}`,
        meta: {
          ...existingBoard?.meta,
          ...processedBoard.meta,
          createdAt: existingBoard?.meta?.createdAt ?? now,
          lastUpdatedAt: now,
        },
      };

      await upsertWeekBoard(clientUserId, weekStartISO, saved);

      logActivityFireAndForget(
        access.proUserId,
        clientUserId,
        "board_updated",
        "weekly_board",
        `week-${weekStartISO}`,
        { weekStartISO, imagesProcessed, imagesPending, updatedBy: "pro" }
      );

      return res.json({
        weekStartISO,
        week: normalizeBoard(saved),
        source: "db",
        imagesProcessed,
        imagesPending,
      });
    } catch (error) {
      console.error("Pro weekly-board PUT error:", error);
      return res.status(500).json({ error: "Failed to save weekly board" });
    }
  }
);

export default router;
