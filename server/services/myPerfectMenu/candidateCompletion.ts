export const INITIAL_CONCEPT_ATTEMPT_LIMIT = 3;
export const PROGRESS_CONCEPT_ATTEMPT_LIMIT = 5;

export function missingConceptCount(acceptedCount: number): number {
  return Math.max(0, 3 - acceptedCount);
}

export function canAttemptConceptCompletion(
  attemptsCompleted: number,
  acceptedCount: number,
): boolean {
  if (missingConceptCount(acceptedCount) === 0) return false;
  if (attemptsCompleted < INITIAL_CONCEPT_ATTEMPT_LIMIT) return true;
  return acceptedCount > 0 && attemptsCompleted < PROGRESS_CONCEPT_ATTEMPT_LIMIT;
}

export function conceptCompletionFailure(
  rejectionCounts: Record<string, number>,
  providerFailureCount: number,
): { status: number; code: string; error: string } {
  const metadataFailures = rejectionCounts.schema_metadata_failure ?? 0;
  const authorityFailures = Object.entries(rejectionCounts)
    .filter(([category]) => category !== "schema_metadata_failure" && category !== "repetition_rejection")
    .reduce((total, [, count]) => total + count, 0);

  if (providerFailureCount > 0 && metadataFailures === 0 && authorityFailures === 0) {
    return {
      status: 502,
      code: "CONCEPT_PROVIDER_INCOMPLETE",
      error: "We couldn't finish creating three new ideas this time. Your current choices are still here. Please try again.",
    };
  }
  if (metadataFailures > 0 && authorityFailures === 0) {
    return {
      status: 422,
      code: "CONCEPT_TECHNICAL_COMPLETION_FAILED",
      error: "We couldn't finish creating three new ideas this time. Your current choices are still here. Please try again.",
    };
  }
  return {
    status: 422,
    code: "CONCEPT_REPAIR_EXHAUSTED",
    error: "We couldn't complete three compatible ideas this time. Your current choices are still here and your settings were not changed.",
  };
}