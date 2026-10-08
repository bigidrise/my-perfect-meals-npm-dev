import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { studios } from "../db/schema/studio";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority, isDevelopmentFounderDemoAccount } from "../config/developmentFounderPhysicianDemo";
import { createDevelopmentFounderDemoStore, developmentDemoFilename, developmentDemoRuntimeEnabled } from "./developmentFounderDemoStore";
import { ProfessionalRequestError } from "./professionalOnboardingService";
import type { IdentityAccountSnapshot } from "./professionalIdentityDecisionService";

export const developmentFounderDemoStore = createDevelopmentFounderDemoStore({
  filename: developmentDemoFilename, enabled: developmentDemoRuntimeEnabled,
  async owner() {
    // Deliberately no membership, clinical, Business or Organization queries.
    const [account] = await db.select({ id: users.id, professionalRole: users.professionalRole,
      authSecurityVersion: users.authSecurityVersion, isAdmin: users.isAdmin, mfaEnabled: users.mfaEnabled,
    }).from(users).where(eq(users.id, authority.userId)).limit(1);
    const [clinic] = await db.select({ id: studios.id, ownerUserId: studios.ownerUserId, name: studios.name,
      type: studios.type, status: studios.status }).from(studios).where(eq(studios.id, authority.clinicId)).limit(1);
    if (!account || !clinic || clinic.ownerUserId !== account.id || clinic.type !== "clinic" || clinic.status !== "active") {
      throw new ProfessionalRequestError(403, "DEVELOPMENT_DEMO_OWNERSHIP_CHANGED", "The authorized existing Clinic could not be verified. No replacement Clinic or live-data fallback will be created.");
    }
    return {
      account: { ...account, professionalCategory: null, credentialType: null, credentialBody: null,
        credentialNumber: null, credentialYear: null, isProCare: false, organizationId: null } as IdentityAccountSnapshot,
      clinic: { id: clinic.id, name: clinic.name, type: "clinic", syntheticOnly: true },
    };
  },
});
export const developmentFounderDemoRepository = developmentFounderDemoStore.repository;
export async function readDevelopmentFounderDemoGrant(userId: string) {
  return isDevelopmentFounderDemoAccount(userId) ? developmentFounderDemoStore.grant(userId) : null;
}
