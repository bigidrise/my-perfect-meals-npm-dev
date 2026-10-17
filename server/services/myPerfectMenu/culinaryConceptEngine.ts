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
import { randomUUID } from "node:crypto";
import { developmentSnackRepairEnabled } from "../snackCompatibilityRepair";
import {
  compareDessertStructures, dessertCompletionFeedback, isRelevantDessertHistory,
  type DessertReference,
} from "./developmentDessertCompletion";
import type { DessertDiagnostic, DessertDiagnosticSink } from "./dessertDiagnostics";

export interface CulinaryConceptRequest {
  occasion: MyPerfectMenuCategory;
  /** Only Creator Menus specify a shape; ordinary MPM keeps its current prompt. */
  menuShape?: "dish" | "craving";
  /** An explicit Craving Menu choice, not an inference from the snack occasion. */
  cravingCategory?: "food" | "dessert";
  /** Explicitly opted in by My Perfect Menu, never other Creator callers. */
  developmentDessertCompletion?: boolean;
  subjectLabel: string;
  userContext: string[];
  requiredCuisine: string | null;
  history: CulinaryFingerprint[];
  priorSignatures?: string[];
  previousDesserts?: DessertReference[];
  onDiagnostic?: DessertDiagnosticSink;
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
  const dessertRepairEnabled = input.developmentDessertCompletion === true &&
    input.occasion === "snack" && input.cravingCategory === "dessert" &&
    developmentSnackRepairEnabled();
  const targetCount = input.targetCount ?? 3;
  const priorSignatures = new Set((input.priorSignatures ?? []).map(normalizeSignature));
  const candidatePool: GeneratedMenuConcept[] = [];
  const rejectedReasons: string[] = [];
  let accepted: GeneratedMenuConcept[] = [];
  let attemptsCompleted = 0;
  let metadataRepairCount = 0;
  let providerFailureCount = 0;
  let candidateCount = 0;
  let rejectedCount = 0;
  let schemaIssueCount = 0;
  let invalidResponseCount = 0;
  const diagnosticRunId = dessertRepairEnabled ? randomUUID() : undefined;
  const emit: DessertDiagnosticSink | undefined = dessertRepairEnabled ? event => {
    if (event.stage === "schema") {
      if (event.candidateId?.endsWith(":envelope")) invalidResponseCount++;
      else {
        candidateCount++;
        if (event.outcome === "invalid") rejectedCount++;
      }
      schemaIssueCount += event.issues?.filter(issue => issue.phase === "after").length ?? 0;
    }
    if (event.stage === "candidate" && event.outcome === "rejected") rejectedCount++;
    // Only controlled enums, booleans, counters and request-local identifiers.
    // No prompts, profiles, titles, ingredients, descriptions or medical details.
    console.info("[dessert-completion]", { runId: diagnosticRunId, ...event });
    input.onDiagnostic?.(event);
  } : undefined;
  const completeDiagnostic = () => emit?.({
    stage: "completion", attempt: attemptsCompleted,
    acceptedCount: accepted.length, rejectedCount, candidateCount, schemaIssueCount,
    providerFailureCount, invalidResponseCount, rejectionCounts: rejectionCategoryCounts(rejectedReasons),
  });
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
    dessertRepairEnabled
      ? "DESSERT METADATA CONTRACT: title 3–80 characters; description 3–180; primaryIngredients 2–10 explicit ingredients, each 1–80 characters; cuisine and preparationMethod 2–80; signature 5–180. Culinary identity text must be 1–80 characters and definingComponents 1–8 entries. Use null for unknown optional protein metadata and [] for absent advisory dietaryEvidence. Do not invent ingredients, cuisine or nutrition to fill a field. Give accurate, consistent dessert structure and format metadata, not renamed flavor variants of one dessert."
      : "",
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
    input.menuShape === "dish"
      ? "DISH MENU: Each idea is ONE recognizable culinary preparation (such as beef chili, chicken curry, vegetable lasagna, or shrimp jambalaya), not a generic plate of a protein plus separate starch and vegetable. A dish may have many ingredients, garnish and sauce."
      : "",
    input.menuShape === "craving"
      ? "CRAVING MENU: Snack describes the eating occasion, not a small portion or a narrow snack-food family. Tacos, fries, salads, chili, sandwiches and desserts can all fit when the person's authority permits them."
      : "",
    input.menuShape === "craving" && input.cravingCategory === "dessert"
      ? "DESSERT CRAVING — REQUIRED FOOD IDENTITY: Create recognizable desserts from the outset, not generic snacks later labeled as desserts. Each concept must have foodIdentity.foodRole = dessert, sweet polarity, and a specific dessert formatFamily (cake, cookie, brownie, pie, pudding_custard, cheesecake, frozen_dessert, pastry, confection, bar, or no_bake_dessert). Preserve dessert identity while adapting ingredients to every resolved dietary, allergy, avoidance, and clinical requirement. If a dessert cannot safely fit, do not replace it with unrelated snack food."
      : "",
    input.menuShape === "craving" && input.cravingCategory === "food"
      ? "FOOD CRAVING — REQUIRED FOOD IDENTITY: Create non-dessert food cravings from the outset, not dessert concepts to filter later. Sweet food is possible, but dessert identity is not requested."
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
      input.cravingCategory === "dessert"
        ? `Every missing position must be a recognizable dessert adapted to the person's requirements. Return only ${requestedCount} dessert concept${requestedCount === 1 ? "" : "s"}; retain the already approved desserts.`
        : input.cravingCategory === "food"
          ? `Every missing position must be a non-dessert food craving. Return only ${requestedCount} food concept${requestedCount === 1 ? "" : "s"}.`
          : "",
      dessertRepairEnabled
        ? `Historical signature hints: ${[...priorSignatures].join(", ") || "none"}. Signature equality is not proof of duplication. Avoid repeating actual dessert structures; genuinely different desserts can share ingredients or coarse signatures.`
        : `Previously shown signatures to avoid immediately: ${[...priorSignatures].join(", ") || "none"}.`,
      `Recent culinary patterns to move beyond when appropriate: ${recentPatterns.join(", ") || "none"}.`,
      rejectedReasons.length
        ? `Repair only the missing ${requestedCount} position(s). Prior rejection categories: ${Object.keys(rejectionCategoryCounts(rejectedReasons)).join(", ")}. Keep every authoritative constraint above.`
        : "",
      candidatePool.length
        ? `${accepted.length} governed candidate(s) are already retained. Generate only the ${requestedCount} missing position(s); broaden compliant culinary structures without changing the person's context or cuisine.`
        : "",
      dessertRepairEnabled ? dessertCompletionFeedback(accepted) : "",
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
    const parsed = parseGeneratedMenuCandidates(raw, input.occasion, dessertRepairEnabled ? {
      developmentDessertRepair: true, attempt: attempt + 1, onDiagnostic: emit,
    } : undefined);
    rejectedReasons.push(...parsed.rejectionCodes);
    metadataRepairCount += parsed.metadataRepairCount;
    for (const [candidateIndex, candidate] of parsed.candidates.entries()) {
      const candidateId = parsed.candidateIds?.[candidateIndex];
      const candidateEvent = (outcome: "accepted" | "rejected", branch: string) => emit?.({
        stage: "candidate", attempt: attempt + 1, candidateId, outcome, branch,
      });
      if (dessertRepairEnabled && candidatePool.length >= targetCount) {
        candidateEvent("rejected", "surplus_candidate");
        continue;
      }
      const signature = normalizeSignature(candidate.signature);
      if (!dessertRepairEnabled && (priorSignatures.has(signature) ||
        candidatePool.some((item) => normalizeSignature(item.signature) === signature))) {
        rejectedReasons.push("repetition:signature");
        continue;
      }
      const violations = input.validate(candidate);
      if (violations.length) {
        rejectedReasons.push(...violations);
        candidateEvent("rejected", "governance");
        continue;
      }
      if (dessertRepairEnabled) {
        const historicalReferences = input.history.map((reference, index) => ({
          reference, id: `history${index + 1}`, scope: "history" as const,
        }));
        for (const { reference, id } of historicalReferences) {
          if (isRelevantDessertHistory(reference, candidate)) continue;
          const comparison = compareDessertStructures(candidate, reference);
          emit?.({
            stage: "comparison", attempt: attempt + 1, candidateId, referenceId: id,
            branch: "history:unclassified_nonmatching_snack",
            evidence: comparison.evidence,
          });
        }
        const references: { reference: DessertReference; id: string; scope: "batch" | "history" }[] = [
          ...candidatePool.map((reference, index) => ({ reference, id: `batch${index + 1}`, scope: "batch" as const })),
          ...(input.previousDesserts ?? []).map((reference, index) => ({ reference, id: `saved${index + 1}`, scope: "history" as const })),
          ...historicalReferences.filter(({ reference }) => isRelevantDessertHistory(reference, candidate)),
        ];
        let rejection: string | undefined;
        // Even an empty-history request needs an inspectable current structure.
        const currentStructure = compareDessertStructures(candidate, candidate);
        if (currentStructure.decision === "uncertain") {
          rejection = "history_uncertainty:current_structure";
          emit?.({
            stage: "comparison", attempt: attempt + 1, candidateId,
            branch: `current:${currentStructure.branch}`, evidence: currentStructure.evidence,
          });
        }
        for (const { reference, id, scope } of references) {
          const comparison = compareDessertStructures(candidate, reference);
          const signatureCollision = scope === "history" && priorSignatures.has(signature);
          emit?.({
            stage: "comparison", attempt: attempt + 1, candidateId, referenceId: id,
            branch: `${scope}:${comparison.branch}`,
            evidence: { ...comparison.evidence, signatureCollision },
          });
          if (comparison.decision === "duplicate") {
            rejection = `repetition:${scope}_dessert_structure`;
            break;
          }
          if (comparison.decision === "uncertain") {
            rejection = `history_uncertainty:${scope}_structure`;
            break;
          }
        }
        if (!rejection && priorSignatures.has(signature) &&
          !references.some(reference => reference.scope === "history")) {
          rejection = "history_uncertainty:unresolved_signature";
          emit?.({
            stage: "comparison", attempt: attempt + 1, candidateId,
            branch: "history:unresolved_signature",
            evidence: { leftStructure: true, rightStructure: false, ingredientOverlap: 0, signatureCollision: true },
          });
        }
        if (rejection) {
          rejectedReasons.push(rejection);
          candidateEvent("rejected", rejection.split(":")[0] === "repetition" ? "duplicate" : "insufficient_structure");
          continue;
        }
      }
      // A previous set should not be repeated even when the model renames its signature.
      const fingerprint = buildCulinaryFingerprint(candidate, input.occasion);
      if (!dessertRepairEnabled && input.rejectHistoryFingerprints &&
        input.history.some((item) => item.fingerprint === fingerprint.fingerprint)) {
        rejectedReasons.push("repetition:signature");
        continue;
      }
      candidatePool.push(candidate);
      candidateEvent("accepted", "governed_distinct");
    }
    accepted = dessertRepairEnabled
      ? candidatePool.slice(0, targetCount)
      : selectCulinarilyBroadConcepts(candidatePool, input.occasion, input.history, targetCount);
    if (accepted.length === targetCount &&
      (dessertRepairEnabled || !hasMeaningfulCulinaryRepetition(accepted, input.occasion))) break;
  }

  if (accepted.length !== targetCount) {
    completeDiagnostic();
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
    const failure = conceptCompletionFailure(rejectionCounts, providerFailureCount,
      dessertRepairEnabled ? { dessertCompletion: true, acceptedCount: accepted.length } : undefined);
    throw Object.assign(new Error(failure.error), {
      code: failure.code,
      status: failure.status,
      missingCount: targetCount - accepted.length,
      attemptsCompleted,
      metadataRepairCount,
    });
  }
  completeDiagnostic();
  return { concepts: accepted, attemptsCompleted, metadataRepairCount, providerFailureCount, rejectionCodes: rejectedReasons };
}