import { z } from "zod";
import {
  HYDRATION_MODIFIER_AUTHORITIES,
  HYDRATION_MODIFIER_EFFECTS,
  HYDRATION_MODIFIER_METRICS,
  HYDRATION_MODIFIER_SOURCES,
  HYDRATION_MODIFIER_STATUSES,
} from "./contracts";

const nonEmpty = z.string().trim().min(1).max(200);

export const hydrationModifierInputSchema = z
  .object({
    id: nonEmpty,
    modifierType: nonEmpty,
    metric: z.enum(HYDRATION_MODIFIER_METRICS),
    effect: z.enum(HYDRATION_MODIFIER_EFFECTS),
    authority: z.enum(HYDRATION_MODIFIER_AUTHORITIES),
    source: z.enum(HYDRATION_MODIFIER_SOURCES),
    sourceId: nonEmpty,
    conflictGroup: nonEmpty.optional(),
    rationaleCode: nonEmpty,
    policyVersion: nonEmpty,
    status: z.enum(HYDRATION_MODIFIER_STATUSES).optional().default("active"),
    hardStop: z.boolean().optional().default(false),
    contextKey: nonEmpty.optional(),
  })
  .strict();

export const hydrationModifierResolutionInputSchema = z
  .object({
    modifiers: z.array(hydrationModifierInputSchema).max(500).default([]),
    policyVersion: nonEmpty,
  })
  .strict();

export type HydrationModifierInputParsed = z.infer<
  typeof hydrationModifierInputSchema
>;
export type HydrationModifierResolutionInput = z.infer<
  typeof hydrationModifierResolutionInputSchema
>;