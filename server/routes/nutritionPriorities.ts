import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { users, householdProfiles } from "@shared/schema";
import {
  createFoodInclusionPrioritiesDocument,
  emptyFoodInclusionPrioritiesDocument,
  foodInclusionPrioritiesWriteSchema,
  normalizeFoodInclusionPrioritiesDocument,
} from "../../shared/nutritionPriorities";
import { loadOwnedActiveChildProfile } from "../services/pediatric/authoritativeChildAccess";

const router = Router();
const uuidSchema = z.string().uuid();

function actorId(req: AuthenticatedRequest): string | null {
  return req.authUser?.id ?? null;
}

function parseWrite(body: unknown) {
  const candidate = body && typeof body === "object"
    ? { ...(body as Record<string, unknown>) }
    : body;
  if (candidate && typeof candidate === "object") {
    delete (candidate as Record<string, unknown>).userId;
    delete (candidate as Record<string, unknown>).actorUserId;
    delete (candidate as Record<string, unknown>).subjectUserId;
    delete (candidate as Record<string, unknown>).updatedAt;
  }
  return foodInclusionPrioritiesWriteSchema.safeParse(candidate);
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const [user] = await db.select({
      document: users.foodInclusionPriorities,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "Subject not found" });
    return res.json({ document: normalizeFoodInclusionPrioritiesDocument(user.document) });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities are temporarily unavailable." });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const parsed = parseWrite(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid Nutrition Priorities document", details: parsed.error.issues });
    const document = createFoodInclusionPrioritiesDocument(parsed.data);
    const [updated] = await db.update(users)
      .set({ foodInclusionPriorities: document })
      .where(eq(users.id, userId))
      .returning({ document: users.foodInclusionPriorities });
    if (!updated) return res.status(404).json({ error: "Subject not found" });
    return res.json({ document: updated.document ?? document });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities could not be saved." });
  }
});

router.get("/household/:profileId", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    const profileId = uuidSchema.safeParse(req.params.profileId);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    if (!profileId.success) return res.status(400).json({ error: "Invalid subject ID" });
    const [profile] = await db.select({
      document: householdProfiles.foodInclusionPriorities,
    }).from(householdProfiles).where(and(
      eq(householdProfiles.id, profileId.data),
      eq(householdProfiles.ownerUserId, userId),
    )).limit(1);
    if (!profile) return res.status(404).json({ error: "Subject not found" });
    return res.json({ document: normalizeFoodInclusionPrioritiesDocument(profile.document) });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities are temporarily unavailable." });
  }
});

router.put("/household/:profileId", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    const profileId = uuidSchema.safeParse(req.params.profileId);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    if (!profileId.success) return res.status(400).json({ error: "Invalid subject ID" });
    const parsed = parseWrite(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid Nutrition Priorities document", details: parsed.error.issues });
    const document = createFoodInclusionPrioritiesDocument(parsed.data);
    const [updated] = await db.update(householdProfiles)
      .set({ foodInclusionPriorities: document, updatedAt: new Date() })
      .where(and(
        eq(householdProfiles.id, profileId.data),
        eq(householdProfiles.ownerUserId, userId),
      ))
      .returning({ document: householdProfiles.foodInclusionPriorities });
    if (!updated) return res.status(404).json({ error: "Subject not found" });
    return res.json({ document: updated.document ?? document });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities could not be saved." });
  }
});

router.get("/child/:childProfileId", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    const childId = uuidSchema.safeParse(req.params.childProfileId);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    if (!childId.success) return res.status(400).json({ error: "Invalid subject ID" });
    const child = await loadOwnedActiveChildProfile(userId, childId.data);
    if (!child) return res.status(404).json({ error: "Subject not found" });
    return res.json({
      document: normalizeFoodInclusionPrioritiesDocument(child.food_inclusion_priorities),
    });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities are temporarily unavailable." });
  }
});

router.put("/child/:childProfileId", requireAuth, async (req, res) => {
  try {
    const userId = actorId(req as AuthenticatedRequest);
    const childId = uuidSchema.safeParse(req.params.childProfileId);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    if (!childId.success) return res.status(400).json({ error: "Invalid subject ID" });
    const parsed = parseWrite(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid Nutrition Priorities document", details: parsed.error.issues });
    const child = await loadOwnedActiveChildProfile(userId, childId.data);
    if (!child) return res.status(404).json({ error: "Subject not found" });
    const document = createFoodInclusionPrioritiesDocument(parsed.data);
    const result = await db.execute(sql`
      UPDATE child_profiles
      SET food_inclusion_priorities = ${JSON.stringify(document)}::jsonb,
          updated_at = NOW()
      WHERE id = ${child.id}
        AND user_id = ${userId}
        AND is_archived = false
      RETURNING id
    `);
    const rows = (result as any).rows ?? [];
    if (rows.length === 0) return res.status(404).json({ error: "Subject not found" });
    return res.json({ document });
  } catch {
    return res.status(503).json({ error: "Nutrition Priorities could not be saved." });
  }
});

export default router;