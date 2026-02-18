import { db } from "../db";
import { studioInvites, studioMemberships, studios } from "../db/schema/studio";
import { careInvite, careTeamMember } from "../db/schema/careTeam";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { logClientActivity } from "./activityLog";
import { ensureStudioForTrainer } from "./studioBridge";

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

    const existingMembership = await lookupExistingMembership(userId);
    if (existingMembership) {
      console.log(`⚠️ [InviteAutoAccept] User ${email} already has a studio membership`);
      return { accepted: false, membership: existingMembership };
    }

    const pendingCareInvites = await db
      .select()
      .from(careInvite)
      .where(
        and(
          eq(careInvite.email, normalizedEmail),
          eq(careInvite.accepted, false),
          gt(careInvite.expiresAt, new Date())
        )
      )
      .orderBy(desc(careInvite.createdAt));

    if (pendingCareInvites.length > 0) {
      const invite = pendingCareInvites[0];
      const trainerUserId = invite.userId;

      const studioInfo = await ensureStudioForTrainer(trainerUserId);
      if (!studioInfo) {
        console.error(`❌ [InviteAutoAccept] Could not create/find studio for trainer ${trainerUserId}`);
        return { accepted: false };
      }

      const result = await db.transaction(async (tx) => {
        const [membership] = await tx
          .insert(studioMemberships)
          .values({
            studioId: studioInfo.studioId,
            clientUserId: userId,
            status: "active",
            joinedAt: new Date(),
          })
          .returning();

        for (const ci of pendingCareInvites) {
          await tx
            .update(careInvite)
            .set({ accepted: true })
            .where(eq(careInvite.id, ci.id));
        }

        await tx
          .update(careTeamMember)
          .set({ proUserId: userId, status: "active", updatedAt: new Date() })
          .where(
            and(
              eq(careTeamMember.userId, trainerUserId),
              eq(careTeamMember.email, normalizedEmail)
            )
          );

        return membership;
      });

      await logClientActivity(
        studioInfo.studioId,
        userId,
        userId,
        "invite_accepted",
        "membership",
        result.id,
        { email: normalizedEmail, autoAccepted: true, studioName: studioInfo.studioName, source: "care_team_invite" }
      );

      await logClientActivity(
        studioInfo.studioId,
        userId,
        trainerUserId,
        "membership_created",
        "membership",
        result.id,
        { autoAccepted: true, source: "care_team_invite" }
      );

      console.log(`✅ [InviteAutoAccept] Auto-accepted care team invite for ${email} → studio "${studioInfo.studioName}"`);

      return {
        accepted: true,
        membership: {
          studioId: studioInfo.studioId,
          studioName: studioInfo.studioName,
          studioType: studioInfo.studioType,
          membershipId: result.id,
          ownerUserId: trainerUserId,
        },
      };
    }

    const pendingStudioInvites = await db
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

    if (pendingStudioInvites.length > 0) {
      const invite = pendingStudioInvites[0];

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

        for (const si of pendingStudioInvites) {
          await tx
            .update(studioInvites)
            .set({ acceptedAt: new Date() })
            .where(eq(studioInvites.id, si.id));
        }

        return membership;
      });

      const [studio] = await db
        .select()
        .from(studios)
        .where(eq(studios.id, invite.studioId));

      console.log(`✅ [InviteAutoAccept] Auto-accepted studio invite for ${email} → studio "${studio?.name}"`);

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
    }

    return { accepted: false };
  } catch (error) {
    console.error("❌ [InviteAutoAccept] Error auto-accepting invite:", error);
    return { accepted: false };
  }
}
