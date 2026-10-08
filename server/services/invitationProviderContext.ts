import { isCanonicalPractitionerRole, type CanonicalPractitionerRole } from "@shared/professionalRoles";
import { CareInvitationError, type InvitationParty } from "./careInvitationPolicy";
import { getProviderStudioReadiness, readOwnedBusinessStudio } from "./procareStudioReadiness";

export interface InvitationProviderContext {
  userId: string;
  relationshipRole: CanonicalPractitionerRole | "studio_operator";
  studioId?: string;
}

/**
 * This is operating authority, never an account occupation or clinical credential.
 * Only server-resolved evidence may be supplied to the invitation party policy.
 */
export async function resolveInvitationProviderContext(
  account: InvitationParty,
): Promise<InvitationProviderContext | null> {
  if (isCanonicalPractitionerRole(account.professionalRole)) {
    return { userId: account.id, relationshipRole: account.professionalRole };
  }
  if (account.professionalRole !== "business") return null;
  const studio = await readOwnedBusinessStudio(account.id);
  if (!studio) return null; // Business-only accounts remain legitimate clients.
  if (studio.status !== "active" || studio.type !== "studio") {
    throw new CareInvitationError(studio.type !== "studio" ? "UNSUPPORTED_PROVIDER_ROLE" : "PROVIDER_ROLE_REQUIRED", 403,
      "An active nonclinical professional Studio is required. Business ownership does not authorize a Clinic.");
  }
  const readiness = await getProviderStudioReadiness(account.id);
  if (!readiness.ok) {
    throw new CareInvitationError(readiness.code ?? "PROVIDER_ROLE_REQUIRED", 403,
      readiness.message, { setupRequired: true, flow: readiness.flow, missing: readiness.missing });
  }
  return { userId: account.id, relationshipRole: "studio_operator", studioId: studio.id };
}
