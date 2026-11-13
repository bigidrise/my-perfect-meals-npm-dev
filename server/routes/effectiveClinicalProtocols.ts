import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { effectiveClinicalProtocols } from "@shared/clinicalProtocolIdentity";
import { studioMemberships, studios } from "../db/schema/studio";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { isSameOrg } from "../lib/orgIsolation";
import { resolveCurrentGLP1MealAuthority, currentGLP1AuthorityEnabled } from "../services/glp1/currentMealAuthority";
import { readDevelopmentPersonalFoodSupports } from "../services/healthProtocols/developmentFoodSupports";

/** Status-only access is intentionally distinct from permission to read lab values. */
export async function canReadClinicalProtocolIndicators(actor: string, subject: string): Promise<boolean> {
  if (actor === subject) return true;
  if (!await isSameOrg(actor, subject)) return false;
  const [relationship] = await db.select({ id: studioMemberships.id }).from(studioMemberships)
    .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
    .where(and(eq(studios.ownerUserId, actor), eq(studios.status, "active"),
      eq(studioMemberships.clientUserId, subject), eq(studioMemberships.status, "active"),
      eq(studioMemberships.isArchived, false))).limit(1);
  return !!relationship;
}

export default function effectiveClinicalProtocolsRouter() {
  const router = Router();
  router.get("/:subjectId", requireAuth, async (req, res) => {
    const actor = (req as AuthenticatedRequest).authUser.id;
    const subject = req.params.subjectId;
    try {
      if (!await canReadClinicalProtocolIndicators(actor, subject)) {
        return res.status(403).json({ error: "No active relationship permits viewing these indicators." });
      }
      const [profile] = await db.select({
        id: users.id, specialtyConditions: users.specialtyConditions,
        specialtyCondition: users.specialtyCondition, healthConditions: users.healthConditions,
        medicalConditions: users.medicalConditions, selectedMealBuilder: users.selectedMealBuilder,
        oncologySupportContext: users.oncologySupportContext,
        thyroidType: users.thyroidType,
      }).from(users).where(eq(users.id, subject)).limit(1);
      if (!profile) return res.status(404).json({ error: "Profile unavailable." });
      const protocols = effectiveClinicalProtocols(profile);
      // Match the existing live GLP-1 and optional-support authority; never
      // promote historical medication strings or old preferences to active use.
      if (currentGLP1AuthorityEnabled()) {
        const authority = await resolveCurrentGLP1MealAuthority({ id: subject });
        const at = protocols.indexOf("glp1");
        if (at >= 0) protocols.splice(at, 1);
        if (authority.length) protocols.push("glp1");
      }
      const personal = await readDevelopmentPersonalFoodSupports(subject);
      if (personal.has("anti_inflammatory") && !protocols.includes("anti-inflammatory")) protocols.push("anti-inflammatory");
      if (personal.has("glp1") && !protocols.includes("glp1")) protocols.push("glp1");
      res.setHeader("Cache-Control", "private, no-store");
      // Do not include lab values, provider notes, diagnosis details or recommendation signals.
      return res.json({ subjectUserId: subject, protocols, specialtyConditions: protocols });
    } catch {
      return res.status(503).json({ error: "Clinical protocol status could not be verified." });
    }
  });
  return router;
}
