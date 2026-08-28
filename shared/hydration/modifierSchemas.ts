import { z } from "zod";
import {
  HYDRATION_MODIFIER_AUTHORITIES,
  HYDRATION_MODIFIER_EFFECTS,
  HYDRATION_MODIFIER_METRICS,
  HYDRATION_MODIFIER_SOURCES,
  HYDRATION_MODIFIER_STATUSES,
} from "./contracts";

const nonEmpty = z.string().trim().min(1).max(200);
export const hydrationRegistryProvenanceSchema = z
  .object({
    sourceRecordId: nonEmpty,
    sourceTimestamp: z.string().datetime({ offset: true }).optional(),
    authorityIdentity: nonEmpty.optional(),
    protocolRevision: nonEmpty.optional(),
    populationContext: nonEmpty.optional(),
  })
  .strict();

export const hydrationModifierInputSchema = z
  .object({
    id: nonEmpty,
    modifierType: nonEmpty,
    registryDefinitionId: nonEmpty.optional(),
    registryFamily: nonEmpty.optional(),
    registryProvenance: hydrationRegistryProvenanceSchema.optional(),
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

export const hydrationRegistryClaimInputSchema = z
  .object({
    definitionId: nonEmpty,
    instanceId: nonEmpty,
    source: z.enum(HYDRATION_MODIFIER_SOURCES),
    sourceId: nonEmpty,
    authority: z.enum(HYDRATION_MODIFIER_AUTHORITIES),
    policyVersion: nonEmpty,
    effect: z.enum(HYDRATION_MODIFIER_EFFECTS).optional(),
    metric: z.enum(HYDRATION_MODIFIER_METRICS).optional(),
    rationaleCode: nonEmpty.optional(),
    status: z.enum(HYDRATION_MODIFIER_STATUSES).optional().default("active"),
    hardStop: z.boolean().optional().default(false),
    contextKey: nonEmpty.optional(),
    provenance: hydrationRegistryProvenanceSchema,
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
export type HydrationRegistryClaimInputParsed = z.infer<
  typeof hydrationRegistryClaimInputSchema
>;
export type HydrationModifierResolutionInput = z.infer<
  typeof hydrationModifierResolutionInputSchema
>;