/**
 * Email-link facade. Code, link and legacy login acceptance all use the same
 * server-resolved party, eligibility and atomic relationship implementation.
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import { studios } from "../db/schema/studio";
import { isCanonicalPractitionerRole } from "@shared/professionalRoles";
import { resolveInvitationProviderContext } from "./invitationProviderContext";
import { findEmailIdentityCandidates } from "./emailIdentityService";
import { findCareInvitation, acceptStoredCareInvitation } from "./careInvitationAcceptance";
import { CareInvitationError } from "./careInvitationPolicy";

export interface InviteResolution {
  source: "care_invite" | "studio_invite"; inviteId: string; invitedEmail: string;
  proUserId: string; studioId: string | null; studioName: string; proName: string;
  studioType: "studio" | "clinic"; providerRole: string | null; expiresAt: Date;
  alreadyAccepted: boolean; inviteCode: string; urlToken: string;
  organizationId: string | null; locationId: string | null;
  sourceBusinessId: string | null; partnerRecordId: string | null; revokedAt?: Date | null;
}
export interface InviteMetadata {
  studioName: string; proName: string; invitedEmail: string; maskedEmail: string;
  studioType: "studio" | "clinic"; expired: boolean; alreadyAccepted: boolean;
}
export interface AcceptResult { membershipId: string; studioName: string }
export type AcceptError = {
  code: string; status?: number; message?: string; maskedEmail?: string;
  missing?: string[]; flow?: string;
};
function maskEmail(email: string) {
  const index = email.indexOf("@");
  if (index <= 0) return "****@****";
  const local = email.slice(0, index), domain = email.slice(index + 1);
  return local.length <= 2 ? `****@${domain}`
    : `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local.at(-1)}@${domain}`;
}

export async function resolveInviteByToken(token: string): Promise<InviteResolution | null> {
  const invite = await findCareInvitation("token", token);
  if (!invite) return null;
  const row = invite.row;
  let studio = invite.source === "studio_invite"
    ? (await db.select().from(studios).where(eq(studios.id, row.studioId)).limit(1))[0] : undefined;
  if (invite.source === "studio_invite" && !studio) return null;
  const creatorId = studio?.ownerUserId ?? row.userId;
  const [creator] = await db.select().from(users).where(eq(users.id, creatorId)).limit(1);
  if (!creator) return null;
  const candidates = !isCanonicalPractitionerRole(creator.professionalRole)
    ? await findEmailIdentityCandidates(row.email) : [];
  const providerId = row.providerUserId ?? studio?.ownerUserId ??
    (isCanonicalPractitionerRole(creator.professionalRole) ? creator.id : candidates.length === 1 ? candidates[0].id : "");
  const [provider] = providerId
    ? await db.select().from(users).where(eq(users.id, providerId)).limit(1) : [null];
  if (!studio && provider) [studio] = await db.select().from(studios).where(eq(studios.ownerUserId, provider.id)).limit(1);
  const type = provider?.professionalRole === "physician" ? "clinic" : "studio";
  const providerContext = provider ? await resolveInvitationProviderContext(provider) : null;
  const proName = provider ? [provider.firstName, provider.lastName].filter(Boolean).join(" ") || provider.email : "Your professional";
  return {
    source: invite.source, inviteId: row.id, invitedEmail: row.email,
    proUserId: providerId, studioId: studio?.id ?? null, studioName: studio?.name ?? `${proName}'s ${type === "clinic" ? "Clinic" : "Studio"}`,
    proName, studioType: type, providerRole: providerContext?.relationshipRole ?? provider?.professionalRole ?? null, expiresAt: row.expiresAt,
    alreadyAccepted: invite.source === "care_invite" ? row.accepted : !!row.acceptedAt,
    inviteCode: row.inviteCode, urlToken: token, revokedAt: row.revokedAt,
    organizationId: row.organizationId ?? null, locationId: row.locationId ?? null,
    sourceBusinessId: row.sourceBusinessId ?? null, partnerRecordId: row.partnerRecordId ?? null,
  };
}
export async function getInviteMetadata(token: string): Promise<InviteMetadata | null> {
  const invite = await resolveInviteByToken(token);
  return invite ? {
    studioName: invite.studioName, proName: invite.proName, invitedEmail: invite.invitedEmail,
    maskedEmail: maskEmail(invite.invitedEmail), studioType: invite.studioType,
    expired: !!invite.revokedAt || new Date() >= new Date(invite.expiresAt), alreadyAccepted: invite.alreadyAccepted,
  } : null;
}
export async function acceptInviteByToken(token: string, userId: string,
  _planLookupKey: string | null, _accessTier: string, _isInternalAccount = false
): Promise<{ ok: true; result: AcceptResult } | { ok: false; error: AcceptError }> {
  try {
    const invite = await findCareInvitation("token", token);
    if (!invite) return { ok: false, error: { code: "NOT_FOUND" } };
    return { ok: true, result: await acceptStoredCareInvitation(invite, userId) };
  } catch (error) {
    if (error instanceof CareInvitationError) {
      return { ok: false, error: { code: error.code, status: error.status, message: error.message, ...error.details } };
    }
    const scoped = error as any;
    if (scoped.status && scoped.code) return { ok: false, error: { code: scoped.code, status: scoped.status, message: scoped.message } };
    console.error("[ProCareInvite] Acceptance failed", error);
    return { ok: false, error: { code: "SERVER_ERROR", status: 500, message: "Connection could not be completed." } };
  }
}
