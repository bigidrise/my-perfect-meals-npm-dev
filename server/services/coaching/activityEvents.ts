/**
 * Platform Activity Events Service — Phase 3B
 *
 * Fire-and-forget helper for emitting meaningful nutrition/platform actions
 * to the platform_activity_events table.
 *
 * USAGE RULE: Always call with .catch() — never await in a route handler.
 * Activity event emission must never block or fail a user-facing response.
 *
 *   emitActivityEvent({ ... }).catch(err =>
 *     console.error("[ActivityEvents]", err.message)
 *   );
 *
 * EVENT CLASS DEFINITIONS:
 *   usage       = user opened, generated, or explored a feature
 *   engagement  = user took a deliberate action (save, add to list, scan)
 *   consumption = user explicitly confirmed/logged what they consumed
 *   outcome     = platform recorded a result (weight log, plan completion)
 *
 * Emit only meaningful nutrition actions. Do NOT emit generic UI events
 * (button_clicked, modal_opened, tab_changed).
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

// ─── Event Type Catalogue ─────────────────────────────────────────────────────

export type EventClass = "usage" | "engagement" | "consumption" | "outcome";

export type SourceFeature =
  | "restaurant_guide"
  | "beverage_creator"
  | "dessert_creator"
  | "fridge_rescue"
  | "meal_builder"
  | "smart_scan"
  | "product_intelligence"
  | "shopping_list"
  | "macro_logger"
  | "performance_hub"
  | "create_a_dish"
  | "craving_creator"
  | "inspiration"
  | "coach_corner"
  | "pregnancy_coach"
  | "parents_corner";

export type PlatformEventType =
  // ── Restaurant Guide ────────────────────────────────────────────────────────
  | "restaurant_recommendations_generated"   // usage    — guide generated for a restaurant
  | "restaurant_meal_added_to_macros"        // consumption — user confirmed they ate it

  // ── Beverage Creator ────────────────────────────────────────────────────────
  | "beverage_generated"                     // usage
  | "beverage_added_to_macros"               // consumption

  // ── Dessert Creator ─────────────────────────────────────────────────────────
  | "dessert_generated"                      // usage
  | "dessert_added_to_macros"                // consumption

  // ── Fridge Rescue ───────────────────────────────────────────────────────────
  | "fridge_rescue_generated"                // usage
  | "fridge_rescue_meal_saved"               // engagement

  // ── Meal Builders (general) ─────────────────────────────────────────────────
  | "meal_generated"                         // usage
  | "meal_saved"                             // engagement
  | "meal_added_to_macros"                   // consumption

  // ── Smart Scan / Product Intelligence ───────────────────────────────────────
  | "product_scan_completed"                 // engagement — grade + product name known
  | "product_added_to_diary"                 // consumption

  // ── Shopping List ───────────────────────────────────────────────────────────
  | "shopping_item_added"                    // engagement
  | "shopping_list_completed"                // outcome

  // ── Craving Creator / Inspiration ────────────────────────────────────────────
  | "craving_meal_generated"                 // usage
  | "inspiration_meal_generated"             // usage

  // ── Coaching ────────────────────────────────────────────────────────────────
  | "coach_message_sent"                     // usage
  | "coach_plan_accepted"                    // engagement
  | "coach_plan_completed";                  // outcome

// ─── Subject Types ────────────────────────────────────────────────────────────

export type SubjectType = "user" | "child";

// ─── Emit Helper ─────────────────────────────────────────────────────────────

export interface ActivityEventParams {
  /** The authenticated user who owns this event */
  ownerUserId: string;
  /** Who the event is about — defaults to "user" (the owner) */
  subjectType?: SubjectType;
  /** Subject's ID — defaults to ownerUserId */
  subjectId?: string;
  eventType: PlatformEventType;
  eventClass: EventClass;
  sourceFeature?: SourceFeature;
  /** Optional: type of entity this event references */
  entityType?: string;
  /** Optional: ID of the entity (e.g. saved_meal.id, session.id) */
  entityId?: string;
  /** Optional: event-specific metadata. Keep small. */
  metadata?: Record<string, unknown>;
  /** When the action happened — defaults to NOW() */
  occurredAt?: Date;
}

/**
 * Emit a platform activity event.
 *
 * ALWAYS call with .catch() — never await in a route handler.
 * Errors here must never reach the user.
 *
 * @example
 * emitActivityEvent({
 *   ownerUserId: req.user.id,
 *   eventType: "restaurant_recommendations_generated",
 *   eventClass: "usage",
 *   sourceFeature: "restaurant_guide",
 *   metadata: { restaurant_name: body.restaurantName, cuisine: body.cuisine },
 * }).catch(err => console.error("[ActivityEvents]", err.message));
 */
export async function emitActivityEvent(
  params: ActivityEventParams
): Promise<void> {
  const {
    ownerUserId,
    subjectType = "user",
    subjectId = ownerUserId,
    eventType,
    eventClass,
    sourceFeature,
    entityType,
    entityId,
    metadata,
    occurredAt,
  } = params;

  await db.execute(sql`
    INSERT INTO platform_activity_events
      (owner_user_id, subject_type, subject_id, event_type, event_class,
       source_feature, entity_type, entity_id, metadata, occurred_at, created_at)
    VALUES
      (${ownerUserId}, ${subjectType}, ${subjectId}, ${eventType}, ${eventClass},
       ${sourceFeature ?? null}, ${entityType ?? null}, ${entityId ?? null},
       ${metadata ? JSON.stringify(metadata) : null}::jsonb,
       ${(occurredAt ?? new Date()).toISOString()}::timestamptz,
       NOW())
  `);
}

// ─── Batch Query Helpers (used by Observers) ──────────────────────────────────

export interface EventSummary {
  eventType: string;
  eventClass: string;
  count: number;
  latestAt: Date | null;
}

/**
 * Fetch event counts and recency for a user in a time window.
 * Used by the Lifestyle Observer and Restaurant Observer.
 */
export async function getEventSummary(
  userId: string,
  windowDays: number,
  eventTypes?: PlatformEventType[]
): Promise<EventSummary[]> {
  const typeFilter =
    eventTypes && eventTypes.length > 0
      ? sql`AND event_type = ANY(${eventTypes}::text[])`
      : sql``;

  const rows = await db.execute<{
    event_type: string;
    event_class: string;
    count: string;
    latest_at: string | null;
  }>(sql`
    SELECT
      event_type,
      event_class,
      COUNT(*)::text AS count,
      MAX(occurred_at)::text AS latest_at
    FROM platform_activity_events
    WHERE owner_user_id = ${userId}
      AND subject_type = 'user'
      AND occurred_at >= NOW() - (${windowDays} || ' days')::interval
      ${typeFilter}
    GROUP BY event_type, event_class
    ORDER BY event_type
  `);

  return rows.rows.map((r) => ({
    eventType: r.event_type,
    eventClass: r.event_class,
    count: parseInt(r.count),
    latestAt: r.latest_at ? new Date(r.latest_at) : null,
  }));
}
