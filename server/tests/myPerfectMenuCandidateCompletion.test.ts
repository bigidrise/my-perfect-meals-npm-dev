import {
  canAttemptConceptCompletion,
  conceptCompletionFailure,
  missingConceptCount,
  PROGRESS_CONCEPT_ATTEMPT_LIMIT,
} from "../services/myPerfectMenu/candidateCompletion";

describe("My Perfect Menu bounded candidate completion", () => {
  it.each([
    [0, 3],
    [1, 2],
    [2, 1],
    [3, 0],
  ])("requests only the missing concepts after retaining %s", (accepted, missing) => {
    expect(missingConceptCount(accepted)).toBe(missing);
  });

  it("allows two additional bounded attempts only when valid progress exists", () => {
    expect(canAttemptConceptCompletion(3, 0)).toBe(false);
    expect(canAttemptConceptCompletion(3, 1)).toBe(true);
    expect(canAttemptConceptCompletion(4, 2)).toBe(true);
    expect(canAttemptConceptCompletion(PROGRESS_CONCEPT_ATTEMPT_LIMIT, 2)).toBe(false);
  });

  it("does not blame food needs for technical metadata failure", () => {
    const failure = conceptCompletionFailure({ schema_metadata_failure: 5 }, 0);
    expect(failure.code).toBe("CONCEPT_TECHNICAL_COMPLETION_FAILED");
    expect(failure.error).toContain("current choices are still here");
    expect(failure.error).not.toContain("food needs");
  });

  it("keeps genuine authority rejection distinct", () => {
    const failure = conceptCompletionFailure({ allergen_or_avoidance_violation: 3 }, 0);
    expect(failure.code).toBe("CONCEPT_REPAIR_EXHAUSTED");
    expect(failure.error).toContain("compatible ideas");
  });
});