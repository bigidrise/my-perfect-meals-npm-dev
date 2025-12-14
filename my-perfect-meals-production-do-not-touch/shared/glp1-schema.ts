
import { z } from "zod";

export type GLP1Guardrails = {
  maxMealVolumeMl?: number;
  proteinMinG?: number;
  fatMaxG?: number;
  fiberMinG?: number;
  hydrationMinMl?: number;
  mealsPerDay?: number;
  slowDigestOnly?: boolean;
  limitCarbonation?: boolean;
  limitAlcohol?: boolean;
};

export const GLP1GuardrailsZ = z.object({
  maxMealVolumeMl: z.number().int().min(100).max(600).optional(),
  proteinMinG: z.number().int().min(10).max(60).optional(),
  fatMaxG: z.number().int().min(5).max(50).optional(),
  fiberMinG: z.number().int().min(10).max(50).optional(),
  hydrationMinMl: z.number().int().min(1000).max(4000).optional(),
  mealsPerDay: z.number().int().min(3).max(6).optional(),
  slowDigestOnly: z.boolean().optional(),
  limitCarbonation: z.boolean().optional(),
  limitAlcohol: z.boolean().optional(),
});

export const DEFAULT_GLP1_GUARDRAILS: GLP1Guardrails = {
  maxMealVolumeMl: 300,
  proteinMinG: 25,
  fatMaxG: 15,
  fiberMinG: 28,
  hydrationMinMl: 2000,
  mealsPerDay: 4,
  slowDigestOnly: true,
  limitCarbonation: true,
  limitAlcohol: true,
};
