/**
 * MPM Coaching Engine — Database Schema
 *
 * 9 tables supporting the Universal Coaching Engine.
 * All rows enforce user/subject ownership on every read and write.
 *
 * Authority order:
 *   Safety Rules → Platform Evidence → Knowledge Pattern →
 *   Coaching Memory → Nutrition Memory → Behavioral Profile → LLM Renderer
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── 1. coach_conversations ───────────────────────────────────────────────────

/**
 * One conversation per user per specialization (open at a time).
 * subject_id = userId for corner/pregnancy; child_profile.id for pediatric.
 * owner_id = always the authenticated user's id (for pediatric = parent).
 */
export const coachConversations = pgTable(
  "coach_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The authenticated user who owns this conversation */
    ownerId: text("owner_id").notNull(),
    specialization: text("specialization").notNull(), // corner | pregnancy | pediatric
    subjectType: text("subject_type").notNull(),       // user | child
    /** For corner/pregnancy: same as owner_id. For pediatric: child_profile.id */
    subjectId: text("subject_id").notNull(),
    status: text("status").notNull().default("open"), // open | archived
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ownerIdx: index("coach_conversations_owner_idx").on(t.ownerId),
    subjectIdx: index("coach_conversations_subject_idx").on(t.subjectId),
    specializationIdx: index("coach_conversations_spec_idx").on(t.specialization),
    ownerSpecActiveIdx: index("coach_conversations_owner_spec_idx").on(
      t.ownerId,
      t.specialization,
      t.status
    ),
  })
);

// ─── 2. coach_messages ────────────────────────────────────────────────────────

/**
 * Every conversation turn — append only.
 * structured_payload holds the full CoachResponse JSON for assistant turns.
 */
export const coachMessages = pgTable(
  "coach_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    role: text("role").notNull(), // user | assistant | system
    /** Plain text content shown to the user */
    content: text("content").notNull(),
    /** Full structured CoachResponse for assistant turns; null for user turns */
    structuredPayload: jsonb("structured_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationIdx: index("coach_messages_conversation_idx").on(t.conversationId),
    conversationTimeIdx: index("coach_messages_conversation_time_idx").on(
      t.conversationId,
      t.createdAt
    ),
  })
);

// ─── 3. coach_investigations ──────────────────────────────────────────────────

/**
 * The platform evidence and pattern matches used to produce each response.
 * Full audit trail: which Observers ran, what they found, what patterns matched.
 * Evidence is never stored as prose — always structured JSON.
 */
export const coachInvestigations = pgTable(
  "coach_investigations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    /** The assistant message this investigation produced */
    messageId: uuid("message_id"),
    /** Detected user intent (e.g. "weight_gain", "fatigue", "plateau") */
    intent: text("intent"),
    /** Which Observers were selected and why */
    observerSelection: jsonb("observer_selection"),
    /** Full typed Evidence[] from all Observers */
    evidenceJson: jsonb("evidence_json").notNull(),
    /** knowledge_pattern.id[] that matched */
    matchedPatternIds: text("matched_pattern_ids").array(),
    /** high | moderate | low — server-scored, never AI-determined */
    confidence: text("confidence").notNull().default("low"),
    /** 0.0–1.0 evidence coverage score */
    coverageScore: numeric("coverage_score", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationIdx: index("coach_investigations_conversation_idx").on(t.conversationId),
    messageIdx: index("coach_investigations_message_idx").on(t.messageId),
  })
);

// ─── 4. coach_action_plans ────────────────────────────────────────────────────

/**
 * The "Today's Plan" persisted from each coaching response.
 * plan_json holds the full TodayPlan structure.
 * Drives the follow-up loop.
 */
export const coachActionPlans = pgTable(
  "coach_action_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    investigationId: uuid("investigation_id"),
    /** The user this plan belongs to — denormalized for fast follow-up queries */
    ownerId: text("owner_id").notNull(),
    /** "Why" section of the plan */
    why: text("why").notNull(),
    /** "How we'll know it worked" */
    successMetric: text("success_metric").notNull(),
    /** "Next check-in" text (e.g. "Friday morning") */
    nextCheckIn: text("next_check_in").notNull(),
    /** When the follow-up job should check on this plan */
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    status: text("status").notNull().default("open"), // open | completed | expired | cancelled
    /** Full TodayPlan JSON for reference */
    planJson: jsonb("plan_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationIdx: index("coach_action_plans_conversation_idx").on(t.conversationId),
    ownerIdx: index("coach_action_plans_owner_idx").on(t.ownerId),
    ownerStatusIdx: index("coach_action_plans_owner_status_idx").on(
      t.ownerId,
      t.status
    ),
    followupIdx: index("coach_action_plans_followup_idx").on(
      t.status,
      t.nextCheckAt
    ),
  })
);

// ─── 5. coach_action_items ────────────────────────────────────────────────────

/**
 * Individual checklist items within a plan.
 * completion_signal tells the follow-up job how to detect objective completion.
 */
export const coachActionItems = pgTable(
  "coach_action_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull(),
    sequence: integer("sequence").notNull().default(0),
    kind: text("kind").notNull(),     // drink | eat | avoid | log | activity | weigh | contact_care | use_feature | other
    horizon: text("horizon").notNull(), // today | tomorrow | next_check_in
    text: text("text").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** How the system detects objective completion */
    completionSignal: text("completion_signal"), // weight_logged | water_logged | meal_logged | ...
    /** For use_feature: which MPM feature to redirect to */
    featureTarget: text("feature_target"),
    status: text("status").notNull().default("pending"), // pending | completed | skipped | unknown
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    planIdx: index("coach_action_items_plan_idx").on(t.planId),
  })
);

// ─── 6. coach_followups ───────────────────────────────────────────────────────

/**
 * Scheduled follow-up check-ins generated by the daily job.
 * One per open action plan. Idempotent — the job never creates duplicates.
 */
export const coachFollowups = pgTable(
  "coach_followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull(),
    /** The user to notify — denormalized for fast job queries */
    ownerId: text("owner_id").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("pending"), // pending | sent | dismissed | snoozed | completed
    /** The coach message to surface on next visit */
    payloadJson: jsonb("payload_json"),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    planIdx: index("coach_followups_plan_idx").on(t.planId),
    ownerIdx: index("coach_followups_owner_idx").on(t.ownerId),
    dueIdx: index("coach_followups_due_idx").on(t.status, t.dueAt),
    /** Prevent duplicate follow-ups for the same plan */
    planPendingIdx: uniqueIndex("coach_followups_plan_pending_idx").on(
      t.planId,
      t.status
    ),
  })
);

// ─── 7. coaching_memories ─────────────────────────────────────────────────────

/**
 * Long-term coaching memory — owned by the coach, read by the coach only.
 * Populated after each conversation by the memory extraction job.
 * Examples: "struggles on weekends", "responds well to encouragement", "sodium sensitive"
 *
 * Facts expire, get superseded — never silently overwritten.
 * The LLM proposes candidates; the server validates and accepts.
 */
export const coachingMemories = pgTable(
  "coaching_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    specialization: text("specialization").notNull(), // corner | pregnancy | pediatric
    /** Category: behavior | lifestyle | nutrition | success */
    category: text("category").notNull(),
    /** Structured key for lookup (e.g. "weekend_struggle", "sodium_sensitive") */
    key: text("key").notNull(),
    /** The actual memory content */
    valueJson: jsonb("value_json").notNull(),
    /** 0.0–1.0 confidence in this memory */
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    /** The coach_messages.id that produced this memory */
    sourceMessageId: uuid("source_message_id"),
    status: text("status").notNull().default("active"), // active | archived | superseded
    /** ID of the newer memory that supersedes this one */
    supersededById: uuid("superseded_by_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userSpecIdx: index("coaching_memories_user_spec_idx").on(
      t.userId,
      t.specialization
    ),
    userSpecKeyIdx: index("coaching_memories_user_spec_key_idx").on(
      t.userId,
      t.specialization,
      t.key,
      t.status
    ),
    activeMemoriesIdx: index("coaching_memories_active_idx").on(
      t.userId,
      t.status,
      t.expiresAt
    ),
  })
);

// ─── 8. nutrition_memories ────────────────────────────────────────────────────

/**
 * Platform-wide nutrition preferences — owned by the platform, read by everything.
 * Examples: favorite cuisines, rejected foods, preferred restaurants, substitutions.
 *
 * Read by: Coach's Corner, Meal Builder, Restaurant Guide, Beverage Builder, all builders.
 * Written by: any feature that observes a meaningful preference signal.
 *
 * Distinct from coaching_memories: never contains coach-only inferences.
 */
export const nutritionMemories = pgTable(
  "nutrition_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    /** Structured key (e.g. "favorite_cuisine", "rejected_food", "preferred_restaurant") */
    key: text("key").notNull(),
    /** The preference content */
    valueJson: jsonb("value_json").notNull(),
    /** 0.0–1.0 confidence */
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    /** Feature that wrote this (e.g. "meal_builder", "restaurant_guide", "coach_corner") */
    source: text("source").notNull(),
    /** When a user explicitly confirmed this preference */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("nutrition_memories_user_idx").on(t.userId),
    userKeyIdx: uniqueIndex("nutrition_memories_user_key_idx").on(t.userId, t.key),
    activeIdx: index("nutrition_memories_active_idx").on(t.userId, t.expiresAt),
  })
);

// ─── 9. knowledge_patterns ────────────────────────────────────────────────────

/**
 * The Coach Knowledge Library — versioned, scoped, clinically approved.
 * Patterns are matched deterministically before any LLM call.
 * The LLM never sees raw clinical rules — only the approved template output.
 *
 * Medical escalation/contraindications live as code-enforced policy (safety.ts),
 * NOT as rows in this table, because they cannot be toggled off.
 *
 * Initial 5 patterns for Coach's Corner:
 *   1. rapid_weight_gain        (water retention vs. fat gain)
 *   2. weight_loss_plateau      (adherence, restaurant frequency, protein, activity)
 *   3. fatigue_low_energy       (calories, protein, hydration, meal timing)
 *   4. cravings                 (behavior, meal timing, protein distribution, stress)
 *   5. restaurant_eating        (sodium, portion variability, hidden fats)
 */
export const knowledgePatterns = pgTable(
  "knowledge_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specialization: text("specialization").notNull(), // corner | pregnancy | pediatric | all
    /** Stable key used in code references (e.g. "rapid_weight_gain") */
    key: text("key").notNull(),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(false), // requires clinical approval to activate
    /**
     * Declarative rule: trigger_intents, required_evidence, contraindications,
     * confidence_rule, safety_class
     */
    ruleJson: jsonb("rule_json").notNull(),
    /**
     * Response templates: interpretation, action_templates[], learning_templates[]
     */
    templateJson: jsonb("template_json").notNull(),
    safetyClass: text("safety_class").notNull().default("routine"), // routine | caution | escalate | emergency
    /** Set when a clinical reviewer explicitly approves this pattern */
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    specKeyIdx: index("knowledge_patterns_spec_key_idx").on(
      t.specialization,
      t.key
    ),
    activeIdx: index("knowledge_patterns_active_idx").on(
      t.specialization,
      t.isActive
    ),
    specKeyVersionIdx: uniqueIndex("knowledge_patterns_spec_key_version_idx").on(
      t.specialization,
      t.key,
      t.version
    ),
  })
);
