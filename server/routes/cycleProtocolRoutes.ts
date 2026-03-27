import { Router, Request, Response } from "express";
import { db } from "../db";
import { studios, studioMemberships } from "../db/schema/studio";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";
import { applyCycleProtocol, getCycleProtocol, type ProtocolType, type DayType } from "../services/cycleProtocolService";
import { z } from "zod";

const router = Router();

const cycleProtocolSchema = z.object({
  protocolType: z.enum(["off", "carbCycle", "fatCycle"]),
  dayType: z.enum(["low", "moderate", "high"]).nullable().optional(),
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

    const protocol = await getCycleProtocol(clientUserId);
    return res.json({ protocol });
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

    const parsed = cycleProtocolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.errors });
    }

    const { protocolType, dayType } = parsed.data;

    if (protocolType !== "off" && !dayType) {
      return res.status(400).json({ error: "dayType is required when protocolType is not off" });
    }

    const result = await applyCycleProtocol({
      studioId: proAccess.studioId,
      clientUserId,
      protocolType: protocolType as ProtocolType,
      dayType: (dayType ?? null) as DayType | null,
      updatedByUserId: authUser.id,
      updatedByRole: proAccess.role,
    });

    if (!result.ok) return res.status(500).json({ error: result.error });
    return res.json({ ok: true });
  }
);

export default router;
