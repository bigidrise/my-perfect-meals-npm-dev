import express from "express";
import { db } from "../db";
import { waterLogs } from "../../shared/schema";
import { and, eq, gt, lte, desc, lt } from "drizzle-orm";

const router = express.Router();

function parseTimeFromTextToToday(text: string, today = new Date()): Date | null {
  const twelve = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([AaPp][Mm])\b/);
  if (twelve) {
    let h = parseInt(twelve[1], 10);
    const m = twelve[2] ? parseInt(twelve[2], 10) : 0;
    const ap = twelve[3].toLowerCase();
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const d = new Date(today); d.setHours(h, m, 0, 0);
    return d;
  }
  const twentyFour = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    const h = parseInt(twentyFour[1], 10);
    const m = parseInt(twentyFour[2], 10);
    const d = new Date(today); d.setHours(h, m, 0, 0);
    return d;
  }
  const loose = text.match(/\bat\s*(1[0-2]|0?[1-9])\s*([AaPp][Mm])\b/);
  if (loose) {
    let h = parseInt(loose[1], 10);
    const ap = loose[2].toLowerCase();
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const d = new Date(today); d.setHours(h, 0, 0, 0);
    return d;
  }
  return null;
}

function toMl(amount: number, unit: string) {
  const u = unit.toLowerCase();
  if (u === "ml") return Math.round(amount);
  if (u === "oz" || u === "fl oz" || u === "fluid ounce" || u === "fluid ounces") return Math.round(amount * 29.5735);
  if (u === "cup" || u === "cups") return Math.round(amount * 236.588);
  return Math.round(amount); // default
}

// POST /api/water-logs { userId, amount, unit, note?, intakeTimeISO?, freeText? }
router.post("/water-logs", async (req, res) => {
  try {
    const { userId, amount, unit = "ml", intakeTimeISO, freeText } = req.body as {
      userId: string; amount: number; unit?: string; intakeTimeISO?: string; freeText?: string;
    };

    if (!userId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: "userId and positive amount required" });
    }

    let intake = intakeTimeISO ? new Date(intakeTimeISO) : null;
    if (!intake && freeText) intake = parseTimeFromTextToToday(freeText);
    if (!intake) intake = new Date();

    const rowToInsert = {
      userId,
      amountMl: toMl(Number(amount), unit),
      unit: unit.toLowerCase(),
      intakeTime: intake,
    };

    const [row] = await db.insert(waterLogs).values(rowToInsert).returning();

    // Debug print so you can see exactly what's saved
    console.log("[water-log][create]", { body: req.body, saved: row });

    res.json(row);
  } catch (e: any) {
    console.error("create water-log error", e);
    return res.status(500).json({ error: "Failed to create water log" });
  }
});

// GET /api/water-logs?userId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=50&cursor=<ISO>
router.get("/water-logs", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    const fromStr = (req.query.from as string) || null;
    const toStr = (req.query.to as string) || null;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const cursor = (req.query.cursor as string) || null;

    const from = fromStr ? new Date(fromStr + "T00:00:00") : new Date("1970-01-01");
    const to = toStr ? new Date(toStr + "T23:59:59") : new Date("2999-12-31");

    const whereParts: any[] = [eq(waterLogs.userId, userId), gt(waterLogs.intakeTime, from), lte(waterLogs.intakeTime, to)];
    if (cursor) whereParts.push(lt(waterLogs.intakeTime, new Date(cursor)));

    const rows = await db.select().from(waterLogs)
      .where(and(...whereParts))
      .orderBy(desc(waterLogs.intakeTime))
      .limit(limit + 1);

    let nextCursor: string | undefined;
    if (rows.length > limit) {
      nextCursor = rows[limit - 1].intakeTime.toISOString();
      rows.length = limit;
    }

    res.json({ items: rows, nextCursor });
  } catch (e: any) {
    console.error("get water-logs error", e);
    res.status(500).json({ error: "Failed to fetch water logs" });
  }
});

export default router;