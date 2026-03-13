import { z } from "zod";

/**
 * BODY COMPOSITION SHARED SCHEMAS — SINGLE SOURCE OF TRUTH
 *
 * Imported by both server routes and client components.
 * If the shape changes here, TypeScript breaks at both ends immediately.
 */

export const SCAN_METHODS = ["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"] as const;
export const BODY_COMP_SOURCES = ["client", "trainer", "physician"] as const;

export const createBodyFatSchema = z.object({
  currentBodyFatPct: z.number().min(1).max(70),
  goalBodyFatPct: z.number().min(1).max(70).optional().nullable(),
  scanMethod: z.enum(SCAN_METHODS),
  source: z.enum(BODY_COMP_SOURCES).optional(),
  createdById: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().datetime(),
});

export const updateBodyFatSchema = z.object({
  currentBodyFatPct: z.number().min(1).max(70).optional(),
  goalBodyFatPct: z.number().min(1).max(70).optional().nullable(),
  scanMethod: z.enum(SCAN_METHODS).optional(),
  notes: z.string().optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

export type BodyCompositionCreatePayload = z.infer<typeof createBodyFatSchema>;
export type BodyCompositionUpdatePayload = z.infer<typeof updateBodyFatSchema>;
export type ScanMethod = typeof SCAN_METHODS[number];
export type BodyCompositionSource = typeof BODY_COMP_SOURCES[number];
