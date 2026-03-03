import { Router } from "express";
import { requireBoardAccess, BoardAccessRequest } from "../middleware/requireBoardAccess";
import { db } from "../db";
import { biometricSample } from "../../shared/biometricsSchema";
import { eq, and, gte, desc } from "drizzle-orm";

const router = Router();

router.get(
  "/clients/:clientId/biometrics/weight",
  requireBoardAccess,
  async (req: BoardAccessRequest, res) => {
    try {
      const clientUserId = req.boardAccess!.clientUserId;
      const range = String(req.query.range ?? "365d");

      const daysMatch = range.match(/^(\d+)d$/);
      const days = daysMatch ? parseInt(daysMatch[1]) : 365;

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const weights = await db
        .select()
        .from(biometricSample)
        .where(
          and(
            eq(biometricSample.userId, clientUserId as any),
            eq(biometricSample.type, "weight"),
            gte(biometricSample.startTime, fromDate),
          ),
        )
        .orderBy(desc(biometricSample.startTime));

      const history = weights.map((w) => ({
        id: w.id,
        date: w.startTime.toISOString().slice(0, 10),
        weight: w.value,
        unit: w.unit,
        measuredAt: w.startTime.toISOString(),
      }));

      res.json({
        history,
        latest: history[0] || null,
        count: history.length,
      });
    } catch (error: any) {
      console.error("Pro weight fetch error:", error);
      res.status(500).json({
        error: "Failed to fetch client weight history",
        detail: error?.message,
      });
    }
  },
);

export default router;
