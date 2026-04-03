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
  restored: boolean;
  ownerUserId: string;
}

export interface DeactivationResult {
  studioId: string;
  studioName: string;
  clientUserId: string;
  proUserId: string;
  source: string;
}

/**
 * Fully activates a client under a ProCare professional in one atomic transaction.
 *
 * Reconnect behavior (same client + same provider):
 *   - Restores the existing archived membership record (no duplicate card created)
 *   - Reactivates client_links and sets is_pro_care=true
 *
 * New connection (same client + different provider):
 *   - Archives the previous relationship cleanly
 *   - Creates a new membership record for the new studio
 *
 * Guarantees all three required records exist and are active:
 *  1. studio_memberships (status = active, isArchived = false)
 *  2. users.is_pro_care = true
 *  3. client_links (active = true)
 *
 * Idempotent — safe to call multiple times with the same arguments.
 * Throws ActivationError for business-logic violations (self-link, conflicting active pro).
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
    // Look for an existing membership for this exact client+studio pair first (reconnect path)
    const [sameStudioMembership] = await tx
      .select()
      .from(studioMemberships)
      .where(
        and(
          eq(studioMemberships.clientUserId, clientUserId),
          eq(studioMemberships.studioId, studio!.id)
        )
      );

    // Also look for a membership with any other studio (switching provider path)
    const [otherStudioMembership] = !sameStudioMembership
      ? await tx
          .select()
          .from(studioMemberships)
          .where(eq(studioMemberships.clientUserId, clientUserId))
      : [null];

    let membership;
    let alreadyActive = false;
    let restored = false;

    if (sameStudioMembership) {
      if (sameStudioMembership.status === "active" && !sameStudioMembership.isArchived) {
        alreadyActive = true;
        membership = sameStudioMembership;
      } else {
        // Reconnect to same provider — restore the existing record
        const [updated] = await tx
          .update(studioMemberships)
          .set({ status: "active", isArchived: false, workspace, updatedAt: new Date() })
          .where(eq(studioMemberships.id, sameStudioMembership.id))
          .returning();
        membership = updated;
        restored = true;
        console.log(`♻️ [ProCareActivation] Restored existing membership for client ${clientUserId} in studio ${studio!.id}`);
      }
    } else if (otherStudioMembership) {
      // Switching provider — archive old relationship and create new row
      await tx
        .update(studioMemberships)
        .set({ status: "revoked", isArchived: true, updatedAt: new Date() })
        .where(eq(studioMemberships.id, otherStudioMembership.id));

      const [inserted] = await tx
        .insert(studioMemberships)
        .values({ studioId: studio!.id, clientUserId, status: "active", workspace, joinedAt: new Date() })
        .returning();
      membership = inserted;
      console.log(`🔄 [ProCareActivation] Switched provider for client ${clientUserId} to studio ${studio!.id}`);
    } else {
      // Brand new relationship
      const [inserted] = await tx
        .insert(studioMemberships)
        .values({ studioId: studio!.id, clientUserId, status: "active", workspace, joinedAt: new Date() })
        .returning();
      membership = inserted;
    }

    await tx.update(users).set({ isProCare: true }).where(eq(users.id, clientUserId));

    // Check for an active link to a DIFFERENT pro — that would be a conflict
    const [existingActiveLink] = await tx
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientUserId), eq(clientLinks.active, true)));

    if (existingActiveLink && existingActiveLink.proUserId !== proUserId) {
      throw new ActivationError(
        "CLIENT_ALREADY_HAS_ACTIVE_PROFESSIONAL",
        `Client ${clientUserId} already has an active link to a different professional`
      );
    }

    let clientLink;
    if (!existingActiveLink) {
      // Check for an inactive link to this same pro (reconnect path for client_links)
      const [inactiveLink] = await tx
        .select()
        .from(clientLinks)
        .where(and(eq(clientLinks.clientUserId, clientUserId), eq(clientLinks.proUserId, proUserId)));

      if (inactiveLink) {
        const [reactivated] = await tx
          .update(clientLinks)
          .set({ active: true, updatedAt: new Date() })
          .where(eq(clientLinks.id, inactiveLink.id))
          .returning();
        clientLink = reactivated;
        console.log(`♻️ [ProCareActivation] Reactivated existing client_link for ${clientUserId} → ${proUserId}`);
      } else {
        const [inserted] = await tx
          .insert(clientLinks)
          .values({ clientUserId, proUserId, active: true })
          .returning();
        clientLink = inserted;
      }
    } else {
      clientLink = existingActiveLink;
    }

    return { membership, clientLink, alreadyActive, restored };
  });

  if (!result.alreadyActive) {
    const action = result.restored ? "membership_activated" : "membership_created";
    logClientActivity(
      studio.id,
      clientUserId,
      clientUserId,
      action,
      "membership",
      result.membership.id,
      { source, studioName: studio.name, restored: result.restored }
    ).catch((e) => console.error("⚠️ [ProCareActivation] Activity log failed:", e));
  }

  console.log(
    `✅ [ProCareActivation] Client ${clientUserId} activated under pro ${proUserId} ` +
    `(source: ${source}, alreadyActive: ${result.alreadyActive}, restored: ${result.restored})`
  );

  return {
    studioId: studio.id,
    studioName: studio.name,
    studioType: studio.type,
    membershipId: result.membership.id,
    clientLinkId: result.clientLink.id,
    alreadyActive: result.alreadyActive,
    restored: result.restored,
    ownerUserId: proUserId,
  };
}

/**
 * Fully deactivates a ProCare client relationship in one atomic transaction.
 *
 * Guarantees all three required records are cleared:
 *  1. studio_memberships → status='revoked', isArchived=true
 *  2. client_links → active=false
 *  3. users.is_pro_care → false (only if no other active links remain)
 *
 * Idempotent — safe to call when already disconnected.
 * Logs the disconnect event with the source (provider_archive | provider_revoke | client_self_disconnect).
 */
export async function deactivateProCareClient(
  clientUserId: string,
  proUserId: string,
  actorUserId: string,
  source: "provider_archive" | "provider_revoke" | "client_self_disconnect"
): Promise<DeactivationResult> {
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.ownerUserId, proUserId));

  if (!studio) {
    throw new ActivationError("STUDIO_NOT_FOUND", `No studio found for pro ${proUserId}`);
  }

  await db.transaction(async (tx) => {
    // 1. Archive + revoke the studio membership
    await tx
      .update(studioMemberships)
      .set({ status: "revoked", isArchived: true, updatedAt: new Date() })
      .where(
        and(
          eq(studioMemberships.studioId, studio.id),
          eq(studioMemberships.clientUserId, clientUserId)
        )
      );

    // 2. Deactivate the client link for this specific pro
    await tx
      .update(clientLinks)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(clientLinks.clientUserId, clientUserId),
          eq(clientLinks.proUserId, proUserId)
        )
      );

    // 3. Check whether any other active links remain before clearing is_pro_care
    const remainingActiveLinks = await tx
      .select()
      .from(clientLinks)
      .where(and(eq(clientLinks.clientUserId, clientUserId), eq(clientLinks.active, true)));

    if (remainingActiveLinks.length === 0) {
      await tx.update(users).set({ isProCare: false }).where(eq(users.id, clientUserId));
    }
  });

  // Log disconnect event
  logClientActivity(
    studio.id,
    clientUserId,
    actorUserId,
    "membership_disconnected",
    "membership",
    undefined,
    { source, disconnectedBy: actorUserId }
  ).catch((e) => console.error("⚠️ [ProCareDeactivation] Activity log failed:", e));

  console.log(
    `🔌 [ProCareDeactivation] Client ${clientUserId} disconnected from pro ${proUserId} ` +
    `(source: ${source}, actor: ${actorUserId})`
  );

  return {
    studioId: studio.id,
    studioName: studio.name,
    clientUserId,
    proUserId,
    source,
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
