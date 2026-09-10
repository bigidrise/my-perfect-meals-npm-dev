import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { businesses, businessMembers } from "../db/schema/business";
import { clinicPilotEnrollmentLinks } from "../db/schema/pilotProgram";
import { requireAuth } from "../middleware/requireAuth";
import { requireMfa } from "../middleware/requireMfa";
import {
  createClinicPilotEnrollmentLink, enrollClinicPatient, inspectClinicPilotEnrollmentLink,
  revokeClinicPilotEnrollmentLink,
} from "../services/clinicPilotEnrollmentService";

const router = Router();
const actor = (req: any) => req.authUser?.id as string;

export async function isBusinessAdmin(userId: string, businessId: string) {
  const [business] = await db.select({ ownerUserId: businesses.ownerUserId }).from(businesses)
    .where(eq(businesses.id, businessId)).limit(1);
  if (business?.ownerUserId === userId) return true;
  const [member] = await db.select({ id: businessMembers.id }).from(businessMembers).where(and(
    eq(businessMembers.businessId, businessId), eq(businessMembers.userId, userId),
    eq(businessMembers.role, "admin"), eq(businessMembers.status, "active"),
  )).limit(1);
  return Boolean(member);
}

router.get("/inspect", async (req, res) => {
  try {
    const token = req.get("x-clinic-enrollment-token");
    if (!token) {
      return res.status(400).json({
        error: "Enrollment token required.",
        code: "CLINIC_TOKEN_REQUIRED",
      });
    }
    const link = await inspectClinicPilotEnrollmentLink(token);
    if (!link) return res.status(404).json({ error: "Enrollment link not found." });
    return res.json({
      pilotId: link.pilotId, pilotName: link.pilotName, status: link.status,
      expiresAt: link.expiresAt, capacity: link.capacity, enrolledCount: link.enrolledCount,
      accessDurationDays: link.accessDurationDays, available: link.available,
    });
  } catch { return res.status(500).json({ error: "Unable to inspect enrollment link.", code: "CLINIC_LINK_INSPECT_FAILED" }); }
});

router.post("/links/:pilotId", requireAuth, requireMfa, async (req: any, res) => {
  const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : "";
  if (!businessId || !(await isBusinessAdmin(actor(req), businessId))) return res.status(403).json({ error: "Business administrator access required." });
  try {
    const created = await createClinicPilotEnrollmentLink({
      businessId, pilotId: req.params.pilotId, actorUserId: actor(req),
      capacity: req.body?.capacity === undefined ? undefined : Number(req.body.capacity),
      expiresAt: req.body?.expiresAt ? new Date(req.body.expiresAt) : null,
      accessDurationDays: Number(req.body?.accessDurationDays),
    });
    return res.status(201).json({
      linkId: created.link.id,
      expiresAt: created.link.expiresAt,
      capacity: created.link.capacity,
      accessDurationDays: created.link.accessDurationDays,
      rawToken: created.rawToken,
      joinPath: `/join/clinic#token=${created.rawToken}`,
    });
  } catch (error: any) { return res.status(400).json({ error: "Unable to create clinic enrollment link.", code: error?.message || "CLINIC_LINK_CREATE_FAILED" }); }
});

router.get("/links", requireAuth, requireMfa, async (req: any, res) => {
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : "";
  if (!businessId || !(await isBusinessAdmin(actor(req), businessId))) return res.status(403).json({ error: "Business administrator access required.", code: "BUSINESS_ADMIN_REQUIRED" });
  const links = await db.select({ id: clinicPilotEnrollmentLinks.id, pilotId: clinicPilotEnrollmentLinks.pilotId, status: clinicPilotEnrollmentLinks.status, expiresAt: clinicPilotEnrollmentLinks.expiresAt, capacity: clinicPilotEnrollmentLinks.capacity, accessDurationDays: clinicPilotEnrollmentLinks.accessDurationDays, createdAt: clinicPilotEnrollmentLinks.createdAt, revokedAt: clinicPilotEnrollmentLinks.revokedAt }).from(clinicPilotEnrollmentLinks).where(eq(clinicPilotEnrollmentLinks.businessId, businessId));
  return res.json({ links });
});

router.post("/enroll", requireAuth, async (req: any, res) => {
  if (typeof req.body?.token !== "string") return res.status(400).json({ error: "Enrollment token required." });
  try {
    const result = await enrollClinicPatient(req.body.token, actor(req));
    return res.json({ success: true, alreadyEnrolled: result.alreadyEnrolled, startsAt: result.entitlement.startsAt, endsAt: result.entitlement.endsAt });
  } catch (error: any) { return res.status(400).json({ error: "Unable to enroll.", code: error?.message || "CLINIC_ENROLLMENT_FAILED" }); }
});

router.post("/links/:linkId/revoke", requireAuth, requireMfa, async (req: any, res) => {
  const [link] = await db.select({ businessId: clinicPilotEnrollmentLinks.businessId })
    .from(clinicPilotEnrollmentLinks)
    .where(eq(clinicPilotEnrollmentLinks.id, req.params.linkId)).limit(1);
  if (!link || !(await isBusinessAdmin(actor(req), link.businessId))) return res.status(403).json({ error: "Business administrator access required." });
  return res.json({ success: await revokeClinicPilotEnrollmentLink(req.params.linkId, actor(req), req.body?.reason) });
});

export default router;