import { z } from "zod";

export const PairingsMode = z.enum(["pairing", "discovery"]);
export type PairingsMode = z.infer<typeof PairingsMode>;

export const PairingsCategory = z.enum(["wine", "beer", "both"]);
export type PairingsCategory = z.infer<typeof PairingsCategory>;

export const CardCategory = z.enum(["wine", "beer", "spirits", "non-alcoholic"]);
export type CardCategory = z.infer<typeof CardCategory>;

export const DrinkBody = z.enum(["light", "medium", "full"]);
export const AcidityLevel = z.enum(["low", "medium", "high"]);
export const SweetnessLevel = z.enum(["dry", "off-dry", "sweet"]);
export const BitternessLevel = z.enum(["low", "medium", "high"]);

export const PairingItem = z.object({
  category: CardCategory,
  name: z.string().min(1).max(120),
  explanation: z.string().min(1).max(600),
  alternatives: z.array(z.string().min(1).max(100)).max(5).default([]),
  servingTips: z.string().min(1).max(300),
  imageUrl: z.string().url().nullable().default(null),
  flavorProfile: z.array(z.string().min(1).max(40)).max(8).optional(),
  body: DrinkBody.optional(),
  acidity: AcidityLevel.optional(),
  sweetness: SweetnessLevel.optional(),
  bitterness: BitternessLevel.optional(),
});
export type PairingItem = z.infer<typeof PairingItem>;

export const QueryIntent = z.enum(["pairing", "discovery", "comparison"]);

export const SafetyModeEnum = z.enum(["STRICT", "CUSTOM_AUTHENTICATED"]);

export const SafetyResult = z.object({
  result: z.enum(["SAFE", "AMBIGUOUS", "BLOCKED"]),
  message: z.string(),
  blockedTerms: z.array(z.string()).default([]),
  blockedCategories: z.array(z.string()).default([]),
  ambiguousTerms: z.array(z.string()).default([]),
  suggestion: z.string().optional(),
});

export const PairingsAIRequest = z
  .object({
    mode: PairingsMode,
    category: PairingsCategory,
    input: z.string().trim().min(2).max(300),
    safetyMode: SafetyModeEnum.optional(),
    overrideToken: z.string().trim().min(4).max(256).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "discovery" && v.category === "both") {
      ctx.addIssue({
        code: "custom",
        message: "Discovery mode requires a specific category (wine or beer), not both.",
      });
    }
  });
export type PairingsAIRequest = z.infer<typeof PairingsAIRequest>;

export const PairingsAIResponse = z.object({
  query: z.object({
    input: z.string(),
    detectedIntent: QueryIntent,
    category: PairingsCategory,
  }),
  pairings: z.array(PairingItem).min(1).max(10),
  safety: SafetyResult,
});
export type PairingsAIResponse = z.infer<typeof PairingsAIResponse>;

export const WineListHelperRequest = z.object({
  wineListText: z.string().trim().min(3).max(8000),
  mealContext: z.string().max(200).optional(),
  safetyMode: SafetyModeEnum.optional(),
  overrideToken: z.string().trim().min(4).max(256).optional(),
});
export type WineListHelperRequest = z.infer<typeof WineListHelperRequest>;

export const WineListHelperResponse = z.object({
  query: z.object({
    wineListText: z.string(),
    mealContext: z.string().optional(),
  }),
  bestChoice: z.object({
    name: z.string(),
    explanation: z.string(),
  }),
  pairings: z.array(PairingItem).min(1).max(8),
  safety: SafetyResult,
});
export type WineListHelperResponse = z.infer<typeof WineListHelperResponse>;

export const ReduceDrinkingPace = z.enum(["gentle", "standard", "custom"]);

export const ReduceDrinkingPlanRequest = z.object({
  baselineIntake: z.number().min(1).max(100),
  daysPerWeek: z.number().min(1).max(7),
  pace: ReduceDrinkingPace,
  customReductionPct: z.number().min(5).max(50).optional(),
  goalDate: z.string().optional(),
  safetyMode: SafetyModeEnum.optional(),
  overrideToken: z.string().trim().min(4).max(256).optional(),
});
export type ReduceDrinkingPlanRequest = z.infer<typeof ReduceDrinkingPlanRequest>;

export const WeeklyTarget = z.object({
  week: z.number(),
  maxDrinksPerDay: z.number(),
  maxDrinksPerWeek: z.number(),
  notes: z.string(),
});

export const ReduceDrinkingPlanResponse = z.object({
  summary: z.object({
    baselineDrinksPerWeek: z.number(),
    projectedWeeks: z.number(),
    riskTier: z.enum(["low", "moderate", "high"]),
    overviewMessage: z.string(),
  }),
  weeklyTargets: z.array(WeeklyTarget).min(1).max(24),
  harmReductionTips: z.array(z.string()).min(1).max(10),
  medicalFlags: z.array(z.string()).default([]),
  disclaimer: z.string(),
  generatedAt: z.string(),
});
export type ReduceDrinkingPlanResponse = z.infer<typeof ReduceDrinkingPlanResponse>;
