import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { glp1Shots } from "../db/schema/glp1Shots";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireOrgFlag } from "../middleware/requireOrgFlag";

const router = Router();

// P3.3 — org flag gate: every GLP-1 route requires glp1Support.
// Default org has glp1Support=true; white-label orgs can disable it.
// requireAuth must have already set req.orgContext before this runs.
router.use(requireAuth, requireOrgFlag("glp1Support"));

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
router.get("/users/:userId/glp1-shots", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { start, end, limit = "50" } = req.query;

    const conditions = [eq(glp1Shots.userId, userId)];
    if (start) {
      conditions.push(gte(glp1Shots.dateUtc, new Date(start as string)));
    }
    if (end) {
      conditions.push(lte(glp1Shots.dateUtc, new Date(end as string)));
    }

    const shots = await db
      .select()
      .from(glp1Shots)
      .where(and(...conditions))
      .orderBy(desc(glp1Shots.dateUtc))
      .limit(Math.min(Number(limit), 200));

    res.json(shots);
  } catch (error) {
    console.error("Error fetching GLP-1 shots:", error);
    res.status(500).json({ error: "Failed to fetch shots" });
  }
});

// POST /api/users/:userId/glp1-shots
router.post("/users/:userId/glp1-shots", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const data = createShotSchema.parse(req.body);

    const [newShot] = await db
      .insert(glp1Shots)
      .values({ userId, ...data, dateUtc: new Date(data.dateUtc) })
      .returning();

    res.json(newShot);
  } catch (error) {
    console.error("Error creating GLP-1 shot:", error);
    res.status(400).json({ error: "Failed to create shot" });
  }
});

// PATCH /api/users/:userId/glp1-shots/:shotId
router.patch("/users/:userId/glp1-shots/:shotId", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId, shotId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const data = updateShotSchema.parse(req.body);
    const updateData: any = { ...data };
    if (data.dateUtc) updateData.dateUtc = new Date(data.dateUtc);

    const [updated] = await db
      .update(glp1Shots)
      .set(updateData)
      .where(and(eq(glp1Shots.id, shotId), eq(glp1Shots.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Shot not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating GLP-1 shot:", error);
    res.status(400).json({ error: "Failed to update shot" });
  }
});

// DELETE /api/users/:userId/glp1-shots/:shotId
router.delete("/users/:userId/glp1-shots/:shotId", requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { userId, shotId } = req.params;
    if (userId !== authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [deleted] = await db
      .delete(glp1Shots)
      .where(and(eq(glp1Shots.id, shotId), eq(glp1Shots.userId, userId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Shot not found" });
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting GLP-1 shot:", error);
    res.status(500).json({ error: "Failed to delete shot" });
  }
});

export default router;
