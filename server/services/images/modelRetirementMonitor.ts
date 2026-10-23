import { APPROVED_IMAGE_MODEL, IMAGE_VERIFICATION_MODEL } from "./imageModelRegistry";
import { inspectModelLifecycle } from "./imageModelLifecycle";
import { classifyImageError } from "./imageReliability";

/** Prepared only: no bootstrap import, timer, persistence, notifier or model switch. */
export const MODEL_MONITOR_PLAN = Object.freeze({
  enabled: false, intervalMs: 86_400_000,
  warningDays: Object.freeze([90, 60, 30, 14, 7, 1]),
  automaticSwitching: false,
});

/** Active literal models found in server consumers. Dynamic configured IDs must be supplied too.
 * Sunburst is tested but NOT active and is intentionally absent.
 */
export function activeOpenAIModels(configuredModels: readonly string[] = []): string[] {
  return [...new Set([APPROVED_IMAGE_MODEL.model, IMAGE_VERIFICATION_MODEL,
    "gpt-4o-mini", "gpt-5", "whisper-1", ...configuredModels])];
}

export interface PreparedOwnerAlert {
  key: string; model: string;
  reason: "retirement_window" | "retired" | "model_unavailable";
  shutdownDate: string | null; daysRemaining: number | null; thresholdDays?: number;
}

export function permanentModelAlert(model: string, error: unknown): PreparedOwnerAlert | null {
  if (classifyImageError(error) !== "model_unavailable") return null;
  return { key: `${model}:model_unavailable`, model, reason: "model_unavailable",
    shutdownDate: null, daysRemaining: null };
}

/** Caller supplies any already-delivered keys. Returned alerts are drafts, never sent.
 * Uses the nearest crossed window to catch a missed day without flooding stale warnings.
 * A future activated scheduler must durably record successful alert delivery separately.
 */
export async function prepareDailyModelReview(
  client: { models: { retrieve: (id: string) => Promise<unknown> } },
  options: { now?: Date; configuredModels?: readonly string[]; deliveredKeys?: readonly string[] } = {},
) {
  const now = options.now ?? new Date();
  const delivered = new Set(options.deliveredKeys ?? []);
  const reviews = [];
  const alerts: PreparedOwnerAlert[] = [];
  for (const model of activeOpenAIModels(options.configuredModels)) {
    try {
      const review = await inspectModelLifecycle(client, model, now);
      reviews.push(review);
      if (review.daysRemaining === null) continue; // Missing metadata is UNKNOWN, never immortal.
      const threshold = [...MODEL_MONITOR_PLAN.warningDays].reverse().find(d => review.daysRemaining! <= d);
      if (review.state !== "retired" && threshold === undefined) continue;
      const alert: PreparedOwnerAlert = {
        key: `${model}:${review.shutdownDate}:${review.state === "retired" ? "retired" : threshold}`,
        model, reason: review.state === "retired" ? "retired" : "retirement_window",
        shutdownDate: review.shutdownDate, daysRemaining: review.daysRemaining,
        ...(review.state === "retired" ? {} : { thresholdDays: threshold }),
      };
      if (!delivered.has(alert.key)) alerts.push(alert);
    } catch (error) {
      const alert = permanentModelAlert(model, error);
      reviews.push({ model, state: alert ? "unavailable" : "metadata_unavailable",
        shutdownDate: null, daysRemaining: null });
      if (alert && !delivered.has(alert.key)) alerts.push(alert);
    }
  }
  return { enabled: false, automaticSwitching: false,
    checkedAt: now.toISOString(), nextReviewDue: new Date(now.getTime() + MODEL_MONITOR_PLAN.intervalMs).toISOString(),
    reviews, alerts };
}
