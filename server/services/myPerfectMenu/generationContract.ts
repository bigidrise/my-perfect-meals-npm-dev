import { z } from "zod";
import {
  myPerfectMenuConceptSchema,
  type MyPerfectMenuCategory,
} from "@shared/myPerfectMenu";
import { culinaryIdentitySchema } from "@shared/culinaryIdentity";
import { normalizeGeneratedMenuResponse } from "./normalizeGeneratedConcepts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

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
  metadataRepairCount: number;
}

const culinaryRepairSourceSchema = myPerfectMenuConceptSchema
  .omit({ id: true, ideaType: true, culinaryIdentity: true });

function compactString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = value.trim();
  return compact.length >= 1 && compact.length <= 80 ? compact : undefined;
}

function inferredTemperature(text: string): "hot" | "warm" | "room_temperature" | "chilled" | "frozen" | undefined {
  const normalized = text.toLowerCase();
  if (/\b(frozen|ice cream|sorbet)\b/.test(normalized)) return "frozen";
  if (/\b(chilled|cold|parfait)\b/.test(normalized)) return "chilled";
  if (/\b(room temperature)\b/.test(normalized)) return "room_temperature";
  if (/\b(baked|roasted|grilled|seared|sauteed|sautéed|fried|toasted|hot)\b/.test(normalized)) return "hot";
  return "warm";
}

function repairGeneratedConceptMetadata(value: unknown): { value: unknown; repaired: boolean } {
  if (!isRecord(value)) return { value, repaired: false };
  const repaired: Record<string, unknown> = { ...value };
  let changed = false;

  if (repaired.primaryProtein === undefined) {
    repaired.primaryProtein = null;
    changed = true;
  }
  if (repaired.produceItems === undefined) {
    repaired.produceItems = [];
    changed = true;
  }
  // Model claims are advisory, never safety evidence. Discard malformed
  // representations rather than certifying their contents or rejecting an
  // otherwise inspectable food concept.
  if (!Array.isArray(repaired.dietaryEvidence)) {
    repaired.dietaryEvidence = [];
    changed = true;
  }
  if (!compactString(repaired.signature)) {
    const source = [repaired.title, repaired.primaryProtein, repaired.preparationMethod]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("|")
      .slice(0, 180);
    if (source.length >= 5) {
      repaired.signature = source;
      changed = true;
    }
  }

  const source = culinaryRepairSourceSchema.safeParse(repaired);
  if (source.success && !culinaryIdentitySchema.safeParse(repaired.culinaryIdentity).success) {
    const existing = isRecord(repaired.culinaryIdentity) ? repaired.culinaryIdentity : {};
    const temperature = compactString(existing.temperature);
    const validTemperature = ["hot", "warm", "room_temperature", "chilled", "frozen"].includes(temperature ?? "")
      ? temperature as "hot" | "warm" | "room_temperature" | "chilled" | "frozen"
      : inferredTemperature(`${source.data.title} ${source.data.preparationMethod}`);
    const definingComponents = Array.isArray(existing.definingComponents)
      ? existing.definingComponents.filter((item): item is string => Boolean(compactString(item))).slice(0, 8)
      : [];
    repaired.culinaryIdentity = {
      dishForm: compactString(existing.dishForm) ?? source.data.title,
      preparationStyle: compactString(existing.preparationStyle) ?? source.data.preparationMethod,
      ...(compactString(existing.texture) ? { texture: compactString(existing.texture) } : {}),
      ...(validTemperature ? { temperature: validTemperature } : {}),
      primaryProteinBase: compactString(existing.primaryProteinBase) ?? source.data.primaryProtein,
      majorStarchBase: compactString(existing.majorStarchBase) ?? null,
      flavorFamily: compactString(existing.flavorFamily) ?? source.data.cuisine,
      cuisineEvidence: compactString(existing.cuisineEvidence) ?? source.data.cuisine,
      definingComponents: definingComponents.length
        ? definingComponents
        : source.data.primaryIngredients.slice(0, 8),
    };
    changed = true;
  }
  return { value: repaired, repaired: changed };
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
      metadataRepairCount: 0,
    };
  }

  const candidates: GeneratedMenuConcept[] = [];
  const rejectionCodes: string[] = [];
  let metadataRepairCount = 0;
  for (const [index, candidate] of envelope.data.concepts.entries()) {
    const repaired = repairGeneratedConceptMetadata(candidate);
    const parsed = generatedMenuConceptSchema.safeParse(repaired.value);
    if (parsed.success) {
      candidates.push(parsed.data);
      if (repaired.repaired) metadataRepairCount += 1;
    } else {
      rejectionCodes.push(
        ...parsed.error.issues.map((issue) =>
          `schema_metadata_failure:concept_${index}:${issue.path.join(".") || "concept"}`,
        ),
      );
    }
  }
  return { candidates, rejectionCodes, metadataRepairCount };
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
  if (reason.startsWith("repetition:")) return "repetition_rejection";
  return "governance_rejection";
}

export function rejectionCategoryCounts(reasons: string[]): Record<string, number> {
  return reasons.reduce<Record<string, number>>((counts, reason) => {
    const category = rejectionCategory(reason);
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});
}