import {
  MARKETING_COACHING_MODULE_IDS,
  PLATFORM_MASTERY_LESSON_IDS,
  resolveAcademyProgression,
} from "../../shared/academyProgression";

const emptyInput = {
  completedPlatformLessonIds: [] as string[],
  completedMarketingModuleIds: [] as string[],
  legacyPlatformComplete: false,
  legacyMarketingComplete: false,
  specialistCredentialComplete: false,
  proCareTrainingComplete: false,
  proCareTrainingEligible: false,
};

describe("Academy progression", () => {
  it("starts with Platform Mastery", () => {
    const result = resolveAcademyProgression(emptyInput);
    expect(result.phase1.complete).toBe(false);
    expect(result.nextStep.kind).toBe("start_platform");
  });

  it("treats 9/9 lessons as Phase 1 complete when the parent row is still in progress", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      // false models a stale platform_mastery parent row that is not completed.
      legacyPlatformComplete: false,
    });
    expect(result.phase1.complete).toBe(true);
    expect(result.phase1.completed).toBe(9);
    expect(result.nextStep.kind).toBe("start_marketing");
  });

  it("keeps Phase 1 incomplete when only 8/9 required lessons are complete", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS.slice(0, -1),
      legacyPlatformComplete: false,
    });
    expect(result.phase1.complete).toBe(false);
    expect(result.phase1.completed).toBe(8);
    expect(result.nextStep.kind).toBe("continue_platform");
  });

  it("requires every Marketing module before Specialist eligibility", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      completedMarketingModuleIds: MARKETING_COACHING_MODULE_IDS.slice(0, -1),
    });
    expect(result.phase2.complete).toBe(false);
    expect(result.specialist.eligible).toBe(false);
    expect(result.nextStep.kind).toBe("continue_marketing");
  });

  it("makes Phase 1 plus Phase 2 eligible for the Specialist credential", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      completedMarketingModuleIds: MARKETING_COACHING_MODULE_IDS,
    });
    expect(result.specialist.eligible).toBe(true);
    expect(result.nextStep.kind).toBe("claim_specialist");
  });

  it("does not let optional ProCare block the core credential", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      completedMarketingModuleIds: MARKETING_COACHING_MODULE_IDS,
      specialistCredentialComplete: true,
      proCareTrainingEligible: false,
    });
    expect(result.specialist.complete).toBe(true);
    expect(result.proCare.optional).toBe(true);
    expect(result.summary.coreComplete).toBe(true);
    expect(result.summary.allCertificationsComplete).toBe(true);
    expect(result.nextStep.kind).toBe("view_specialist");
  });

  it("offers optional ProCare only to eligible professionals", () => {
    const eligible = resolveAcademyProgression({
      ...emptyInput,
      legacyPlatformComplete: true,
      legacyMarketingComplete: true,
      specialistCredentialComplete: true,
      proCareTrainingEligible: true,
    });
    const ineligible = resolveAcademyProgression({
      ...emptyInput,
      legacyPlatformComplete: true,
      legacyMarketingComplete: true,
      specialistCredentialComplete: true,
      proCareTrainingEligible: false,
    });
    expect(eligible.nextStep.kind).toBe("start_procare");
    expect(eligible.summary.coreComplete).toBe(true);
    expect(eligible.summary.allCertificationsComplete).toBe(false);
    expect(ineligible.nextStep.kind).toBe("view_specialist");
    expect(ineligible.summary.allCertificationsComplete).toBe(true);
  });

  it("keeps the summary and rows consistent until eligible ProCare training is complete", () => {
    const incomplete = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      completedMarketingModuleIds: MARKETING_COACHING_MODULE_IDS,
      specialistCredentialComplete: true,
      proCareTrainingEligible: true,
      proCareTrainingComplete: false,
    });
    const complete = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
      completedMarketingModuleIds: MARKETING_COACHING_MODULE_IDS,
      specialistCredentialComplete: true,
      proCareTrainingEligible: true,
      proCareTrainingComplete: true,
    });

    expect(incomplete.phase2.complete).toBe(true);
    expect(incomplete.proCare.complete).toBe(false);
    expect(incomplete.summary.allCertificationsComplete).toBe(false);
    expect(complete.phase2.complete).toBe(true);
    expect(complete.proCare.complete).toBe(true);
    expect(complete.summary.allCertificationsComplete).toBe(true);
  });

  it("preserves legacy completions without relabeling their records", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      legacyPlatformComplete: true,
      legacyMarketingComplete: true,
    });
    expect(result.phase1.complete).toBe(true);
    expect(result.phase2.complete).toBe(true);
    expect(result.specialist.complete).toBe(false);
  });
});