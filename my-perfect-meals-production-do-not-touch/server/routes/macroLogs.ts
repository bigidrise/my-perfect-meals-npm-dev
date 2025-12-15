import express from "express";
import { db } from "../db";
import { macroLogs, insertMacroLogSchema } from "../../shared/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";

const router = express.Router();

router.post("/macros", async (req, res) => {
  try {
    const validation = insertMacroLogSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.issues 
      });
    }

    const [row] = await db.insert(macroLogs).values(validation.data).returning();
    console.log("[macro-log][create]", { saved: row });
    
    res.json(row);
  } catch (e: any) {
    console.error("create macro-log error", e);
    return res.status(500).json({ error: "Failed to create macro log" });
  }
});

router.get("/macros", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId required" });

    const fromStr = (req.query.from as string) || null;
    const toStr = (req.query.to as string) || null;
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const cursor = (req.query.cursor as string) || null;

    const from = fromStr ? new Date(fromStr) : new Date("1970-01-01");
    const to = toStr ? new Date(toStr) : new Date("2999-12-31");

    const whereParts: any[] = [
      eq(macroLogs.userId, userId),
      gte(macroLogs.at, from),
      lte(macroLogs.at, to)
    ];
    
    // Compound cursor: timestamp,id to handle records with same timestamp
    if (cursor) {
      const [cursorAt, cursorId] = cursor.split(',');
      const cursorDate = new Date(cursorAt);
      const cursorIdNum = parseInt(cursorId, 10);
      
      whereParts.push(
        sql`(${macroLogs.at} < ${cursorDate} OR (${macroLogs.at} = ${cursorDate} AND ${macroLogs.id} < ${cursorIdNum}))`
      );
    }

    const rows = await db.select().from(macroLogs)
      .where(and(...whereParts))
      .orderBy(desc(macroLogs.at), desc(macroLogs.id))
      .limit(limit + 1);

    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const lastRow = rows[limit];
      nextCursor = `${lastRow.at.toISOString()},${lastRow.id}`;
      rows.length = limit;
    }

    res.json({ items: rows, nextCursor });
  } catch (e: any) {
    console.error("get macro-logs error", e);
    res.status(500).json({ error: "Failed to fetch macro logs" });
  }
});

export default router;
