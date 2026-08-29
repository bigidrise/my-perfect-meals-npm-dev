import { z } from "zod";

export const HYDRATION_TRAINING_CONTEXTS = [
  "strength",
  "endurance",
  "team_sport",
  "mixed_training",
  "general_activity",
] as const;

export const HYDRATION_COACHING_EMPHASES = [
  "before_training",
  "during_training",
  "recovery",
] as const;

export const athleticHydrationCoachingInputSchema = z
  .object({
    trainingContext: z.enum(HYDRATION_TRAINING_CONTEXTS),
    emphasis: z.array(z.enum(HYDRATION_COACHING_EMPHASES)).min(1).max(3),
    reminderStrategy: z.string().trim().min(1).max(500),
    beverageStrategy: z.string().trim().min(1).max(1000),
    athleteCreatorIntent: z.string().trim().max(1000).default(""),
    notes: z.string().trim().max(2000).default(""),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.reviewOn < value.startsOn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewOn"],
        message: "Review date must be on or after the start date",
      });
    }
  });

export type AthleticHydrationCoachingInput = z.infer<
  typeof athleticHydrationCoachingInputSchema
>;

export type AthleticHydrationCoachingRecord = AthleticHydrationCoachingInput & {
  id: string;
  subjectUserId: string;
  coachUserId: string;
  organizationId: string;
  status: "active" | "superseded" | "revoked";
  createdAt: string;
  updatedAt: string;
};

const PROHIBITED_TRAINER_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  code: string;
}> = [
  { pattern: /\bwater\s*(?:cut|deplet|load)/i, code: "WATER_MANIPULATION" },
  { pattern: /\bdehydrat/i, code: "DEHYDRATION_STRATEGY" },
  { pattern: /\b(?:sauna|sweat\s*suit|diuretic|laxative)\b/i, code: "WEIGHT_CUT_METHOD" },
  { pattern: /\bweigh[\s-]*in\b|\bmake\s*weight\b/i, code: "WEIGH_IN_MANIPULATION" },
  {
    pattern: /\b(?:sodium|electrolytes?)\b.{0,35}\b\d+(?:\.\d+)?\s*(?:mg|g|milligrams?|grams?)\b/i,
    code: "ELECTROLYTE_PRESCRIPTION",
  },
  {
    pattern: /\b\d+(?:\.\d+)?\s*(?:ml|mL|oz|ounces?|liters?|litres?|cups?)\b.{0,45}\b(?:per|every|daily|hour|day)\b/i,
    code: "FLUID_DOSING",
  },
];

export function findProhibitedTrainerHydrationContent(
  input: AthleticHydrationCoachingInput,
): string | null {
  const text = [
    input.reminderStrategy,
    input.beverageStrategy,
    input.athleteCreatorIntent,
    input.notes,
  ].join("\n");
  return PROHIBITED_TRAINER_PATTERNS.find(({ pattern }) => pattern.test(text))?.code ?? null;
}