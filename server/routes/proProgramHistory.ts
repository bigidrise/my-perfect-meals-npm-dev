import { Router } from "express";
import { requireBoardAccess, BoardAccessRequest } from "../middleware/requireBoardAccess";
import { db } from "../db";
import { macroProgramHistory } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get(
  "/clients/:clientId/program-history",
  requireBoardAccess,
  async (req: BoardAccessRequest, res) => {
    try {
      const clientUserId = req.boardAccess!.clientUserId;

      const history = await db
        .select()
        .from(macroProgramHistory)
        .where(eq(macroProgramHistory.clientUserId, clientUserId))
        .orderBy(desc(macroProgramHistory.createdAt))
        .limit(20);

      res.json({ history });
    } catch (error: any) {
      console.error("Pro program history fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch program history",
        detail: error?.message,
      });
    }
  },
);

export default router;
