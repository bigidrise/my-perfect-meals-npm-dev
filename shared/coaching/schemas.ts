/**
 * MPM Coaching Engine — Zod Validation Schemas
 *
 * These schemas validate LLM output at the server boundary.
 * If the LLM produces output that doesn't match, the server rejects or repairs it.
 * The LLM never gets to decide what's valid — the schema does.
 */

import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ConfidenceLevelSchema = z.enum(["high", "moderate", "low"]);

export const StyleModeSchema = z.enum([
  "accountability",
  "education",
  "encouragement",
  "reassurance",
]);

export const ActionHorizonSchema = z.enum(["today", "tomorrow", "next_check_in"]);

export const ActionItemKindSchema = z.enum([
  "drink",
  "eat",
  "avoid",
  "log",
  "activity",
  "weigh",
  "contact_care",
  "use_feature",
  "other",
]);

export const CompletionSignalSchema = z.enum([
  "weight_logged",
  "water_logged",
  "meal_logged",
  "macro_logged",
  "restaurant_logged",
  "exercise_logged",
  "beverage_logged",
  "self_reported",
  "unknown",
]);

export const MemoryCategorySchema = z.enum([
  "behavior",
  "lifestyle",
  "nutrition",
  "success",
]);

// ─── Reasoning Pass Schema ────────────────────────────────────────────────────

/**
 * Validates the first LLM pass (internal reasoning — not shown to user).
 * Key rule: evidenceCitationIds must reference actual Evidence items.
 * The server validates citations exist in the ObserverOutput before proceeding.
 */
export const ReasoningResultSchema = z.object({
  primaryConcern: z.string().min(1).max(300),
  hypotheses: z
    .array(
      z.object({
        explanation: z.string().min(1).max(500),
        // min(0): when evidence block is empty the LLM correctly returns []
        // Citation validation strips hallucinated IDs — enforcement happens server-side.
        evidenceCitationIds: z.array(z.string()).min(0).max(10),
        likelihood: z.enum(["most_likely", "possible", "unlikely"]),
      })
    )
    .min(1)
    .max(4),
  leadHypothesis: z.string().min(1).max(500),
  proposedConfidence: ConfidenceLevelSchema,
  redFlag: z.boolean(),
  redFlagReason: z.string().max(500).optional(),
  missingData: z.array(z.string().max(200)).max(8),
});

export type ReasoningResultInput = z.infer<typeof ReasoningResultSchema>;

// ─── Today's Plan Schema ──────────────────────────────────────────────────────

export const TodayPlanItemSchema = z.object({
  horizon: ActionHorizonSchema,
  kind: ActionItemKindSchema,
  text: z.string().min(1).max(300),
  dueAt: z.string().optional(),
  completionSignal: CompletionSignalSchema.optional(),
  featureTarget: z.string().max(100).optional(),
});

export const TodayPlanSchema = z.object({
  why: z.string().min(1).max(500),
  items: z.array(TodayPlanItemSchema).min(1).max(3),
  successMetric: z.string().min(1).max(300),
  nextCheckIn: z.string().min(1).max(200),
  followUpAt: z.string().optional(),
});

// ─── Coach Response Schema ────────────────────────────────────────────────────

/**
 * Validates the second LLM pass (the user-facing response).
 * Four sections must always be present.
 * learningOpportunity may be null (suppressed per cooldown/safety/overwhelm rules).
 */
export const CoachResponseSchema = z.object({
  whatIFound: z
    .string()
    .min(10)
    .max(800)
    .describe("What the coach observed in the platform — grounded in evidence"),
  whatItCouldMean: z
    .string()
    .min(10)
    .max(600)
    .describe("What the pattern suggests — reasoning from evidence"),
  todayPlan: TodayPlanSchema,
  learningOpportunity: z
    .string()
    .max(400)
    .nullable()
    .describe(
      "What additional logging would improve future coaching. Null when suppressed."
    ),
});

export type CoachResponseInput = z.infer<typeof CoachResponseSchema>;

// ─── Memory Candidate Schema ──────────────────────────────────────────────────

/**
 * Validates memory candidates proposed by the LLM after each conversation.
 * The server validates, deduplicates, and decides whether to accept each one.
 */
export const MemoryCandidateSchema = z.object({
  type: z.enum(["coaching", "nutrition"]),
  category: MemoryCategorySchema.optional(),
  key: z.string().min(1).max(100),
  valueJson: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(300),
});

export const MemoryCandidatesSchema = z
  .array(MemoryCandidateSchema)
  .max(5)
  .describe("Up to 5 memory candidates per conversation turn");

export type MemoryCandidatesInput = z.infer<typeof MemoryCandidatesSchema>;

// ─── Evidence Delta Schema ────────────────────────────────────────────────────

/**
 * Validated output of the bounded intent classifier for follow-up turns.
 * Determines which Observers need to rerun when new info arrives mid-conversation.
 */
export const EvidenceDeltaSchema = z.object({
  type: z.enum([
    "location",
    "date_correction",
    "new_symptom",
    "correction",
    "new_fact",
  ]),
  description: z.string().min(1).max(300),
  affectedObservers: z.array(z.string()).max(8),
  raw: z.string().max(500),
});

export type EvidenceDeltaInput = z.infer<typeof EvidenceDeltaSchema>;
