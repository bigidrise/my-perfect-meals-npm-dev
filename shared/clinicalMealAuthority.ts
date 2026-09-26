import { z } from "zod";
import { HEALTH_PROTOCOLS } from "./healthProtocolState";

/**
 * A condition name is never a food rule. Every enforceable restriction has a
 * machine-readable target and a measurable or exactly identifiable outcome.
 * Unsupported nutrient evidence must be reviewed, not assumed compliant.
 */
export const exactFoodDirectiveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("avoid_ingredient"),
    ingredientKey: z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(120),
  }).strict(),
  z.object({
    kind: z.literal("nutrient_bound"),
    nutrient: z.enum(["sodium", "potassium", "phosphorus", "carbohydrate", "protein", "saturated_fat"]),
    comparator: z.enum(["at_most", "at_least"]),
    amount: z.number().finite().positive(),
    unit: z.enum(["mg", "g"]),
    scope: z.enum(["per_serving", "per_day"]),
  }).strict(),
]).refine((rule) =>
    rule.kind !== "nutrient_bound" ||
    (["sodium", "potassium", "phosphorus"].includes(rule.nutrient) && rule.unit === "mg") ||
    (!["sodium", "potassium", "phosphorus"].includes(rule.nutrient) && rule.unit === "g"),
    "Nutrient and unit do not match",
  );

export type ExactFoodDirective = z.infer<typeof exactFoodDirectiveSchema>;
export const clinicalProtocolKeySchema = z.enum(HEALTH_PROTOCOLS);
export const clinicalReviewDispositionSchema = z.enum([
  "history_only",
  "current_guidance",
  "current_hard_restriction",
  "verified_provider_directive",
  "historical",
  "unresolved",
]);
export type ClinicalReviewDisposition = z.infer<typeof clinicalReviewDispositionSchema>;

export interface ClinicalDirectiveRecord {
  id: string;
  subjectUserId: string;
  sourceId: string;
  protocol: z.infer<typeof clinicalProtocolKeySchema>;
  rule: ExactFoodDirective;
  effectiveAt: Date;
  expiresAt: Date | null;
  supersedesId: string | null;
}

export interface ClinicalReviewDecision {
  id: string;
  subjectUserId: string;
  sourceId: string;
  directiveId: string | null;
  disposition: ClinicalReviewDisposition;
  actorUserId: string;
  decidedAt: Date;
}