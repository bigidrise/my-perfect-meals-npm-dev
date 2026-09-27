import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { stripeBillingEvents } from "../db/schema/stripeBilling";

export interface BillingEventClaim {
  eventId: string;
  eventType: string;
  eventCreatedAt: Date;
  customerId?: string | null;
  subscriptionId?: string | null;
  userId?: string | null;
  source: "webhook" | "reconciliation";
}

export async function claimBillingEvent(
  event: BillingEventClaim,
): Promise<"claimed" | "duplicate" | "in_progress"> {
  const [inserted] = await db
    .insert(stripeBillingEvents)
    .values({
      ...event,
      customerId: event.customerId ?? null,
      subscriptionId: event.subscriptionId ?? null,
      userId: event.userId ?? null,
      status: "processing",
    })
    .onConflictDoNothing()
    .returning({ eventId: stripeBillingEvents.eventId });

  if (inserted) return "claimed";

  const staleProcessingCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const [reclaimed] = await db
    .update(stripeBillingEvents)
    .set({
      status: "processing",
      attempts: sql`${stripeBillingEvents.attempts} + 1`,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(stripeBillingEvents.eventId, event.eventId),
      or(
        eq(stripeBillingEvents.status, "failed"),
        and(
          eq(stripeBillingEvents.status, "processing"),
          lt(stripeBillingEvents.updatedAt, staleProcessingCutoff),
        ),
      ),
    ))
    .returning({ eventId: stripeBillingEvents.eventId });

  if (reclaimed) return "claimed";
  const [existing] = await db.select({ status: stripeBillingEvents.status })
    .from(stripeBillingEvents)
    .where(eq(stripeBillingEvents.eventId, event.eventId))
    .limit(1);
  // An uncommitted transition is not a completed event. Tell Stripe to retry
  // rather than acknowledging a crash between claim and entitlement update.
  return existing?.status === "processed" || existing?.status === "ignored"
    ? "duplicate"
    : "in_progress";
}

export async function completeBillingEvent(
  eventId: string,
  status: "processed" | "ignored",
  userId?: string | null,
): Promise<void> {
  await db
    .update(stripeBillingEvents)
    .set({
      status,
      userId: userId ?? undefined,
      processedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(stripeBillingEvents.eventId, eventId));
}

export async function failBillingEvent(eventId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db
    .update(stripeBillingEvents)
    .set({
      status: "failed",
      errorMessage: message.slice(0, 1000),
      updatedAt: new Date(),
    })
    .where(eq(stripeBillingEvents.eventId, eventId));
}
