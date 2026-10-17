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
  options?: { dessertCompletion: boolean; acceptedCount: number },
): { status: number; code: string; error: string } {
  const metadataFailures = rejectionCounts.schema_metadata_failure ?? 0;
  const historyFailures = rejectionCounts.history_evidence_required ?? 0;
  const authorityFailures = Object.entries(rejectionCounts)
    .filter(([category]) => category !== "schema_metadata_failure" && category !== "repetition_rejection" &&
      category !== "history_evidence_required")
    .reduce((total, [, count]) => total + count, 0);

  if (options?.dessertCompletion && historyFailures > 0 && authorityFailures === 0) {
    return {
      status: 422,
      code: "CONCEPT_HISTORY_REVIEW_REQUIRED",
      error: "We couldn't verify three distinct dessert choices because some current or relevant saved dessert identities have incomplete or conflicting structure. " +
        "Your current choices are unchanged. This is a variety-verification limitation, not a medical prohibition.",
    };
  }
  if (options?.dessertCompletion && authorityFailures === 0 &&
    metadataFailures === 0 && providerFailureCount === 0) {
    return {
      status: 422,
      code: "CONCEPT_VARIETY_COMPLETION_FAILED",
      error: `We couldn't finish three distinct dessert ideas this time (${options.acceptedCount} passed validation). ` +
        "The remaining ideas repeated existing choices; this does not mean desserts are prohibited. " +
        "Your current choices are still here and your settings were not changed.",
    };
  }
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