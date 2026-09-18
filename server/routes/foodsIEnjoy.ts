import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { users, householdProfiles } from "@shared/schema";
import {
  emptyFoodsIEnjoyDocument,
  foodsIEnjoyWriteSchema,
  type FoodsIEnjoyDocument,
} from "../../shared/foodsIEnjoy";

const router = Router();
export const householdFoodsIEnjoyRouter = Router();
const profileIdSchema = z.string().uuid();

function actorId(req: AuthenticatedRequest): string | null {
  return req.authUser?.id ?? null;
}

function parseDocument(body: unknown): { data?: FoodsIEnjoyDocument; issues?: unknown } {
  const candidate = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : body;
  if (candidate && typeof candidate === "object") {
    delete (candidate as Record<string, unknown>).userId;
    delete (candidate as Record<string, unknown>).actorUserId;
    delete (candidate as Record<string, unknown>).subjectUserId;
  }
  const parsed = foodsIEnjoyWriteSchema.safeParse(candidate);
  return parsed.success ? { data: parsed.data } : { issues: parsed.error.issues };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = actorId(req as AuthenticatedRequest);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  const [user] = await db
    .select({ foodsIEnjoy: users.foodsIEnjoy })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ document: user.foodsIEnjoy ?? emptyFoodsIEnjoyDocument() });
});

router.put("/", requireAuth, async (req, res) => {
  const userId = actorId(req as AuthenticatedRequest);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  const parsed = parseDocument(req.body);
  if (!parsed.data) return res.status(400).json({ error: "Invalid Foods I Enjoy document", details: parsed.issues });
  const document = parsed.data;
  const [updated] = await db
    .update(users)
    .set({ foodsIEnjoy: document })
    .where(eq(users.id, userId))
    .returning({ foodsIEnjoy: users.foodsIEnjoy });
  if (!updated) return res.status(404).json({ error: "User not found" });
  return res.json({ document: updated.foodsIEnjoy ?? document });
});

householdFoodsIEnjoyRouter.get("/profiles/:profileId/foods-i-enjoy", requireAuth, async (req, res) => {
  const userId = actorId(req as AuthenticatedRequest);
  const profileId = profileIdSchema.safeParse(req.params.profileId);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  if (!profileId.success) return res.status(400).json({ error: "Invalid household profile ID" });
  const [profile] = await db
    .select({ foodsIEnjoy: householdProfiles.foodsIEnjoy })
    .from(householdProfiles)
    .where(and(eq(householdProfiles.id, profileId.data), eq(householdProfiles.ownerUserId, userId)))
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Household profile not found" });
  return res.json({ document: profile.foodsIEnjoy ?? emptyFoodsIEnjoyDocument() });
});

householdFoodsIEnjoyRouter.put("/profiles/:profileId/foods-i-enjoy", requireAuth, async (req, res) => {
  const userId = actorId(req as AuthenticatedRequest);
  const profileId = profileIdSchema.safeParse(req.params.profileId);
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  if (!profileId.success) return res.status(400).json({ error: "Invalid household profile ID" });
  const parsed = parseDocument(req.body);
  if (!parsed.data) return res.status(400).json({ error: "Invalid Foods I Enjoy document", details: parsed.issues });
  const document = parsed.data;
  const [owned] = await db
    .select({ id: householdProfiles.id })
    .from(householdProfiles)
    .where(and(eq(householdProfiles.id, profileId.data), eq(householdProfiles.ownerUserId, userId)))
    .limit(1);
  if (!owned) return res.status(404).json({ error: "Household profile not found" });
  const [updated] = await db
    .update(householdProfiles)
    .set({ foodsIEnjoy: document, updatedAt: new Date() })
    .where(and(eq(householdProfiles.id, profileId.data), eq(householdProfiles.ownerUserId, userId)))
    .returning({ foodsIEnjoy: householdProfiles.foodsIEnjoy });
  return res.json({ document: updated?.foodsIEnjoy ?? document });
});

export default router;