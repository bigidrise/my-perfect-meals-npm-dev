import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { glp1Shots } from "../db/schema/glp1Shots";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const router = Router();

const createShotSchema = z.object({
  dateUtc: z.string().datetime(),
  doseMg: z.number().positive(),
  location: z.enum(["abdomen", "thigh", "upper_arm", "buttock"]).optional(),
  notes: z.string().optional(),
});

const updateShotSchema = z.object({
  dateUtc: z.string().datetime().optional(),
  doseMg: z.number().positive().optional(),
  location: z.enum(["abdomen", "thigh", "upper_arm", "buttock"]).optional(),
  notes: z.string().optional(),
});

// GET /api/users/:userId/glp1-shots
router.get("/users/:userId/glp1-shots", async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end, limit = "50" } = req.query;

    const conditions = [eq(glp1Shots.userId, userId)];
    
    if (start) {
      conditions.push(gte(glp1Shots.dateUtc, new Date(start as string)));
    }
    if (end) {
      conditions.push(lte(glp1Shots.dateUtc, new Date(end as string)));
    }

    const shots = await db.select()
      .from(glp1Shots)
      .where(and(...conditions))
      .orderBy(desc(glp1Shots.dateUtc))
      .limit(parseInt(limit as string));

    res.json({ items: shots });
  } catch (error) {
    console.error("Error fetching GLP-1 shots:", error);
    res.status(500).json({ error: "Failed to fetch shots" });
  }
});

// POST /api/users/:userId/glp1-shots
router.post("/users/:userId/glp1-shots", async (req, res) => {
  try {
    const { userId } = req.params;
    const data = createShotSchema.parse(req.body);

    const [shot] = await db.insert(glp1Shots).values({
      userId,
      dateUtc: new Date(data.dateUtc),
      doseMg: data.doseMg.toString(),
      location: data.location,
      notes: data.notes,
    }).returning();

    res.json(shot);
  } catch (error) {
    console.error("Error creating GLP-1 shot:", error);
    res.status(400).json({ error: "Failed to create shot" });
  }
});

// PATCH /api/users/:userId/glp1-shots/:shotId
router.patch("/users/:userId/glp1-shots/:shotId", async (req, res) => {
  try {
    const { userId, shotId } = req.params;
    const data = updateShotSchema.parse(req.body);

    const updateData: any = {};
    if (data.dateUtc) updateData.dateUtc = new Date(data.dateUtc);
    if (data.doseMg) updateData.doseMg = data.doseMg.toString();
    if (data.location !== undefined) updateData.location = data.location;
    if (data.notes !== undefined) updateData.notes = data.notes;
    updateData.updatedAt = new Date();

    const [shot] = await db.update(glp1Shots)
      .set(updateData)
      .where(and(eq(glp1Shots.id, shotId), eq(glp1Shots.userId, userId)))
      .returning();

    if (!shot) {
      return res.status(404).json({ error: "Shot not found" });
    }

    res.json(shot);
  } catch (error) {
    console.error("Error updating GLP-1 shot:", error);
    res.status(400).json({ error: "Failed to update shot" });
  }
});

// DELETE /api/users/:userId/glp1-shots/:shotId
router.delete("/users/:userId/glp1-shots/:shotId", async (req, res) => {
  try {
    const { userId, shotId } = req.params;

    const [deleted] = await db.delete(glp1Shots)
      .where(and(eq(glp1Shots.id, shotId), eq(glp1Shots.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Shot not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting GLP-1 shot:", error);
    res.status(500).json({ error: "Failed to delete shot" });
  }
});

export default router;