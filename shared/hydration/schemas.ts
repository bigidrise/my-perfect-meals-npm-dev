import { z } from "zod";
import {
  HYDRATION_BEVERAGE_CLASSES,
  HYDRATION_CONFIDENCE,
  HYDRATION_ELECTROLYTE_COVERAGE,
  HYDRATION_UNITS,
  type HydrationIntakeEventInput,
} from "./contracts";

const uuidSchema = z.string().uuid();
const timezoneSchema = z.string().trim().min(1).max(100);

export const hydrationDeclaredNutrientsSchema = z
  .object({
    sodiumMg: z.number().finite().nonnegative().optional(),
    potassiumMg: z.number().finite().nonnegative().optional(),
    magnesiumMg: z.number().finite().nonnegative().optional(),
    carbohydrateG: z.number().finite().nonnegative().optional(),
    caffeineMg: z.number().finite().nonnegative().optional(),
    alcoholUnits: z.number().finite().nonnegative().optional(),
    source: z.enum([
      "label",
      "recipe_nutrition",
      "database",
      "clinician",
      "estimated",
    ]),
    confidence: z.enum(HYDRATION_CONFIDENCE).exclude(["not_available"]),
  })
  .strict();

export const hydrationIntakeEventInputSchema = z
  .object({
    originalAmount: z.number().finite().positive(),
    originalUnit: z.enum(HYDRATION_UNITS),
    occurredAt: z.string().datetime({ offset: true }),
    occurredTimezone: timezoneSchema,
    beverageClass: z.enum(HYDRATION_BEVERAGE_CLASSES),
    source: z.enum(["manual", "import"]).optional().default("manual"),
    note: z.string().trim().max(1000).optional(),
    idempotencyKey: uuidSchema,
    clientInstanceId: uuidSchema.optional(),
    declaredNutrients: hydrationDeclaredNutrientsSchema.optional(),
  })
  .strict() satisfies z.ZodType<HydrationIntakeEventInput>;

export const hydrationDateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Expected an ISO local date (YYYY-MM-DD)",
);

export const hydrationHistoryQuerySchema = z
  .object({
    from: hydrationDateSchema.optional(),
    to: hydrationDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().trim().min(1).max(2048).optional(),
  })
  .strict();

export const hydrationPlanStatusSchema = z.enum([
  "monitor_only",
  "needs_review",
  "blocked",
]);

export const hydrationElectrolyteCoverageSchema = z.enum(
  HYDRATION_ELECTROLYTE_COVERAGE,
);

export const hydrationPhase1PlanSchema = z
  .object({
    id: uuidSchema,
    subjectUserId: z.string().min(1),
    localDate: hydrationDateSchema,
    timezone: timezoneSchema,
    revision: z.number().int().positive(),
    status: hydrationPlanStatusSchema,
    targetKind: z.literal("monitor_only"),
    targetMl: z.null(),
    minimumMl: z.null(),
    maximumMl: z.null(),
    remainingMl: z.null(),
    calculationPolicyVersionId: uuidSchema,
    inputSnapshotHash: z.string().min(1),
    policyVersionManifest: z.record(z.unknown()),
    missingDataCodes: z.array(z.string()),
    rationaleCodes: z.array(z.string()),
    explanationKeys: z.array(z.string()),
    effectiveAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const hydrationPhase1StateSchema = z
  .object({
    id: uuidSchema,
    subjectUserId: z.string().min(1),
    localDate: hydrationDateSchema,
    timezone: timezoneSchema,
    stateVersion: z.number().int().positive(),
    effectivePlanRevisionId: uuidSchema,
    inputWatermark: z.string().min(1),
    activeEventCount: z.number().int().nonnegative(),
    totalDeclaredVolumeMl: z.number().int().nonnegative(),
    knownContributionMl: z.null(),
    unknownContributionEventCount: z.number().int().nonnegative(),
    lastEventAt: z.string().datetime({ offset: true }).optional(),
    electrolyteLedgerId: uuidSchema,
    planStatus: hydrationPlanStatusSchema,
    progressStatus: z.literal("unknown"),
    computedAt: z.string().datetime({ offset: true }),
    calculationPolicyVersionId: uuidSchema,
    projectionHash: z.string().min(1),
  })
  .strict();

export type HydrationIntakeEventInputParsed = z.infer<
  typeof hydrationIntakeEventInputSchema
>;