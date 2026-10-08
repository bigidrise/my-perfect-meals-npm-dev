import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { isCanonicalPractitionerRole } from "@shared/professionalRoles";
import { db } from "../db";
import { studios, studioBilling } from "../db/schema/studio";
import { getProviderStudioReadiness, type ProviderStudioReadiness } from "./procareStudioReadiness";

export class ManualStudioProvisioningError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly readiness?: ProviderStudioReadiness,
  ) {
    super(message);
    this.name = "ManualStudioProvisioningError";
  }
}

interface ManualStudioInput {
  name: string;
  type?: "studio" | "clinic";
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Creates or repairs the authenticated owner's workspace, never a replacement.
 * Existing workspace details and billing/subscription ownership are immutable here.
 * Owner identity is locked through readiness and commit; no role is assigned.
 */
export async function provisionManualStudio(ownerUserId: string, input: ManualStudioInput) {
  return db.transaction(async (tx) => {
    const [owner] = await tx.select({
      id: users.id,
      professionalRole: users.professionalRole,
    }).from(users).where(eq(users.id, ownerUserId)).limit(1).for("share");

    if (!owner || !isCanonicalPractitionerRole(owner.professionalRole)) {
      throw new ManualStudioProvisioningError(403, "PROVIDER_ROLE_REQUIRED",
        "Complete your professional ProCare setup before creating a Studio or inviting clients.",
        { ok: false, code: "PROVIDER_ROLE_REQUIRED" });
    }
    // The global readiness reader sees the locked, committed identity. A role
    // transition cannot occur between these checks and the provisioning commit.
    const readiness = await getProviderStudioReadiness(ownerUserId);
    if (!readiness.ok) {
      throw new ManualStudioProvisioningError(403, readiness.code ?? "PROVIDER_ROLE_REQUIRED",
        readiness.message ?? "Professional setup is required.", readiness);
    }
    const type = owner.professionalRole === "physician" ? "clinic" : "studio";
    if (input.type !== undefined && input.type !== type) {
      throw new ManualStudioProvisioningError(400, "STUDIO_TYPE_MISMATCH",
        "Workspace type must match your authorized practitioner identity.");
    }

    await tx.insert(studios).values({
      ownerUserId,
      name: input.name,
      type,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      status: "active",
    }).onConflictDoNothing({ target: studios.ownerUserId });

    // Re-read after an owner-unique conflict: another concurrent request may
    // have created the canonical workspace. Lock it while ensuring billing.
    const [studio] = await tx.select().from(studios)
      .where(eq(studios.ownerUserId, ownerUserId)).limit(1).for("update");
    if (!studio) throw new Error("Owned workspace could not be resolved after provisioning");
    if (studio.type !== type || studio.status !== "active") {
      throw new ManualStudioProvisioningError(409, "EXISTING_STUDIO_REVIEW_REQUIRED",
        "The existing workspace requires review; it cannot be replaced or reactivated by creation.");
    }

    await tx.insert(studioBilling).values({
      studioId: studio.id,
      planCode: studio.type === "clinic" ? "clinic_69" : "studio_59",
      status: "trialing",
    }).onConflictDoNothing({ target: studioBilling.studioId });
    return studio;
  });
}
