import type { HumanFoodFinalValidationResult } from "../../../shared/humanFoodValidation";

export interface FinalCreatorValidation<T> {
  candidate: T;
  result: HumanFoodFinalValidationResult;
}

export interface EnforceFinalCreatorCandidatesInput<T> {
  candidates: T[];
  validate: (candidate: T) => HumanFoodFinalValidationResult;
  repair: (instructions: string[]) => Promise<T[]>;
}

export interface EnforceFinalCreatorCandidatesResult<T> {
  accepted: T[];
  validations: FinalCreatorValidation<T>[];
  repairAttempted: boolean;
  repeatedRepairRejected: boolean;
}

/**
 * Shared Stage 2C outcome controller. It never resolves context: callers close
 * over the one authoritative request context in `validate` and `repair`.
 */
export async function enforceFinalCreatorCandidates<T>(
  input: EnforceFinalCreatorCandidatesInput<T>,
): Promise<EnforceFinalCreatorCandidatesResult<T>> {
  const initial = input.candidates.map((candidate) => ({
    candidate,
    result: input.validate(candidate),
  }));
  const accepted = initial
    .filter(({ result }) => result.outcome === "pass")
    .map(({ candidate }) => candidate);
  const repairable = initial.find(({ result }) => result.outcome === "repairable");
  if (!repairable) {
    return {
      accepted,
      validations: initial,
      repairAttempted: false,
      repeatedRepairRejected: false,
    };
  }

  const repairedCandidates = await input.repair(repairable.result.repairInstructions);
  const repaired = repairedCandidates.map((candidate) => ({
    candidate,
    result: input.validate(candidate),
  }));
  let repeatedRepairRejected = false;
  for (const validation of repaired) {
    if (validation.result.outcome !== "pass") continue;
    if (validation.result.candidateSignature === repairable.result.candidateSignature) {
      repeatedRepairRejected = true;
      continue;
    }
    accepted.push(validation.candidate);
  }
  return {
    accepted,
    validations: [...initial, ...repaired],
    repairAttempted: true,
    repeatedRepairRejected,
  };
}