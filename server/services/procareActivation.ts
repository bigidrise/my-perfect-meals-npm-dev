import { db } from "../db";
import { studios, studioBilling, studioMemberships } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import { users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logClientActivity } from "./activityLog";

export class ActivationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ActivationError";
  }
}

export interface ActivationResult {
  studioId: string;
  studioName: string;
  studioType: string;
  membershipId: string;
  clientLinkId: string;
  alreadyActive: boolean;
  ownerUserId: string;
}

/**
 * Fully activates a client under a ProCare professional in one atomic transaction.
 *
 * Guarantees all three required records exist:
 *  1. studio_memberships (status = active)
 *  2. users.is_pro_care = true
 *  3. client_links (active = true)
 *
 * Idempotent — safe to call multiple times with the same arguments.
 * Throws ActivationError for business-logic violations (self-link, conflicting pro).
 */
export async function activateProCareClient(
  clientUserId: string,
  proUserId: string,
  source: string
): Promise<ActivationResult> {
  if (clientUserId === proUserId) {
    throw new ActivationError("SELF_ACTIVATION", "Cannot activate a user as their own ProCare client");
  }

  const [existingStudio] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId));

  let studio = existingStudio ?? null;

  if (!studio) {
    const [pro] = await db.select().from(users).where(eq(users.id, proUserId));
    if (!pro) throw new ActivationError("PRO_NOT_FOUND", `Pro user ${proUserId} not found`);

    const isPhysician = pro.professionalRole === "physician";
    const studioType = isPhysician ? "clinic" : "studio";
    const studioName = isPhysician
      ? `${pro.firstName || pro.username || "Dr."}'s Clinic`
      : `${pro.firstName || pro.username || "Coach"}'s Studio`;

    const [newStudio] = await db
      .insert(studios)
      .values({ ownerUserId: proUserId, name: studioName, type: studioType, contactEmail: pro.email, status: "active" })
      .returning();

    await db.insert(studioBilling).values({
      studioId: newStudio.id,
      planCode: isPhysician ? "clinic_69" : "studio_59",
      status: "trialing",
    });

    studio = newStudio;
    console.log(`🏗️ [ProCareActivation] Auto-created ${studioType} "${studioName}" for pro ${proUserId}`);
  }

  const workspace = studio.type === "clinic" ? "clinician" : "trainer";

  const result = await db.transaction(async (tx) => {
    const [existingMembership] = await tx
      .select()
      .from(studioMemberships)
      .where(eq(studioMemberships.clientUserId, clientUserId));

    let membership;
    let alreadyActive = false;

    if (existingMembership) {
      if (existingMembership.studioId === studio!.id && existingMembership.status === "active") {
        alreadyActive = true;
        membership = existingMembership;
      } else {
        const [updated] = await tx
          .update(studioMemberships)
          .set({ studioId: studio!.id, workspace, status: "active", updatedAt: new Date() })
          .where(eq(studioMemberships.clientUserId, clientUserId))
          .returning();
        membership = updated;
      }
    } else {
      const [inserted] = await tx
        .insert(studioMemberships)
        .values({ studioId: studio!.id, clientUserId, status: "active", workspace, joinedAt: new Date() })
        .returning();
      membership = inserted;
    }

    await tx.update(users).set({ isProCare: true }).where(eq(users.id, clientUserId));

    const [existingLink] = await tx
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientUserId), eq(clientLinks.active, true)));

    if (existingLink && existingLink.proUserId !== proUserId) {
      throw new ActivationError(
        "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL",
        `Client ${clientUserId} already has an active link to a different professional`
      );
    }

    let clientLink;
    if (!existingLink) {
      const [inserted] = await tx
        .insert(clientLinks)
        .values({ clientUserId, proUserId, active: true })
        .returning();
      clientLink = inserted;
    } else {
      clientLink = existingLink;
    }

    return { membership, clientLink, alreadyActive };
  });

  if (!result.alreadyActive) {
    logClientActivity(
      studio.id,
      clientUserId,
      clientUserId,
      "invite_accepted",
      "membership",
      result.membership.id,
      { source, studioName: studio.name }
    ).catch((e) => console.error("⚠️ [ProCareActivation] Activity log failed:", e));
  }

  console.log(
    `✅ [ProCareActivation] Client ${clientUserId} activated under pro ${proUserId} ` +
    `(source: ${source}, alreadyActive: ${result.alreadyActive})`
  );

  return {
    studioId: studio.id,
    studioName: studio.name,
    studioType: studio.type,
    membershipId: result.membership.id,
    clientLinkId: result.clientLink.id,
    alreadyActive: result.alreadyActive,
    ownerUserId: proUserId,
  };
}

/**
 * Self-healing check run at login / signup.
 *
 * If a user has an active studio membership but is missing is_pro_care=true
 * or a client_links record, this repairs those silently — as long as the
 * owning pro is unambiguous.
 *
 * Does NOT touch users who have a conflicting active link to a different pro.
 */
export async function selfHealProCareState(
  clientUserId: string
): Promise<{ healed: boolean; reason?: string }> {
  try {
    const [membership] = await db
      .select({
        membershipId: studioMemberships.id,
        studioId: studioMemberships.studioId,
        ownerUserId: studios.ownerUserId,
      })
      .from(studioMemberships)
      .innerJoin(studios, eq(studios.id, studioMemberships.studioId))
      .where(
        and(
          eq(studioMemberships.clientUserId, clientUserId),
          eq(studioMemberships.status, "active")
        )
      );

    if (!membership) return { healed: false };

    const [user] = await db
      .select({ isProCare: users.isProCare })
      .from(users)
      .where(eq(users.id, clientUserId));

    const [activeLink] = await db
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientUserId), eq(clientLinks.active, true)));

    const missingProCare = !user?.isProCare;
    const missingLink = !activeLink;

    if (!missingProCare && !missingLink) return { healed: false };

    const proUserId = membership.ownerUserId;

    if (activeLink && activeLink.proUserId !== proUserId) {
      console.log(`⚠️ [SelfHeal] Client ${clientUserId} has conflicting pro link — skipping self-heal`);
      return { healed: false, reason: "conflicting_pro_link" };
    }

    if (missingProCare) {
      await db.update(users).set({ isProCare: true }).where(eq(users.id, clientUserId));
    }

    if (missingLink) {
      await db
        .insert(clientLinks)
        .values({ clientUserId, proUserId, active: true })
        .onConflictDoNothing();
    }

    const reason = [
      missingProCare ? "is_pro_care=false" : null,
      missingLink ? "client_links missing" : null,
    ]
      .filter(Boolean)
      .join(", ");

    console.log(`🔧 [SelfHeal] Repaired client ${clientUserId}: fixed [${reason}]`);
    return { healed: true, reason };
  } catch (err) {
    console.error("⚠️ [SelfHeal] Check failed for", clientUserId, ":", err);
    return { healed: false };
  }
}
