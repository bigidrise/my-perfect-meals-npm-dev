import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { clientLinks } from "../db/schema/procare";
import { studios } from "../db/schema/studio";
import { users } from "@shared/schema";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { deactivateProCareClient } from "../services/procareActivation";

const router = Router();

// Client-facing relationship introspection must remain outside professional
// subscription, certification, and training gates. It exposes only the
// authenticated client's own active relationship.
router.get("/connection-status", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [activeLink] = await db
      .select({
        proUserId: clientLinks.proUserId,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        professionalRole: users.professionalRole,
      })
      .from(clientLinks)
      .innerJoin(users, eq(users.id, clientLinks.proUserId))
      .where(and(eq(clientLinks.clientUserId, userId), eq(clientLinks.active, true)));

    if (!activeLink) return res.json({ connected: false });

    const [studio] = await db
      .select({ id: studios.id, name: studios.name, type: studios.type })
      .from(studios)
      .where(
        and(
          eq(studios.ownerUserId, activeLink.proUserId),
          eq(studios.status, "active"),
        ),
      );

    if (!studio) return res.json({ connected: false });

    const providerName =
      activeLink.firstName && activeLink.lastName
        ? `${activeLink.firstName} ${activeLink.lastName}`
        : activeLink.firstName || activeLink.username || "Your Provider";

    return res.json({
      connected: true,
      provider: {
        userId: activeLink.proUserId,
        name: providerName,
        role: activeLink.professionalRole || "trainer",
        studioName: studio.name,
        studioId: studio.id,
      },
    });
  } catch (error) {
    console.error("❌ [connection-status] Error:", error);
    return res.status(500).json({ error: "Failed to fetch connection status" });
  }
});

// Clients must be able to end their own relationship without qualifying for
// professional workspace access.
router.post("/disconnect-self", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const [activeLink] = await db
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, userId), eq(clientLinks.active, true)));

    if (!activeLink) {
      return res.status(404).json({ error: "No active ProCare connection found" });
    }

    await deactivateProCareClient(
      userId,
      activeLink.proUserId,
      userId,
      "client_self_disconnect",
    );

    return res.json({ success: true, disconnectedFrom: activeLink.proUserId });
  } catch (error) {
    console.error("❌ [disconnect-self] Error:", error);
    return res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;