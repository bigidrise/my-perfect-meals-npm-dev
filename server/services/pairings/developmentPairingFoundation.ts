import { z } from "zod";
import { PairingItem } from "@shared/types/pairings";
import {
  PairingFoundationMetadata, PairingFoundationCards, FoundationPairingItem, WineListFoundationCards,
  WineListFoundationItem, WineListFoundationBestChoice, ChefFoundationItem, ChefFoundationGroups,
} from "@shared/pairingFoundation";
import {
  loadGenerationProtocolEnvelope, enforceBeforeGenerate, scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "../protocolEnvelope";
import { requiresVerifiedIngredientEvidence } from "../foodCompositionEvidence";
import { loadPairingsProfile } from "./profileContext";
import { buildPairingsConstraints } from "./pairingsPersonalization";
import { findWineListEntry, type WineListEntry } from "./wineListIdentity";
import { containsAlcoholContent } from "../guardrails/beverageMedicalRules";

export const COMPOSITION_NOTE = "Known conflicts were screened; ingredients, nutrition and preparation have not been verified. Check a complete label or ask the venue before choosing.";

export function developmentPairingFoundationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "development" && !env.REPLIT_DEPLOYMENT;
}

export class PairingFoundationError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "PairingFoundationError";
  }
}

function assertDevelopment(): void {
  if (!developmentPairingFoundationEnabled()) {
    throw new PairingFoundationError(404, "PAIRING_FOUNDATION_DISABLED", "Development pairing foundation is unavailable.");
  }
}

export type PairingFoundationContext = {
  envelope: UserProtocolEnvelope;
  generatorName: "pairings_ai" | "wine_list_helper" | "chef_pairings";
  constraints: string;
};

export async function resolveDevelopmentPairingContext(
  userId: string, generatorName: PairingFoundationContext["generatorName"], cultureOverride?: string,
): Promise<PairingFoundationContext> {
  assertDevelopment();
  if (!userId) throw new PairingFoundationError(401, "AUTH_REQUIRED", "Authentication required");
  let envelope: UserProtocolEnvelope;
  try {
    envelope = await loadGenerationProtocolEnvelope(userId);
    if (!envelope || envelope.userId !== userId) throw new Error("Unresolved pairing subject");
  } catch {
    throw new PairingFoundationError(503, "PROTOCOL_CONTEXT_UNRESOLVED", "Your active food-safety information is unavailable. Please try again.");
  }
  // Preserve Drink Pairing's existing protection; strengthen the weaker routes.
  if (requiresVerifiedIngredientEvidence(envelope)) {
    throw new PairingFoundationError(503, "PAIRING_INGREDIENTS_UNVERIFIED",
      "Verified pairing ingredients are unavailable for your active food-safety restrictions. Please check a complete label or ask the venue.");
  }
  if (cultureOverride?.trim()) {
    envelope = { ...envelope, cuisinePreference: cultureOverride.trim(), cuisineIntensity: "balanced" };
  }
  const profile = await loadPairingsProfile(userId);
  const personal = buildPairingsConstraints(profile).fullConstraintBlock;
  const protocol = enforceBeforeGenerate(envelope, { generatorName }).combined;
  return { envelope, generatorName, constraints: [protocol, personal].filter(Boolean).join("\n") };
}

function textFields(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textFields);
  if (value && typeof value === "object") return Object.values(value).flatMap(textFields);
  return [];
}

/** Scan every field that can reach a customer, including alternatives/advice. */
export function passesPairingOutput(value: unknown, context: PairingFoundationContext): boolean {
  assertDevelopment();
  const text = textFields(value);
  // The identity already forbids alcohol; use the existing beverage detector
  // to cover aliases (e.g. whiskey) not enumerated by the generic term scanner.
  // Check fields separately so one safe-variant phrase cannot mask another field.
  const alcoholForbidden = context.envelope.dietaryIdentity.some(identity => identity.toLowerCase().trim() === "halal");
  if (alcoholForbidden && containsAlcoholContent({ ingredients: text.map(name => ({ name })) })) return false;
  return scanGeneratedOutput({
    name: String((value as { name?: string })?.name ?? ""),
    description: text.join("\n"),
    ingredients: text,
    instructions: text,
  }, context.envelope, { generatorName: context.generatorName }).passed;
}

function noEligible(): never {
  throw new PairingFoundationError(422, "NO_ELIGIBLE_PAIRINGS",
    "No eligible pairing could be verified from this response. Please revise your request or provide a clearer wine list.");
}

export function foundationMetadata(rejectedCount: number, hasChoice = true) {
  return PairingFoundationMetadata.parse({
    version: 1, outcome: hasChoice ? "recommendation" : "clarification_needed",
    compositionEvidence: "unverified", compositionNote: COMPOSITION_NOTE, rejectedCount,
  });
}

export function validateDevelopmentPairings(
  raw: unknown, context: PairingFoundationContext, discoveryCategory?: "wine" | "beer",
) {
  assertDevelopment();
  if (!Array.isArray(raw) || raw.length > 10) return noEligible();
  const pairings: z.infer<typeof PairingItem>[] = [];
  for (const value of raw) {
    const parsed = FoundationPairingItem.safeParse({ ...value, imageUrl: null });
    if (!parsed.success) continue;
    const item = parsed.data;
    if (discoveryCategory && ((!item.flavorProfile || item.flavorProfile.length < 3 || item.flavorProfile.length > 6) || !item.body ||
      (item.category === "wine" && (!item.acidity || !item.sweetness)) ||
      (item.category === "beer" && !item.bitterness))) continue;
    if (passesPairingOutput(item, context)) pairings.push(item);
  }
  if (!pairings.length) return noEligible();
  return { pairings: PairingFoundationCards.parse(pairings), foundation: foundationMetadata(raw.length - pairings.length) };
}

export function validateDevelopmentWineList(raw: unknown, entries: WineListEntry[], context: PairingFoundationContext) {
  assertDevelopment();
  const response = raw as { pairings?: unknown; bestChoice?: unknown } | null;
  if (!Array.isArray(response?.pairings) || response.pairings.length > 100) return noEligible();
  const pairings: z.infer<typeof WineListFoundationItem>[] = [];
  const used = new Set<string>();
  for (const value of response.pairings) {
    const parsed = WineListFoundationItem.safeParse({ ...value, imageUrl: null });
    if (!parsed.success) continue;
    const entry = findWineListEntry(entries, parsed.data.name);
    if (!entry || used.has(entry.id)) continue;
    // Unknown/off-list/ambiguous alternatives invalidate the card, not just the highlight.
    const alternatives = parsed.data.alternatives.map(name => findWineListEntry(entries, name));
    if (alternatives.some(item => !item)) continue;
    const item = { ...parsed.data, name: entry.name, alternatives: alternatives.map(item => item!.name) };
    if (!passesPairingOutput(item, context)) continue;
    used.add(entry.id);
    pairings.push(item);
  }
  if (!pairings.length) return noEligible();
  const best = WineListFoundationBestChoice.safeParse(response.bestChoice);
  let bestChoice: { name: string; explanation: string } | null = null;
  if (best.success) {
    const entry = findWineListEntry(entries, best.data.name);
    if (entry && used.has(entry.id)) {
      const candidate = { name: entry.name, explanation: best.data.explanation };
      if (passesPairingOutput(candidate, context)) bestChoice = candidate;
    }
  }
  return {
    pairings: WineListFoundationCards.parse(pairings), bestChoice,
    foundation: foundationMetadata(response.pairings.length - pairings.length, !!bestChoice),
  };
}

export function validateDevelopmentChefPairings(raw: unknown, context: PairingFoundationContext) {
  assertDevelopment();
  if (!raw || typeof raw !== "object") return noEligible();
  const result: Record<"wine" | "beer" | "spirits", z.infer<typeof ChefFoundationItem>[]> = { wine: [], beer: [], spirits: [] };
  let rejectedCount = 0;
  for (const category of ["wine", "beer", "spirits"] as const) {
    const candidates = (raw as Record<string, unknown>)[category];
    if (!Array.isArray(candidates) || candidates.length > 10) return noEligible();
    for (const value of candidates) {
      const parsed = ChefFoundationItem.safeParse(value);
      if (!parsed.success || !passesPairingOutput({ ...parsed.data, category }, context)) {
        rejectedCount++;
        continue;
      }
      const item = parsed.data;
      // No product evidence exists to substantiate model-generated medical badges.
      if (item.medicalCompatibility) item.medicalCompatibility = {
        diabeticFriendly: false, lowCalorie: false,
        reason: "Product-specific medical and nutrition suitability has not been verified.",
      };
      item.healthNotes = [...item.healthNotes.slice(0, 9), "Nutrition and alcohol values are estimates, not verified product data."];
      if (!passesPairingOutput(item, context)) { rejectedCount++; continue; }
      result[category].push(item);
    }
  }
  if (!Object.values(result).some(items => items.length)) return noEligible();
  return { pairings: ChefFoundationGroups.parse(result), foundation: foundationMetadata(rejectedCount) };
}
