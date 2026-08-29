import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { hydrationAthleticCoachingGuidance } from "../../db/schema/hydration";
import type {
  AthleticHydrationCoachingInput,
  AthleticHydrationCoachingRecord,
} from "@shared/hydration/professional";

type CoachingRow = typeof hydrationAthleticCoachingGuidance.$inferSelect;

function mapRow(row: CoachingRow): AthleticHydrationCoachingRecord {
  return {
    id: row.id,
    subjectUserId: row.subjectUserId,
    coachUserId: row.coachUserId,
    organizationId: row.organizationId ?? "",
    trainingContext: row.trainingContext as AthleticHydrationCoachingRecord["trainingContext"],
    emphasis: row.emphasis as AthleticHydrationCoachingRecord["emphasis"],
    reminderStrategy: row.reminderStrategy,
    beverageStrategy: row.beverageStrategy,
    athleteCreatorIntent: row.athleteCreatorIntent,
    notes: row.notes,
    startsOn: row.startsOn,
    reviewOn: row.reviewOn,
    status: row.status as AthleticHydrationCoachingRecord["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getActiveAthleticHydrationCoaching(
  subjectUserId: string,
): Promise<AthleticHydrationCoachingRecord | null> {
  const [row] = await db
    .select()
    .from(hydrationAthleticCoachingGuidance)
    .where(and(
      eq(hydrationAthleticCoachingGuidance.subjectUserId, subjectUserId),
      eq(hydrationAthleticCoachingGuidance.status, "active"),
    ))
    .orderBy(desc(hydrationAthleticCoachingGuidance.createdAt))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function saveAthleticHydrationCoaching(input: {
  subjectUserId: string;
  coachUserId: string;
  organizationId: string;
  guidance: AthleticHydrationCoachingInput;
}): Promise<AthleticHydrationCoachingRecord> {
  return db.transaction(async (tx) => {
    await tx
      .update(hydrationAthleticCoachingGuidance)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(and(
        eq(hydrationAthleticCoachingGuidance.subjectUserId, input.subjectUserId),
        eq(hydrationAthleticCoachingGuidance.status, "active"),
      ));
    const [created] = await tx
      .insert(hydrationAthleticCoachingGuidance)
      .values({
        subjectUserId: input.subjectUserId,
        coachUserId: input.coachUserId,
        organizationId: input.organizationId,
        ...input.guidance,
      })
      .returning();
    return mapRow(created);
  });
}

export async function revokeAthleticHydrationCoaching(input: {
  subjectUserId: string;
  guidanceId: string;
  coachUserId: string;
}): Promise<boolean> {
  const [updated] = await db
    .update(hydrationAthleticCoachingGuidance)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(
      eq(hydrationAthleticCoachingGuidance.id, input.guidanceId),
      eq(hydrationAthleticCoachingGuidance.subjectUserId, input.subjectUserId),
      eq(hydrationAthleticCoachingGuidance.coachUserId, input.coachUserId),
      eq(hydrationAthleticCoachingGuidance.status, "active"),
    ))
    .returning({ id: hydrationAthleticCoachingGuidance.id });
  return Boolean(updated);
}