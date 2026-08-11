/**
 * Coach Follow-up Cron — Phase 5
 *
 * Runs every 10 minutes. Finds due coach_followups (status='pending', due_at <= NOW())
 * and dispatches the follow-up worker for each.
 *
 * Idempotency:
 *   - Worker atomically claims each followup by setting status='processing' before running.
 *   - If the worker crashes, it resets to 'pending' so the next cron run retries.
 *   - The unique partial index on (plan_id) WHERE status='pending' prevents duplicate
 *     pending followups for the same plan.
 *
 * This is a background safety net. Users who open Coach's Corner while a followup
 * is pending get it delivered inline via the /api/coach/followup/due endpoint.
 */

import cron from "node-cron";
import { processDueFollowups } from "../services/coaching/followupWorker";

let initialized = false;

export function initCoachFollowupCron(): void {
  if (initialized) return;
  initialized = true;

  // Every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      await processDueFollowups();
    } catch (err: any) {
      console.error("[CoachFollowupCron] Cron error:", err.message);
    }
  });

  console.log("📅 Coach follow-up cron initialized (every 10 minutes)");
}
