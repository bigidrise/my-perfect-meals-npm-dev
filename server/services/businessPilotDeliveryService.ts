import { sql } from "drizzle-orm";
import { db } from "../db";
import { getPilotReviewConfiguration } from "../config/pilotReviewConfig";
import { getBusinessPilotAssignments, getPilotAssignmentPack } from "./businessPilotGuidanceService";

export const MESSAGE_TYPES = ["week_1", "week_2", "week_3", "week_4", "midweek_1", "midweek_2", "midweek_3", "midweek_4", "final_review"] as const;
const DAY_FOR_WEEK = [1, 8, 15, 22];
const DAY_FOR_MIDWEEK = [4, 11, 18, 25];

export function pilotDeliverySchedule(start: Date, now = new Date()) {
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  return [
    ...DAY_FOR_WEEK.map((d, i) => ({ week: i + 1, messageType: `week_${i + 1}`, due: new Date(start.getTime() + (d - 1) * 86400000), eligible: day >= d && day <= d + 6 })),
    ...DAY_FOR_MIDWEEK.map((d, i) => ({ week: i + 1, messageType: `midweek_${i + 1}`, due: new Date(start.getTime() + (d - 1) * 86400000), eligible: day >= d && day <= d + 2 })),
    { week: 4, messageType: "final_review", due: new Date(start.getTime() + 26 * 86400000), eligible: day >= 27 && day <= 29 },
  ];
}

export function shouldSendMidweek(completedCount: number, totalCount: number) {
  return totalCount > 0 && completedCount / totalCount < 0.5;
}
export function deliveryCopy(messageType: string) {
  if (messageType.startsWith("midweek_")) return "A quick nudge: your current Business pilot progress is below halfway. Open the dashboard to continue and schedule a review.";
  if (messageType === "final_review") return "Your Business pilot is nearing completion. Please schedule your pilot review now to discuss outcomes and next steps.";
  const week = Number(messageType.slice(-1));
  return [
    "Your Business pilot is underway. Learn My Perfect Meals personally, then schedule your review.",
    "Use My Perfect Meals with real people and schedule your pilot review.",
    "Put My Perfect Meals into your workflow and schedule your pilot review.",
    "Your Business pilot is nearing completion. Schedule your pilot review now.",
  ][week - 1] ?? "Continue your Business pilot and schedule a review.";
}

export async function enqueueBusinessPilotDeliveries(pilotId: string, start: Date) {
  const config = getPilotReviewConfiguration();
  for (const item of pilotDeliverySchedule(start).filter((candidate) => candidate.eligible)) {
    await db.execute(sql`
      INSERT INTO business_pilot_delivery_attempts
        (pilot_id, recipient_email, message_type, week, purpose, next_retry_at)
      SELECT ${pilotId}, lower(a.champion_email), ${item.messageType}, ${item.week}, 'operational', ${item.due}
      FROM organizational_pilots p
      JOIN organizational_pilot_authorizations a ON a.id = p.authorization_id
      JOIN business_members m ON m.business_id = p.business_id
      JOIN users u ON lower(u.email) = lower(a.champion_email) AND u.id = m.user_id
      WHERE p.id = ${pilotId} AND m.status = 'active' AND m.role IN ('owner','admin')
      ON CONFLICT (pilot_id, recipient_email, message_type, week) DO NOTHING
    `);
  }
  return config;
}

/** Claims one row atomically. Leases make restarts and concurrent pollers safe. */
export async function claimBusinessPilotDelivery(now = new Date()) {
  const result: any = await db.execute(sql`
    UPDATE business_pilot_delivery_attempts d SET status = 'claimed', lease_until = ${new Date(now.getTime() + 10 * 60_000)},
      attempts = d.attempts + 1, updated_at = now()
    WHERE d.id = (
      SELECT id FROM business_pilot_delivery_attempts
      WHERE (status = 'pending' OR (status = 'claimed' AND lease_until < ${now}) OR (status = 'failed' AND attempts < 5 AND next_retry_at <= ${now}))
        AND next_retry_at <= ${now}
      ORDER BY next_retry_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING *
  `);
  return (result.rows ?? result)[0] ?? null;
}

export async function deliverClaimedBusinessPilotDelivery(delivery: any) {
  if (process.env.NODE_ENV === "production") return "suppressed" as const;
  const suppression: any = await db.execute(sql`SELECT reason FROM business_pilot_suppressions WHERE recipient_email = ${delivery.recipient_email} AND purpose = 'operational' LIMIT 1`);
  if ((suppression.rows ?? suppression).length) {
    await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = 'suppressed', failure = ${(suppression.rows ?? suppression)[0].reason}, lease_until = NULL, updated_at = now() WHERE id = ${delivery.id}`);
    return "suppressed" as const;
  }
  // Revalidate the authorization champion/contact immediately before delivery.
  const recipient: any = await db.execute(sql`
    SELECT a.champion_email, b.commercial_access_started_at, b.commercial_access_ends_at, b.commercial_access_mode
    FROM organizational_pilots p
    JOIN organizational_pilot_authorizations a ON a.id = p.authorization_id
    JOIN businesses b ON b.id = p.business_id
    JOIN business_members m ON m.business_id = p.business_id
    JOIN users u ON lower(u.email) = lower(a.champion_email) AND u.id = m.user_id
    WHERE p.id = ${delivery.pilot_id} AND p.status = 'active'
      AND b.commercial_access_mode = 'onboarding_pilot'
      AND b.commercial_access_started_at <= now() AND b.commercial_access_ends_at > now()
      AND p.pilot_start_at = b.commercial_access_started_at
      AND p.pilot_end_at = b.commercial_access_ends_at
      AND lower(a.champion_email) = lower(${delivery.recipient_email})
      AND m.status = 'active' AND m.role IN ('owner','admin')
    LIMIT 1
  `);
  if (!(recipient.rows ?? recipient).length) {
    await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = 'suppressed', failure = 'removed_contact', lease_until = NULL, updated_at = now() WHERE id = ${delivery.id}`);
    return "suppressed" as const;
  }
  try {
    const config = getPilotReviewConfiguration();
    const { sendBusinessPilotReviewEmail } = await import("./emailService");
    const sent = await sendBusinessPilotReviewEmail({ to: delivery.recipient_email, week: delivery.week, messageType: delivery.message_type, ...config, wording: deliveryCopy(delivery.message_type) });
    if (!sent) throw new Error("Resend is not configured.");
    await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = 'sent', provider_id = ${sent.id ?? null}, lease_until = NULL, failure = NULL, updated_at = now() WHERE id = ${delivery.id}`);
    return "sent" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery failed";
    const terminal = Number(delivery.attempts) >= 5;
    await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = ${terminal ? "failed" : "failed"}, failure = ${terminal ? `terminal:${message}` : message}, lease_until = NULL, next_retry_at = now() + (${Math.min(240, 15 * 2 ** Math.max(0, Number(delivery.attempts) - 1))} || ' minutes')::interval, updated_at = now() WHERE id = ${delivery.id}`);
    return "failed" as const;
  }
}

export async function processDueBusinessPilotDeliveries(options: { now?: Date; batchSize?: number } = {}) {
  const now = options.now ?? new Date();
  const batchSize = Math.max(1, Math.min(25, options.batchSize ?? 10));
  const pilots: any = await db.execute(sql`
    SELECT p.id, b.commercial_access_started_at AS started_at
    FROM organizational_pilots p JOIN businesses b ON b.id = p.business_id
    WHERE p.status = 'active' AND b.commercial_access_mode = 'onboarding_pilot'
      AND b.commercial_access_started_at <= ${now} AND b.commercial_access_ends_at > ${now}
      AND p.pilot_start_at = b.commercial_access_started_at
      AND p.pilot_end_at = b.commercial_access_ends_at
  `);
  for (const pilot of pilots.rows ?? pilots) await enqueueBusinessPilotDeliveries(pilot.id, new Date(pilot.started_at));
  const outcomes: string[] = [];
  for (let i = 0; i < batchSize; i++) {
    const claimed = await claimBusinessPilotDelivery(now);
    if (!claimed) break;
    if (claimed.message_type.startsWith("midweek_")) {
      const progress: any = await db.execute(sql`
        SELECT c.assignment_key, c.completed, g.assignment_pack
        FROM business_pilot_completions c
        JOIN business_pilot_guidance g ON g.pilot_id = c.pilot_id AND g.program_version = c.program_version
        WHERE c.pilot_id = ${claimed.pilot_id}
      `);
      const rows = progress.rows ?? progress;
      const week = Number(claimed.message_type.slice(-1));
      const pack = getPilotAssignmentPack(rows[0]?.assignment_pack);
      const assignments = getBusinessPilotAssignments(week, pack);
      const completed = new Set(rows.filter((r: any) => r.completed).map((r: any) => r.assignment_key));
      if (!shouldSendMidweek(assignments.filter((a) => completed.has(a.key)).length, assignments.length)) {
        await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = 'suppressed', failure = 'progress_at_or_above_50_percent', lease_until = NULL WHERE id = ${claimed.id}`);
        outcomes.push("suppressed");
        continue;
      }
    }
    outcomes.push(await deliverClaimedBusinessPilotDelivery(claimed));
  }
  return { processed: outcomes.length, outcomes };
}

export async function suppressBusinessPilotRecipient(email: string, reason: "bounce" | "complaint" | "operational_opt_out" | "invalid_contact" | "removed_contact") {
  await db.execute(sql`INSERT INTO business_pilot_suppressions (recipient_email, reason, purpose) VALUES (lower(${email}), ${reason}, 'operational') ON CONFLICT (recipient_email, purpose) DO UPDATE SET reason = EXCLUDED.reason`);
  await db.execute(sql`UPDATE business_pilot_delivery_attempts SET status = 'suppressed', failure = ${reason}, lease_until = NULL WHERE lower(recipient_email) = lower(${email}) AND status NOT IN ('sent','suppressed')`);
}