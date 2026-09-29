import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { studios, studioBilling } from "../db/schema/studio";
import { isLegacyStudioBilling } from "./independentStudioAccess";

export class StudioAddonAttachmentError extends Error {
  constructor(message: string, public readonly status: number = 409) {
    super(message);
  }
}

/**
 * Only the owner-owned, unbilled legacy Studio can be toggled here. This never
 * touches Personal, Organization, Stripe, billing, memberships, or Studio data.
 */
export async function changeStudioAddonAttachment(
  ownerUserId: string,
  action: "disconnect" | "reconnect",
): Promise<{ studioId: string; status: "active" | "disconnected" }> {
  return db.transaction(async (tx) => {
    const [studio] = await tx.select({ id: studios.id, status: studios.status })
      .from(studios).where(eq(studios.ownerUserId, ownerUserId))
      .for("update").limit(2);
    if (!studio) throw new StudioAddonAttachmentError("No Studio is attached to this account.", 404);
    const [billing] = await tx.select({
      customerId: studioBilling.stripeCustomerId,
      subscriptionId: studioBilling.stripeSubscriptionId,
      reservationId: studioBilling.stripeCheckoutReservationId,
      checkoutSessionId: studioBilling.stripeCheckoutSessionId,
      planKey: studioBilling.planCode,
      status: studioBilling.status,
    }).from(studioBilling).where(eq(studioBilling.studioId, studio.id)).for("update").limit(1);
    if (!isLegacyStudioBilling(billing)) {
      throw new StudioAddonAttachmentError(
        "This Studio has billing or a checkout in progress. Use its separate renewal controls; no access was changed.",
      );
    }
    if (studio.status !== "active" && studio.status !== "disconnected") {
      throw new StudioAddonAttachmentError("This Studio's status needs review before changing access.");
    }
    const target = action === "disconnect" ? "disconnected" : "active";
    if (studio.status !== target) {
      const [updated] = await tx.update(studios)
        .set({ status: target, updatedAt: new Date() })
        .where(and(eq(studios.id, studio.id), eq(studios.ownerUserId, ownerUserId),
          eq(studios.status, studio.status)))
        .returning({ id: studios.id });
      if (!updated) throw new StudioAddonAttachmentError("Studio access changed during this request. Refresh and try again.");
    }
    return { studioId: studio.id, status: target };
  });
}