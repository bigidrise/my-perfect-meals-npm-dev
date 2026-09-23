import {
  buildCulinaryFingerprint,
  hasMeaningfulCulinaryRepetition,
  selectCulinarilyBroadConcepts,
  type CulinaryFingerprint,
} from "@shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import {
  directionToFingerprint,
  type OneTouchDirection,
} from "@shared/oneTouch";
import {
  canAttemptConceptCompletion,
  conceptCompletionFailure,
  missingConceptCount,
} from "../myPerfectMenu/candidateCompletion";
import { parseGeneratedMenuCandidates } from "../myPerfectMenu/generationContract";

export interface DirectionGenerationAttempt {
  requestedCount: number;
  attempt: number;
}

export interface GenerateOneTouchDirectionsInput {
  occasion: MyPerfectMenuCategory;
  history: CulinaryFingerprint[];
  existingDirections?: OneTouchDirection[];
  generate: (attempt: DirectionGenerationAttempt) => Promise<unknown>;
  validate: (direction: OneTouchDirection) => string[];
}

export interface GenerateOneTouchDirectionsResult {
  directions: OneTouchDirection[];
  history: CulinaryFingerprint[];
  attemptsCompleted: number;
  metadataRepairCount: number;
  rejectionCodes: string[];
}

export async function generateOneTouchDirections(
  input: GenerateOneTouchDirectionsInput,
): Promise<GenerateOneTouchDirectionsResult> {
  const candidates: OneTouchDirection[] = [...(input.existingDirections ?? [])].slice(0, 3);
  const rejectionCodes: string[] = [];
  let attemptsCompleted = 0;
  let metadataRepairCount = 0;
  let providerFailures = 0;

  while (canAttemptConceptCompletion(attemptsCompleted, candidates.length)) {
    const attempt = attemptsCompleted;
    attemptsCompleted += 1;
    const requestedCount = missingConceptCount(candidates.length);
    let raw: unknown;
    try {
      raw = await input.generate({ attempt, requestedCount });
    } catch {
      providerFailures += 1;
      continue;
    }
    const parsed = parseGeneratedMenuCandidates(raw, input.occasion);
    metadataRepairCount += parsed.metadataRepairCount;
    rejectionCodes.push(...parsed.rejectionCodes);
    for (const candidate of parsed.candidates) {
      const direction = { ...candidate, occasion: input.occasion } as OneTouchDirection;
      const violations = input.validate(direction);
      if (violations.length) {
        rejectionCodes.push(...violations);
        continue;
      }
      const fingerprint = buildCulinaryFingerprint(direction, input.occasion);
      if (
        input.history.some((prior) => prior.fingerprint === fingerprint.fingerprint) ||
        candidates.some((prior) => buildCulinaryFingerprint(prior, input.occasion).fingerprint === fingerprint.fingerprint)
      ) {
        rejectionCodes.push("repetition:signature");
        continue;
      }
      candidates.push(direction);
    }
    const broad = selectCulinarilyBroadConcepts(candidates, input.occasion, input.history, 3);
    candidates.splice(0, candidates.length, ...broad);
    if (candidates.length === 3 && !hasMeaningfulCulinaryRepetition(candidates, input.occasion)) break;
  }

  if (candidates.length !== 3) {
    const categories = rejectionCodes.reduce<Record<string, number>>((result, code) => {
      const category = code.includes(":") ? code.split(":")[0] : code;
      result[category] = (result[category] ?? 0) + 1;
      return result;
    }, {});
    const failure = conceptCompletionFailure(categories, providerFailures);
    throw Object.assign(new Error(failure.error), {
      code: failure.code,
      status: failure.status,
      missingCount: missingConceptCount(candidates.length),
      attemptsCompleted,
      metadataRepairCount,
    });
  }

  return {
    directions: candidates,
    history: candidates.map((direction) => directionToFingerprint(direction)),
    attemptsCompleted,
    metadataRepairCount,
    rejectionCodes,
  };
}