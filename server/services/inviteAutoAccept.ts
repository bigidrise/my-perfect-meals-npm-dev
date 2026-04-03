import { db } from "../db";
import { studioInvites, studioMemberships, studios } from "../db/schema/studio";
import { careInvite, careTeamMember } from "../db/schema/careTeam";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { logClientActivity } from "./activityLog";
import { activateProCareClient, ActivationError } from "./procareActivation";

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
      console.log(`⚠️ [InviteAutoAccept] User already has a studio membership`);
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

      let activation;
      try {
        activation = await activateProCareClient(userId, trainerUserId, "care_team_invite");
      } catch (err) {
        if (err instanceof ActivationError) {
          console.error(`❌ [InviteAutoAccept] Activation failed (${err.code}): ${err.message}`);
          return { accepted: false };
        }
        throw err;
      }

      for (const ci of pendingCareInvites) {
        await db
          .update(careInvite)
          .set({ accepted: true })
          .where(eq(careInvite.id, ci.id));
      }

      await db
        .update(careTeamMember)
        .set({ proUserId: userId, status: "active", updatedAt: new Date() })
        .where(
          and(
            eq(careTeamMember.userId, trainerUserId),
            eq(careTeamMember.email, normalizedEmail)
          )
        );

      await logClientActivity(
        activation.studioId,
        userId,
        trainerUserId,
        "membership_created",
        "membership",
        activation.membershipId,
        { autoAccepted: true, source: "care_team_invite" }
      );

      console.log(`✅ [InviteAutoAccept] Auto-accepted care team invite for user ${userId}`);

      return {
        accepted: true,
        membership: {
          studioId: activation.studioId,
          studioName: activation.studioName,
          studioType: activation.studioType,
          membershipId: activation.membershipId,
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

      const [studio] = await db
        .select()
        .from(studios)
        .where(eq(studios.id, invite.studioId));

      if (!studio) {
        console.error(`❌ [InviteAutoAccept] Studio ${invite.studioId} not found for invite ${invite.id}`);
        return { accepted: false };
      }

      let activation;
      try {
        activation = await activateProCareClient(userId, studio.ownerUserId, "studio_invite");
      } catch (err) {
        if (err instanceof ActivationError) {
          console.error(`❌ [InviteAutoAccept] Activation failed (${err.code}): ${err.message}`);
          return { accepted: false };
        }
        throw err;
      }

      for (const si of pendingStudioInvites) {
        await db
          .update(studioInvites)
          .set({ acceptedAt: new Date() })
          .where(eq(studioInvites.id, si.id));
      }

      if (studio.type === "clinic" && studio.ownerUserId) {
        await db
          .insert(careTeamMember)
          .values({
            userId: studio.ownerUserId,
            proUserId: userId,
            name: invite.email.split("@")[0],
            email: invite.email,
            role: "patient",
            status: "active",
            permissions: { canViewMacros: true, canAddMeals: false, canEditPlan: true },
          })
          .onConflictDoNothing();
      }

      console.log(`✅ [InviteAutoAccept] Auto-accepted studio invite for user ${userId}`);

      return {
        accepted: true,
        membership: {
          studioId: activation.studioId,
          studioName: activation.studioName,
          studioType: activation.studioType,
          membershipId: activation.membershipId,
          ownerUserId: studio.ownerUserId,
        },
      };
    }

    return { accepted: false };
  } catch (error) {
    console.error("❌ [InviteAutoAccept] Error auto-accepting invite:", error);
    return { accepted: false };
  }
}
