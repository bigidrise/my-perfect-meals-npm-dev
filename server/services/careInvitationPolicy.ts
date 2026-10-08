import { isCanonicalPractitionerRole, requiresProfessionalRoleReview } from "@shared/professionalRoles";
import type { InvitationProviderContext } from "./invitationProviderContext";

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
  verifiedProviders: ReadonlyMap<string, InvitationProviderContext> = new Map(),
) {
  if (creator.id === recipient.id) throw new CareInvitationError("SELF_ACTIVATION", 400);
  if (requiresProfessionalRoleReview(creator.professionalRole)) {
    throw new CareInvitationError("PROFESSIONAL_ROLE_REVIEW_REQUIRED", 409);
  }
  const creatorContext = verifiedProviders.get(creator.id);
  if (creator.professionalRole === "business" && creatorContext && !bound.providerUserId) {
    throw new CareInvitationError("INVITATION_REISSUE_REQUIRED", 409,
      bound.clientUserId === creator.id
        ? "This invitation was created in the wrong direction. Ask the Studio owner to send a new client invitation. No connection was made."
        : "This legacy invitation has no verified provider binding. Ask the Studio owner to send a new client invitation. No connection was made.",
      { reissueRequired: true });
  }
  const creatorIsProvider = isCanonicalPractitionerRole(creator.professionalRole);
  const providerId = bound.providerUserId ??
    (bound.clientUserId === creator.id ? recipient.id :
      bound.clientUserId === recipient.id ? creator.id :
        creatorIsProvider ? creator.id : recipient.id);
  const provider = providerId === creator.id ? creator : recipient;
  const client = provider === creator ? recipient : creator;
  const context = verifiedProviders.get(provider.id);
  if (providerId !== creator.id && providerId !== recipient.id) {
    throw new CareInvitationError("INVITATION_PARTIES_CHANGED", 409);
  }
  const verifiedOperator = provider.professionalRole === "business" && context?.userId === provider.id
    && context.relationshipRole === "studio_operator" && !!context.studioId;
  if (!verifiedOperator && !isCanonicalPractitionerRole(provider.professionalRole)) {
    throw new CareInvitationError("UNSUPPORTED_PROVIDER_ROLE");
  }
  if (provider.professionalRole === "business" &&
      (!context?.studioId || context.relationshipRole !== "studio_operator" || !bound.providerUserId)) {
    throw new CareInvitationError("INVITATION_REISSUE_REQUIRED", 409,
      "Ask the Studio owner to send a new, explicitly bound client invitation.", { reissueRequired: true });
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
