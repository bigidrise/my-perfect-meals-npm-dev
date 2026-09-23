import {
  buildCulinaryFingerprint,
  hasMeaningfulCulinaryRepetition,
  selectCulinarilyBroadConcepts,
  type CulinaryFingerprint,
} from "@shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import { chatJson } from "../../utils/openaiSafe";
import {
  parseGeneratedMenuCandidates,
  rejectionCategoryCounts,
  type GeneratedMenuConcept,
} from "./generationContract";
import {
  canAttemptConceptCompletion,
  conceptCompletionFailure,
} from "./candidateCompletion";

export interface CulinaryConceptRequest {
  occasion: MyPerfectMenuCategory;
  subjectLabel: string;
  userContext: string[];
  requiredCuisine: string | null;
  history: CulinaryFingerprint[];
  priorSignatures?: string[];
  rejectHistoryFingerprints?: boolean;
  targetCount?: 1 | 2 | 3;
  validate: (concept: GeneratedMenuConcept) => string[];
  extraInstructions?: string[];
  generate?: (request: {
    attempt: number;
    requestedCount: number;
    temperature: number;
    system: string;
    user: string;
  }) => Promise<unknown>;
}

export interface CulinaryConceptResult {
  concepts: GeneratedMenuConcept[];
  attemptsCompleted: number;
  metadataRepairCount: number;
  providerFailureCount: number;
  rejectionCodes: string[];
}

const normalizeSignature = (signature: string) =>
  signature.toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The same non-persisting concept intelligence serves Menu and delegated
 * Creators. The caller owns authorization, history storage, and destination.
 */
export async function generateCulinaryConcepts(input: CulinaryConceptRequest): Promise<CulinaryConceptResult> {
  const targetCount = input.targetCount ?? 3;
  const priorSignatures = new Set((input.priorSignatures ?? []).map(normalizeSignature));
  const candidatePool: GeneratedMenuConcept[] = [];
  const rejectedReasons: string[] = [];
  let accepted: GeneratedMenuConcept[] = [];
  let attemptsCompleted = 0;
  let metadataRepairCount = 0;
  let providerFailureCount = 0;
  const recentPatterns = input.history.slice(0, 48).map((item) => [
    item.dishForm,
    item.preparationStyle,
    item.majorStarchBase || item.primaryProteinBase || "none",
    item.flavorFamily,
    item.texture || "unspecified",
    item.temperature || "unspecified",
  ].join("|"));

  const system = [
    "You create lightweight, fully personalized menu concepts for My Perfect Meals.",
    "Return JSON only with: {\"concepts\":[{\"title\":\"\",\"description\":\"\",\"primaryIngredients\":[\"\"],\"primaryProtein\":null,\"produceItems\":[],\"cuisine\":\"\",\"dietaryEvidence\":[],\"preparationMethod\":\"\",\"signature\":\"\",\"culinaryIdentity\":{\"dishForm\":\"\",\"preparationStyle\":\"\",\"texture\":\"\",\"temperature\":\"hot|warm|room_temperature|chilled|frozen\",\"primaryProteinBase\":null,\"majorStarchBase\":null,\"flavorFamily\":\"\",\"cuisineEvidence\":\"\",\"definingComponents\":[\"\"]},\"foodIdentity\":{\"foodRole\":\"dessert|general_snack\",\"polarity\":\"sweet|savory|neutral\",\"formatFamily\":\"cookie|brownie|cake|cupcake|cheesecake|pudding_custard|frozen_dessert|bar|muffin|pie|no_bake_dessert|pastry|confection|general_sweet|general_snack\",\"preparationStyle\":\"baked|frozen|chilled|no_bake|prepared|raw\",\"texture\":\"creamy|crunchy|chewy|soft|crisp|smooth|mixed\"}}]}",
    "Return exactly the requested number of candidates, from 1 to 3. They are concepts, not recipes: no quantities, instructions, nutrition numbers, medical claims, or images.",
    "primaryIngredients must name every meaningful food needed to validate the concept.",
    "signature must be a compact normalized dish-format + protein + method identity.",
    "Include culinaryIdentity for every candidate. It describes the food and supports recommendation breadth; it is not a health or nutrition rule.",
    "Treat changing only the protein, adjective, or cuisine label on an otherwise identical bowl, salad, wrap, plate, or other structure as substantial similarity.",
    "Explore meaningfully different dish forms, bases, preparations, flavors, textures, and temperatures when they fit the person. Do not use quotas or force every dimension to differ.",
    "Do not default to generic healthy-food templates such as bowls, salads, grilled protein with vegetables, yogurt, oatmeal, or wraps.",
    "Every candidate must obey the supplied authoritative context and protocol guidance.",
    input.requiredCuisine
      ? `Cuisine requirement: every candidate must be recognizably ${input.requiredCuisine}; adapt that cuisine to higher-priority requirements rather than changing cuisines.`
      : "Use the resolved cuisine guidance when available.",
    "Foods I Enjoy and learned preferences improve ranking but never override protections.",
    input.occasion === "snack"
      ? "SNACK DEFINITION: snack is an eating occasion, not a narrow food category. Dessert is a normal possible snack family alongside savory, fruit-based, baked, chilled/frozen, dairy or dairy-alternative, grain-based, and protein-oriented foods. Rank styles from this person's context and recent variety. Do not force a dessert or any sweet/savory quota."
      : "",
    input.occasion === "snack"
      ? "For snack candidates, include foodIdentity. Use it for personalization and diversity only, never as a safety or nutrition rule. Do not define appropriateness by a universal calorie range, protein target, fiber target, or artificially tiny portion."
      : "",
    "When compatible with the authoritative context, carbohydrate structure may be one breadth dimension (lower, moderate, or higher), but never invent targets, weaken clinical guidance, or force a quota.",
  ].join("\n");

  while (targetCount === 3
    ? canAttemptConceptCompletion(attemptsCompleted, accepted.length)
    : accepted.length < targetCount && (attemptsCompleted < 3 || (accepted.length > 0 && attemptsCompleted < 5))) {
    const attempt = attemptsCompleted++;
    const requestedCount = targetCount - accepted.length;
    const user = [
      ...input.userContext,
      `Create exactly ${requestedCount} additional ${input.occasion} concept${requestedCount === 1 ? "" : "s"} for ${input.subjectLabel}.`,
      `Previously shown signatures to avoid immediately: ${[...priorSignatures].join(", ") || "none"}.`,
      `Recent culinary patterns to move beyond when appropriate: ${recentPatterns.join(", ") || "none"}.`,
      rejectedReasons.length
        ? `Repair only the missing ${requestedCount} position(s). Prior rejection categories: ${Object.keys(rejectionCategoryCounts(rejectedReasons)).join(", ")}. Keep every authoritative constraint above.`
        : "",
      candidatePool.length
        ? `${accepted.length} governed candidate(s) are already retained. Generate only the ${requestedCount} missing position(s); broaden compliant culinary structures without changing the person's context or cuisine.`
        : "",
      "Vary dish format, primary protein, preparation method, flavor profile, and—when relevant—food identity dimensions without overriding the person's preferences.",
      ...(input.extraInstructions ?? []),
    ].filter(Boolean).join("\n\n");
    let raw: unknown;
    try {
      const request = { attempt, requestedCount, temperature: attempt === 0 ? 0.55 : 0.7, system, user };
      raw = input.generate ? await input.generate(request) : await chatJson(request);
    } catch {
      providerFailureCount++;
      continue;
    }
    const parsed = parseGeneratedMenuCandidates(raw, input.occasion);
    rejectedReasons.push(...parsed.rejectionCodes);
    metadataRepairCount += parsed.metadataRepairCount;
    for (const candidate of parsed.candidates) {
      const signature = normalizeSignature(candidate.signature);
      if (priorSignatures.has(signature) ||
        candidatePool.some((item) => normalizeSignature(item.signature) === signature)) {
        rejectedReasons.push("repetition:signature");
        continue;
      }
      const violations = input.validate(candidate);
      if (violations.length) {
        rejectedReasons.push(...violations);
        continue;
      }
      // A previous set should not be repeated even when the model renames its signature.
      const fingerprint = buildCulinaryFingerprint(candidate, input.occasion);
      if (input.rejectHistoryFingerprints &&
        input.history.some((item) => item.fingerprint === fingerprint.fingerprint)) {
        rejectedReasons.push("repetition:signature");
        continue;
      }
      candidatePool.push(candidate);
    }
    accepted = selectCulinarilyBroadConcepts(candidatePool, input.occasion, input.history, targetCount);
    if (accepted.length === targetCount && !hasMeaningfulCulinaryRepetition(accepted, input.occasion)) break;
  }

  if (accepted.length !== targetCount) {
    const rejectionCounts = rejectionCategoryCounts(rejectedReasons);
    console.warn("[culinary-concepts] completion exhausted", {
      occasion: input.occasion,
      acceptedCount: accepted.length,
      missingCount: targetCount - accepted.length,
      rejectionCounts,
      metadataRepairCount,
      providerFailureCount,
      attemptsCompleted,
    });
    const failure = conceptCompletionFailure(rejectionCounts, providerFailureCount);
    throw Object.assign(new Error(failure.error), {
      code: failure.code,
      status: failure.status,
      missingCount: targetCount - accepted.length,
      attemptsCompleted,
      metadataRepairCount,
    });
  }
  return { concepts: accepted, attemptsCompleted, metadataRepairCount, providerFailureCount, rejectionCodes: rejectedReasons };
}