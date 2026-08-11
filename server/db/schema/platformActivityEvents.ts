/**
 * Platform Activity Events — Phase 3B
 *
 * A single event stream that captures all meaningful nutrition/platform actions
 * across MPM. The governing rule:
 *
 *   usage      = user opened/generated/explored a feature
 *   engagement = user took a deliberate action (save, add to list, scan)
 *   consumption = user explicitly logged/confirmed something they consumed
 *   outcome    = platform recorded what happened afterward (weight log, plan completion)
 *
 * Subject-aware: owner_user_id is always the authenticated user (the adult).
 * subject_type/subject_id distinguish WHO the action is about:
 *   Adults:      subject_type='user',  subject_id=owner_user_id
 *   Children:    subject_type='child', subject_id=child_profile_id
 *
 * This separation ensures Pregnancy and My Perfect Beginnings activity never
 * leaks into an adult Coach's Corner observation window.
 *
 * Do NOT emit analytics noise (button_clicked, modal_opened, tab_changed).
 * Emit only meaningful nutrition/platform actions as defined in
 * server/services/coaching/activityEvents.ts (PlatformEventType).
 */

import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const platformActivityEvents = pgTable(
  "platform_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** The authenticated user who owns this event */
    ownerUserId: text("owner_user_id").notNull(),

    /**
     * Who the event is about.
     * "user"  — the adult owner (default for all adult-context events)
     * "child" — a child profile in My Perfect Beginnings
     */
    subjectType: text("subject_type").notNull().default("user"),

    /**
     * The subject's ID. For adults: same as owner_user_id.
     * For children: the child_profile.id from My Perfect Beginnings.
     */
    subjectId: text("subject_id").notNull(),

    /**
     * Semantic event type. Must be one of the PlatformEventType values
     * defined in server/services/coaching/activityEvents.ts.
     */
    eventType: text("event_type").notNull(),

    /**
     * Event class — the dimension of intent:
     *   usage       = opened/generated/explored
     *   engagement  = saved/favorited/added-to-list/scanned
     *   consumption = explicitly logged/confirmed consumption
     *   outcome     = platform-recorded result
     */
    eventClass: text("event_class").notNull(),

    /**
     * Which MPM surface generated this event.
     * e.g. "restaurant_guide", "beverage_creator", "fridge_rescue", "smart_scan"
     */
    sourceFeature: text("source_feature"),

    /**
     * Optional: the type of entity this event refers to.
     * e.g. "meal", "beverage", "product", "shopping_item"
     */
    entityType: text("entity_type"),

    /**
     * Optional: a stable ID linking this event to the entity.
     * e.g. saved_meals.id, restaurant_guide_sessions.id
     */
    entityId: text("entity_id"),

    /**
     * Event-specific payload. Keep payloads small — only data the
     * Observers actually need. No PII beyond what's already on the user row.
     */
    metadata: jsonb("metadata"),

    /**
     * When the action actually happened (may differ from createdAt
     * if events are batched or retried).
     */
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Primary Observer query: all events for an owner in a time window */
    byOwnerOccurred: index("pae_owner_occurred_idx").on(
      t.ownerUserId,
      t.occurredAt
    ),
    /** Secondary query: events for a specific subject (child vs adult) */
    bySubjectOccurred: index("pae_subject_occurred_idx").on(
      t.subjectId,
      t.subjectType,
      t.occurredAt
    ),
    /** Filter by event type within owner window */
    byOwnerEventType: index("pae_owner_event_type_idx").on(
      t.ownerUserId,
      t.eventType,
      t.occurredAt
    ),
  })
);

export type PlatformActivityEvent =
  typeof platformActivityEvents.$inferSelect;
export type InsertPlatformActivityEvent =
  typeof platformActivityEvents.$inferInsert;
