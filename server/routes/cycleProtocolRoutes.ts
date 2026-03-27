import { Router, Request, Response } from "express";
import { db } from "../db";
import { studios, studioMemberships } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import {
  upsertNutritionStrategy,
  getNutritionStrategy,
  markStrategyViewed,
  acknowledgeStrategy,
  STRATEGY_TYPES,
  type StrategyType,
} from "../services/cycleProtocolService";
import { z } from "zod";

const router = Router();

const nutritionStrategySchema = z.object({
  strategyType: z.enum(STRATEGY_TYPES as [string, ...string[]]),
  coachInstructions: z.string().min(1).max(1000),
  watchFor: z.string().max(500).nullable().optional(),
});

async function getProRoleAndStudio(
  proUserId: string,
  studioId: string
): Promise<{ studioId: string; role: "trainer" | "physician" } | null> {
  const [studio] = await db
    .select({ id: studios.id, type: studios.type })
    .from(studios)
    .where(and(eq(studios.id, studioId), eq(studios.ownerUserId, proUserId)))
    .limit(1);

  if (!studio) return null;
  const role = studio.type === "clinic" ? "physician" : "trainer";
  return { studioId: studio.id, role };
}

async function assertClientInStudio(studioId: string, clientUserId: string): Promise<boolean> {
  const [membership] = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .where(and(eq(studioMemberships.studioId, studioId), eq(studioMemberships.clientUserId, clientUserId)))
    .limit(1);
  return !!membership;
}

async function getClientMembership(clientUserId: string): Promise<{ studioId: string } | null> {
  const [membership] = await db
    .select({ studioId: studioMemberships.studioId })
    .from(studioMemberships)
    .where(eq(studioMemberships.clientUserId, clientUserId))
    .limit(1);
  return membership ?? null;
}

router.get(
  "/studios/:studioId/clients/:clientUserId/cycle-protocol",
  requireAuth,
  async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) return res.status(401).json({ error: "Unauthenticated" });

    const { studioId, clientUserId } = req.params;
    const proAccess = await getProRoleAndStudio(authUser.id, studioId);
    if (!proAccess) return res.status(403).json({ error: "Access denied" });

    const inStudio = await assertClientInStudio(studioId, clientUserId);
    if (!inStudio) return res.status(404).json({ error: "Client not found in studio" });

    const strategy = await getNutritionStrategy(clientUserId);
    return res.json({ strategy });
  }
);

router.put(
  "/studios/:studioId/clients/:clientUserId/cycle-protocol",
  requireAuth,
  async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) return res.status(401).json({ error: "Unauthenticated" });

    const { studioId, clientUserId } = req.params;
    const proAccess = await getProRoleAndStudio(authUser.id, studioId);
    if (!proAccess) return res.status(403).json({ error: "Access denied" });

    const inStudio = await assertClientInStudio(studioId, clientUserId);
    if (!inStudio) return res.status(404).json({ error: "Client not found in studio" });

    const parsed = nutritionStrategySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }

    const { strategyType, coachInstructions, watchFor } = parsed.data;

    const result = await upsertNutritionStrategy({
      studioId: proAccess.studioId,
      clientUserId,
      strategyType: strategyType as StrategyType,
      coachInstructions,
      watchFor: watchFor ?? null,
      updatedByUserId: authUser.id,
      updatedByRole: proAccess.role,
    });

    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.json({ ok: true });
  }
);

router.get(
  "/client/nutrition-strategy",
  requireAuth,
  async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) return res.status(401).json({ error: "Unauthenticated" });

    const strategy = await getNutritionStrategy(authUser.id);
    return res.json({ strategy });
  }
);

router.post(
  "/client/nutrition-strategy/view",
  requireAuth,
  async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) return res.status(401).json({ error: "Unauthenticated" });

    const result = await markStrategyViewed(authUser.id, authUser.id);
    return res.json(result);
  }
);

router.post(
  "/client/nutrition-strategy/acknowledge",
  requireAuth,
  async (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).authUser;
    if (!authUser?.id) return res.status(401).json({ error: "Unauthenticated" });

    const membership = await getClientMembership(authUser.id);
    if (!membership) return res.status(404).json({ error: "No studio membership found" });

    const result = await acknowledgeStrategy(authUser.id, authUser.id, membership.studioId);
    return res.json(result);
  }
);

export default router;
