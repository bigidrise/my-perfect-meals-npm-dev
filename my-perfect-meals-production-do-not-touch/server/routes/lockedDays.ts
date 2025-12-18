import { Router } from "express";
import { db } from "../db";
import { lockedDays } from "../../shared/biometricsSchema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

const slotMacrosSchema = z.object({
  count: z.number(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});

const lockDaySchema = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targets: z.object({
    calories: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  consumed: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
  slots: z.object({
    breakfast: slotMacrosSchema,
    lunch: slotMacrosSchema,
    dinner: slotMacrosSchema,
    snacks: slotMacrosSchema,
  }),
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;
    
    const results = await db
      .select()
      .from(lockedDays)
      .where(eq(lockedDays.userId, userId));
    
    const map: Record<string, any> = {};
    for (const row of results) {
      map[row.dateISO] = {
        dateISO: row.dateISO,
        lockedAt: row.lockedAt.toISOString(),
        targets: row.targets,
        consumed: row.consumed,
        slots: row.slots,
      };
    }
    
    res.json({ lockedDays: map });
  } catch (error) {
    console.error("Error fetching locked days:", error);
    res.status(500).json({ error: "Failed to fetch locked days" });
  }
});

router.get("/check", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;
    const dateISO = req.query.dateISO as string;
    
    if (!dateISO) {
      return res.status(400).json({ error: "dateISO required" });
    }
    
    const result = await db
      .select()
      .from(lockedDays)
      .where(and(eq(lockedDays.userId, userId), eq(lockedDays.dateISO, dateISO)))
      .limit(1);
    
    res.json({ locked: result.length > 0 });
  } catch (error) {
    console.error("Error checking locked day:", error);
    res.status(500).json({ error: "Failed to check locked day" });
  }
});

router.get("/week", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;
    const weekStartISO = req.query.weekStartISO as string;
    
    if (!weekStartISO) {
      return res.status(400).json({ error: "weekStartISO required" });
    }
    
    const allLocked = await db
      .select()
      .from(lockedDays)
      .where(eq(lockedDays.userId, userId));
    
    const start = new Date(weekStartISO + 'T00:00:00');
    const weekDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      weekDays.push(d.toISOString().slice(0, 10));
    }
    
    const lockedInWeek = allLocked
      .filter(row => weekDays.includes(row.dateISO))
      .map(row => row.dateISO);
    
    res.json({ 
      lockedDays: lockedInWeek,
      hasLockedDays: lockedInWeek.length > 0
    });
  } catch (error) {
    console.error("Error checking week locked days:", error);
    res.status(500).json({ error: "Failed to check week locked days" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;
    
    const parsed = lockDaySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    }
    
    const { dateISO, targets, consumed, slots } = parsed.data;
    
    const existing = await db
      .select()
      .from(lockedDays)
      .where(and(eq(lockedDays.userId, userId), eq(lockedDays.dateISO, dateISO)))
      .limit(1);
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: "Day already locked",
        alreadyLocked: true
      });
    }
    
    await db.insert(lockedDays).values({
      userId,
      dateISO,
      targets,
      consumed,
      slots,
    });
    
    console.log(`✅ Day locked for user ${userId}: ${dateISO}`);
    
    res.json({ 
      success: true, 
      message: "Day saved to biometrics and locked."
    });
  } catch (error) {
    console.error("Error locking day:", error);
    res.status(500).json({ error: "Failed to lock day" });
  }
});

router.delete("/", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;
    const dateISO = req.query.dateISO as string;
    
    if (!dateISO) {
      return res.status(400).json({ error: "dateISO required" });
    }
    
    await db
      .delete(lockedDays)
      .where(and(eq(lockedDays.userId, userId), eq(lockedDays.dateISO, dateISO)));
    
    console.log(`✅ Day unlocked for user ${userId}: ${dateISO}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error unlocking day:", error);
    res.status(500).json({ error: "Failed to unlock day" });
  }
});

export default router;
