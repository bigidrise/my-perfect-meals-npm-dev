import { db } from "../db";
import { studioInvites, studioMemberships, studios } from "../db/schema/studio";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { logClientActivity } from "./activityLog";

export interface StudioMembershipInfo {
  studioId: string;
  studioName?: string;
  studioType?: string;
  membershipId: string;
  ownerUserId?: string;
}

export interface AutoAcceptResult {
  accepted: boolean;
  membership?: StudioMembershipInfo;
}

export async function lookupExistingMembership(
  userId: string
): Promise<StudioMembershipInfo | null> {
  try {
    const [existing] = await db
      .select({
        membershipId: studioMemberships.id,
        studioId: studioMemberships.studioId,
        studioName: studios.name,
        studioType: studios.type,
        ownerUserId: studios.ownerUserId,
      })
      .from(studioMemberships)
      .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(eq(studioMemberships.clientUserId, userId));

    if (!existing) return null;

    return {
      studioId: existing.studioId,
      studioName: existing.studioName ?? undefined,
      studioType: existing.studioType ?? undefined,
      membershipId: existing.membershipId,
      ownerUserId: existing.ownerUserId ?? undefined,
    };
  } catch (error) {
    console.error("❌ [StudioMembership] Error looking up membership:", error);
    return null;
  }
}

export async function autoAcceptPendingInvites(
  userId: string,
  email: string
): Promise<AutoAcceptResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const pendingInvites = await db
      .select()
      .from(studioInvites)
      .where(
        and(
          eq(studioInvites.email, normalizedEmail),
          isNull(studioInvites.acceptedAt),
          gt(studioInvites.expiresAt, new Date())
        )
      )
      .orderBy(desc(studioInvites.createdAt));

    if (pendingInvites.length === 0) {
      return { accepted: false };
    }

    const existingMembership = await lookupExistingMembership(userId);
    if (existingMembership) {
      console.log(`⚠️ [InviteAutoAccept] User ${email} already has a studio membership, skipping auto-accept`);
      return { accepted: false, membership: existingMembership };
    }

    const invite = pendingInvites[0];

    const result = await db.transaction(async (tx) => {
      const [membership] = await tx
        .insert(studioMemberships)
        .values({
          studioId: invite.studioId,
          clientUserId: userId,
          status: "active",
          joinedAt: new Date(),
        })
        .returning();

      await tx
        .update(studioInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(studioInvites.id, invite.id));

      if (pendingInvites.length > 1) {
        for (const extra of pendingInvites.slice(1)) {
          await tx
            .update(studioInvites)
            .set({ acceptedAt: new Date() })
            .where(eq(studioInvites.id, extra.id));
        }
        console.log(`ℹ️ [InviteAutoAccept] Marked ${pendingInvites.length - 1} additional invites as accepted for ${email}`);
      }

      return membership;
    });

    const [studio] = await db
      .select()
      .from(studios)
      .where(eq(studios.id, invite.studioId));

    await logClientActivity(
      invite.studioId,
      userId,
      userId,
      "invite_accepted",
      "membership",
      result.id,
      { email: normalizedEmail, autoAccepted: true, studioName: studio?.name }
    );

    await logClientActivity(
      invite.studioId,
      userId,
      studio?.ownerUserId || userId,
      "membership_created",
      "membership",
      result.id,
      { autoAccepted: true }
    );

    console.log(`✅ [InviteAutoAccept] Auto-accepted invite for ${email} → studio "${studio?.name}" (${invite.studioId})`);

    return {
      accepted: true,
      membership: {
        studioId: invite.studioId,
        studioName: studio?.name,
        studioType: studio?.type,
        membershipId: result.id,
        ownerUserId: studio?.ownerUserId,
      },
    };
  } catch (error) {
    console.error("❌ [InviteAutoAccept] Error auto-accepting invite:", error);
    return { accepted: false };
  }
}
