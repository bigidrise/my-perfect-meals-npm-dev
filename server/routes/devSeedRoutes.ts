/**
 * DEV-ONLY ROUTES — never mounted in production.
 * Allows seeding certification + affiliate state for any user by email,
 * so testing can skip the full quiz flow.
 */
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../shared/schema";
import { certificationModuleProgress, userCertifications } from "../db/schema/certifications";
import { userAffiliateAccounts } from "../db/schema/affiliateAccounts";

const router = Router();

// Module IDs for each supported cert type
const MODULES_BY_CERT: Record<string, string[]> = {
  affiliate_social: [
    "module-1", "module-2", "module-3", "module-4",
    "module-5", "module-6", "module-7", "module-8",
    "final-assessment",
  ],
  affiliate_coaching: [
    "module-1", "module-2", "module-3", "module-4",
    "module-5", "module-6", "module-7", "module-8",
    "final-assessment",
  ],
};

const TRACK_FOR_CERT: Record<string, { track: string; requiredPhases: string }> = {
  affiliate_social: { track: "social_affiliate", requiredPhases: "phase_1_only" },
  affiliate_coaching: { track: "business_affiliate", requiredPhases: "phase_1_and_2" },
};

/**
 * POST /api/dev/seed-affiliate-cert
 * Body: { email, certType?, track?, certificateName? }
 *
 * certType defaults to "affiliate_social"
 * Idempotent — safe to call multiple times.
 */
router.post("/seed-affiliate-cert", async (req, res) => {
  const {
    email,
    certType = "affiliate_social",
    certificateName = "Test User",
  } = req.body ?? {};

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const moduleIds = MODULES_BY_CERT[certType];
  if (!moduleIds) {
    return res
      .status(400)
      .json({ error: `Unknown certType "${certType}". Valid: ${Object.keys(MODULES_BY_CERT).join(", ")}` });
  }

  const trackInfo = TRACK_FOR_CERT[certType];

  try {
    // 1. Find user
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: `No user found with email "${email}"` });
    }

    const userId = user.id;
    const now = new Date();
    const certNumber = `MPM-DEV-${Date.now().toString(36).toUpperCase()}`;

    // 2. Seed all module progress as completed
    for (const moduleId of moduleIds) {
      await db
        .insert(certificationModuleProgress)
        .values({
          userId,
          certificationType: certType,
          moduleId,
          status: "completed",
          score: 100,
          completedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            certificationModuleProgress.userId,
            certificationModuleProgress.certificationType,
            certificationModuleProgress.moduleId,
          ],
          set: { status: "completed", score: 100, completedAt: now },
        });
    }

    // 3. Upsert the overall certification record
    await db
      .insert(userCertifications)
      .values({
        userId,
        certificationType: certType,
        status: "completed",
        score: 100,
        completedAt: now,
        certificateNumber: certNumber,
        certificateName,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userCertifications.userId, userCertifications.certificationType],
        set: {
          status: "completed",
          score: 100,
          completedAt: now,
          certificateName: certificateName
            ? sql`CASE WHEN ${userCertifications.certificateName} IS NULL THEN ${certificateName}::text ELSE ${userCertifications.certificateName} END`
            : sql`${userCertifications.certificateName}`,
          updatedAt: now,
        },
      });

    // 4. Upsert the affiliate track (only if not already activated)
    const [existingAffiliate] = await db
      .select({ id: userAffiliateAccounts.userId, activatedAt: userAffiliateAccounts.activatedAt })
      .from(userAffiliateAccounts)
      .where(eq(userAffiliateAccounts.userId, userId))
      .limit(1);

    if (!existingAffiliate) {
      await db.insert(userAffiliateAccounts).values({
        userId,
        affiliateTrack: trackInfo.track,
        requiredPhases: trackInfo.requiredPhases,
        phase1CompletedAt: now,
        updatedAt: now,
      });
    } else if (!existingAffiliate.activatedAt) {
      await db
        .update(userAffiliateAccounts)
        .set({ phase1CompletedAt: now, updatedAt: now })
        .where(eq(userAffiliateAccounts.userId, userId));
    }

    return res.json({
      ok: true,
      userId,
      email: user.email,
      certType,
      certificateNumber: certNumber,
      modulesSeeded: moduleIds.length,
      track: trackInfo.track,
      message: `Certification seeded. Log in as ${email} and go to /business-center/affiliate/${certType === "affiliate_social" ? "social" : "coaching"}/certification/complete`,
    });
  } catch (err) {
    console.error("[DevSeed] error:", err);
    return res.status(500).json({ error: "Seed failed", detail: String(err) });
  }
});

/**
 * DELETE /api/dev/seed-affiliate-cert
 * Body: { email, certType? }
 * Removes seeded data so you can re-test the full flow.
 */
router.delete("/seed-affiliate-cert", async (req, res) => {
  const { email, certType = "affiliate_social" } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user) return res.status(404).json({ error: `No user found with email "${email}"` });

  const userId = user.id;

  await db
    .delete(certificationModuleProgress)
    .where(
      and(
        eq(certificationModuleProgress.userId, userId),
        eq(certificationModuleProgress.certificationType, certType)
      )
    );

  await db
    .delete(userCertifications)
    .where(
      and(
        eq(userCertifications.userId, userId),
        eq(userCertifications.certificationType, certType)
      )
    );

  await db
    .delete(userAffiliateAccounts)
    .where(eq(userAffiliateAccounts.userId, userId));

  return res.json({ ok: true, cleared: { certType, userId } });
});

export default router;
