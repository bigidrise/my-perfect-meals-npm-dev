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

  it("treats all nine lessons as Phase 1 complete without a certificate", () => {
    const result = resolveAcademyProgression({
      ...emptyInput,
      completedPlatformLessonIds: PLATFORM_MASTERY_LESSON_IDS,
    });
    expect(result.phase1.complete).toBe(true);
    expect(result.nextStep.kind).toBe("start_marketing");
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
    expect(ineligible.nextStep.kind).toBe("view_specialist");
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