import { z } from "zod";
import {
  myPerfectMenuConceptSchema,
  type MyPerfectMenuCategory,
} from "@shared/myPerfectMenu";
import { culinaryIdentitySchema } from "@shared/culinaryIdentity";
import { normalizeGeneratedMenuResponse } from "./normalizeGeneratedConcepts";

export const generatedMenuConceptSchema = myPerfectMenuConceptSchema
  .omit({ id: true, ideaType: true })
  .extend({ culinaryIdentity: culinaryIdentitySchema });

const generatedMenuEnvelopeSchema = z.object({
  concepts: z.array(z.unknown()).min(1).max(8),
});

export type GeneratedMenuConcept = z.infer<typeof generatedMenuConceptSchema>;

export interface ParsedGeneratedMenuCandidates {
  candidates: GeneratedMenuConcept[];
  rejectionCodes: string[];
}

export function parseGeneratedMenuCandidates(
  value: unknown,
  ideaType: MyPerfectMenuCategory,
): ParsedGeneratedMenuCandidates {
  const normalized = normalizeGeneratedMenuResponse(value, ideaType);
  const envelope = generatedMenuEnvelopeSchema.safeParse(normalized);
  if (!envelope.success) {
    return {
      candidates: [],
      rejectionCodes: envelope.error.issues.map((issue) =>
        `schema_metadata_failure:${issue.path.join(".") || "response"}`,
      ),
    };
  }

  const candidates: GeneratedMenuConcept[] = [];
  const rejectionCodes: string[] = [];
  for (const [index, candidate] of envelope.data.concepts.entries()) {
    const parsed = generatedMenuConceptSchema.safeParse(candidate);
    if (parsed.success) {
      candidates.push(parsed.data);
    } else {
      rejectionCodes.push(
        ...parsed.error.issues.map((issue) =>
          `schema_metadata_failure:concept_${index}:${issue.path.join(".") || "concept"}`,
        ),
      );
    }
  }
  return { candidates, rejectionCodes };
}

function cuisineTokens(value: string): string[] {
  const generic = new Set(["cuisine", "cooking", "food", "style", "inspired", "inspiration"]);
  return value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !generic.has(token));
}

export function cuisineLabelsCompatible(actual: string, required: string): boolean {
  const actualTokens = cuisineTokens(actual);
  const requiredTokens = cuisineTokens(required);
  if (!actualTokens.length || !requiredTokens.length) return false;
  const actualSet = new Set(actualTokens);
  const requiredSet = new Set(requiredTokens);
  return (
    requiredTokens.every((token) => actualSet.has(token)) ||
    actualTokens.every((token) => requiredSet.has(token))
  );
}

export function rejectionCategory(reason: string): string {
  if (reason.startsWith("dietary:")) return "dietary_violation";
  if (reason.startsWith("forbidden_ingredient:")) return "allergen_or_avoidance_violation";
  if (reason.startsWith("cuisine_mismatch:")) return "cuisine_mismatch";
  if (reason.startsWith("protocol:")) return "protocol_rejection";
  if (reason.startsWith("schema_metadata_failure:")) return "schema_metadata_failure";
  return "governance_rejection";
}

export function rejectionCategoryCounts(reasons: string[]): Record<string, number> {
  return reasons.reduce<Record<string, number>>((counts, reason) => {
    const category = rejectionCategory(reason);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
}