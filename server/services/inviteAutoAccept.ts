import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { studioInvites, studioMemberships, studios } from "../db/schema/studio";
import { careInvite } from "../db/schema/careTeam";
import { normalizeEmailIdentity, resolveEmailIdentityForUser } from "./emailIdentityService";
import { acceptStoredCareInvitation, type StoredCareInvitation } from "./careInvitationAcceptance";

export interface StudioMembershipInfo {
  studioId: string; studioName?: string; studioType?: string; membershipId: string; ownerUserId?: string;
}
export interface AutoAcceptResult { accepted: boolean; membership?: StudioMembershipInfo }
export async function lookupExistingMembership(userId: string): Promise<StudioMembershipInfo | null> {
  try {
    const [row] = await db.select({
      membershipId: studioMemberships.id, studioId: studioMemberships.studioId,
      studioName: studios.name, studioType: studios.type, ownerUserId: studios.ownerUserId,
    }).from(studioMemberships).innerJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(and(eq(studioMemberships.clientUserId, userId), eq(studioMemberships.status, "active"), eq(studioMemberships.isArchived, false)));
    return row ?? null;
  } catch (error) { console.error("[StudioMembership] Lookup failed", error); return null; }
}
export async function autoAcceptPendingInvites(userId: string, _email: string): Promise<AutoAcceptResult> {
  try {
    // The login payload is not email or practitioner authority.
    const identity = await resolveEmailIdentityForUser(userId);
    if (!("user" in identity) || identity.status !== "unique" || identity.candidates.length !== 1) return { accepted: false };
    const email = normalizeEmailIdentity(identity.user.email);
    const care = await db.select().from(careInvite).where(and(
      sql`lower(trim(${careInvite.email})) = ${email}`, eq(careInvite.accepted, false),
      isNull(careInvite.revokedAt), gt(careInvite.expiresAt, new Date()), isNull(careInvite.urlToken))).limit(2);
    const studio = await db.select().from(studioInvites).where(and(
      sql`lower(trim(${studioInvites.email})) = ${email}`, isNull(studioInvites.acceptedAt),
      isNull(studioInvites.revokedAt), gt(studioInvites.expiresAt, new Date()), isNull(studioInvites.urlToken))).limit(2);
    const candidates: StoredCareInvitation[] = [
      ...care.map(row => ({ source: "care_invite" as const, row })),
      ...studio.map(row => ({ source: "studio_invite" as const, row })),
    ];
    // Never silently select a provider from competing invitations. URL-token
    // invitations always retain their explicit /join/studio confirmation step.
    if (candidates.length !== 1) return { accepted: false };
    const result = await acceptStoredCareInvitation(candidates[0], userId);
    // An accepting provider connected the INVITING CLIENT. Do not describe that
    // patient's membership as the provider's personal login membership.
    return result.ownerUserId === userId ? { accepted: true } : {
      accepted: true, membership: {
        studioId: result.studioId, studioName: result.studioName, studioType: result.studioType,
        membershipId: result.membershipId, ownerUserId: result.ownerUserId,
      },
    };
  } catch (error) {
    console.warn("[InviteAutoAccept] Pending invitation requires explicit resolution", (error as any)?.code ?? "SERVER_ERROR");
    return { accepted: false };
  }
}
