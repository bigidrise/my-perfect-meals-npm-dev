/**
 * coachEvents.ts — fire-and-forget coach activity event emission
 *
 * Calls POST /api/coach/activity-event without blocking the UI.
 * Uses apiRequest so auth headers are handled automatically.
 * Never throws — errors are silently swallowed.
 */
import { apiRequest } from "@/lib/queryClient";

export type CoachEventClass = "usage" | "engagement" | "consumption" | "outcome";

export interface CoachEventParams {
  eventType: string;
  eventClass: CoachEventClass;
  sourceFeature?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export function emitCoachEvent(params: CoachEventParams): void {
  // Fire-and-forget — never awaited, never blocks, never surfaces errors to UI
  apiRequest("/api/coach/activity-event", {
    method: "POST",
    body: JSON.stringify(params),
  }).catch(() => {});
}
