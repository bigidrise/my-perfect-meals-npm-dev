import { isCanonicalPractitionerRole, requiresProfessionalRoleReview } from "@shared/professionalRoles";

export class CareInvitationError extends Error {
  constructor(public code: string, public status = 403, message = code, public details: Record<string, unknown> = {}) {
    super(message);
  }
}
export interface InvitationParty { id: string; professionalRole?: string | null }

/** The dropdown and invitation label are deliberately absent from this contract. */
export function resolveCareInvitationParties(
  creator: InvitationParty,
  recipient: InvitationParty,
  bound: { providerUserId?: string | null; clientUserId?: string | null } = {},
) {
  if (creator.id === recipient.id) throw new CareInvitationError("SELF_ACTIVATION", 400);
  if (requiresProfessionalRoleReview(creator.professionalRole)) {
    throw new CareInvitationError("PROFESSIONAL_ROLE_REVIEW_REQUIRED", 409);
  }
  const creatorIsProvider = isCanonicalPractitionerRole(creator.professionalRole);
  const provider = creatorIsProvider ? creator : recipient;
  const client = creatorIsProvider ? recipient : creator;
  if (!isCanonicalPractitionerRole(provider.professionalRole)) {
    throw new CareInvitationError("UNSUPPORTED_PROVIDER_ROLE");
  }
  if ((bound.providerUserId && bound.providerUserId !== provider.id) ||
      (bound.clientUserId && bound.clientUserId !== client.id)) {
    throw new CareInvitationError("INVITATION_PARTIES_CHANGED", 409);
  }
  return { provider, client };
}

export function assertInvitationWindow(
  invite: { expiresAt: Date | string; revokedAt?: Date | string | null },
  now = new Date(),
) {
  if (invite.revokedAt) throw new CareInvitationError("REVOKED", 410);
  const expiry = new Date(invite.expiresAt).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) throw new CareInvitationError("EXPIRED", 410);
}

export function assertInvitationDataset(
  provider: { domain: "live" | "synthetic"; workspaceId?: string },
  client: { domain: "live" | "synthetic"; workspaceId?: string },
) {
  if (provider.domain !== client.domain ||
      (provider.domain === "synthetic" && (!provider.workspaceId || provider.workspaceId !== client.workspaceId))) {
    throw new CareInvitationError("INVITATION_DATASET_MISMATCH");
  }
}
