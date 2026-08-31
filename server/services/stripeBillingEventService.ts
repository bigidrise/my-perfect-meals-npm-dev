import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { stripeBillingEvents } from "../db/schema/stripeBilling";
import { runStripeBillingMigration } from "../db/migrations/runStripeBillingMigration";

let schemaReady: Promise<void> | null = null;

export function ensureStripeBillingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = runStripeBillingMigration(db).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

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
): Promise<"claimed" | "duplicate"> {
  await ensureStripeBillingSchema();
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
      eq(stripeBillingEvents.status, "failed"),
    ))
    .returning({ eventId: stripeBillingEvents.eventId });

  return reclaimed ? "claimed" : "duplicate";
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
