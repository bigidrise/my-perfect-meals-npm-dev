import { db } from "../db";
import { users } from "../../shared/schema";
import { studios } from "../db/schema/studio";
import { eq, and, isNotNull } from "drizzle-orm";

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: "no_provider_account" | "studio_inactive" | "license_not_verified" | "no_studio" };

const APPROVED_PROFESSIONAL_ROLES = new Set([
  "trainer",
  "physician",
  "dietitian",
  "nurse_practitioner",
]);

export async function checkBusinessAffiliateEligibility(userId: string): Promise<EligibilityResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user || !(user as any).isProCare) {
    return { eligible: false, reason: "no_provider_account" };
  }

  const professionalRole = (user as any).professionalRole as string | null;
  if (!professionalRole || !APPROVED_PROFESSIONAL_ROLES.has(professionalRole)) {
    return { eligible: false, reason: "no_provider_account" };
  }

  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, String(userId)))
    .limit(1);

  if (!studio) {
    return { eligible: false, reason: "no_studio" };
  }

  if (studio.status !== "active") {
    return { eligible: false, reason: "studio_inactive" };
  }

  // Check if org requires professional verification — if waived, bypass license check
  const verificationRequired = await isProfessionalVerificationRequired(userId);
  if (verificationRequired) {
    if (professionalRole === "physician" && studio.verificationStatus !== "verified") {
      return { eligible: false, reason: "license_not_verified" };
    }
  }

  return { eligible: true };
}

/** False-wins: returns false if any org the user belongs to has requireProfessionalVerification: false */
async function isProfessionalVerificationRequired(userId: string): Promise<boolean> {
  try {
    const { loadOrgContext } = await import("../lib/orgContext");
    const { businesses, businessMembers } = await import("../db/schema/business");

    const [userRow] = await db
      .select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.organizationId) {
      const org = await loadOrgContext(userRow.organizationId);
      if (org.featureFlags.requireProfessionalVerification === false) return false;
    }

    const memberships = await db
      .select({ organizationId: businesses.organizationId })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(
        and(
          eq(businessMembers.userId, userId),
          eq(businessMembers.status, "active"),
          isNotNull(businesses.organizationId)
        )
      );

    for (const m of memberships) {
      if (m.organizationId) {
        const org = await loadOrgContext(m.organizationId);
        if (org.featureFlags.requireProfessionalVerification === false) return false;
      }
    }

    return true;
  } catch {
    return true;
  }
}

type IneligibleReason = "no_provider_account" | "studio_inactive" | "license_not_verified" | "no_studio";

export function eligibilityErrorMessage(reason: IneligibleReason): string {
  switch (reason) {
    case "no_provider_account":
      return "You must have an approved provider account before enrolling in the Business & Coaching Affiliate Program.";
    case "studio_inactive":
      return "Your provider account is not yet active. Please complete your provider setup.";
    case "license_not_verified":
      return "Your license verification is pending. Professional Affiliate enrollment requires approved license verification.";
    case "no_studio":
      return "Your provider account setup is incomplete. Please finish setting up your professional account.";
  }
}
