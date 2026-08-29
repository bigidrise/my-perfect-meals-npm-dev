export const PLATFORM_MASTERY_LESSON_IDS = Array.from(
  { length: 9 },
  (_, index) => `lesson-${String(index + 1).padStart(2, "0")}`,
);

export const MARKETING_COACHING_MODULE_IDS = Array.from(
  { length: 6 },
  (_, index) => `marketing-module-${index + 1}`,
);

export const SPECIALIST_CERTIFICATION_TYPE = "mpm_specialist";

export type AcademyNextStepKind =
  | "start_platform"
  | "continue_platform"
  | "start_marketing"
  | "continue_marketing"
  | "claim_specialist"
  | "view_specialist"
  | "start_procare"
  | "view_procare"
  | "academy_complete";

export interface AcademyProgressionInput {
  completedPlatformLessonIds: string[];
  completedMarketingModuleIds: string[];
  legacyPlatformComplete: boolean;
  legacyMarketingComplete: boolean;
  specialistCredentialComplete: boolean;
  proCareTrainingComplete: boolean;
  proCareTrainingEligible: boolean;
}

export interface AcademyProgression {
  phase1: { complete: boolean; completed: number; total: number };
  phase2: { complete: boolean; completed: number; total: number };
  specialist: { eligible: boolean; complete: boolean };
  proCare: { eligible: boolean; complete: boolean; optional: true };
  nextStep: { kind: AcademyNextStepKind; route: string; label: string };
}

function countRequired(completed: string[], required: string[]): number {
  const completedSet = new Set(completed);
  return required.filter((id) => completedSet.has(id)).length;
}

export function resolveAcademyProgression(
  input: AcademyProgressionInput,
): AcademyProgression {
  const platformCompleted = countRequired(
    input.completedPlatformLessonIds,
    PLATFORM_MASTERY_LESSON_IDS,
  );
  const marketingCompleted = countRequired(
    input.completedMarketingModuleIds,
    MARKETING_COACHING_MODULE_IDS,
  );
  const phase1Complete =
    platformCompleted === PLATFORM_MASTERY_LESSON_IDS.length ||
    input.legacyPlatformComplete;
  const phase2Complete =
    marketingCompleted === MARKETING_COACHING_MODULE_IDS.length ||
    input.legacyMarketingComplete;
  const specialistEligible = phase1Complete && phase2Complete;

  let nextStep: AcademyProgression["nextStep"];
  if (!phase1Complete) {
    nextStep = platformCompleted > 0
      ? {
          kind: "continue_platform",
          route: `/academy/platform-mastery/lesson/${
            PLATFORM_MASTERY_LESSON_IDS.find(
              (id) => !input.completedPlatformLessonIds.includes(id),
            ) ?? PLATFORM_MASTERY_LESSON_IDS[0]
          }`,
          label: "Continue Platform Mastery",
        }
      : {
          kind: "start_platform",
          route: `/academy/platform-mastery/lesson/${PLATFORM_MASTERY_LESSON_IDS[0]}`,
          label: "Start Platform Mastery",
        };
  } else if (!phase2Complete) {
    nextStep = {
      kind: marketingCompleted > 0 ? "continue_marketing" : "start_marketing",
      route: "/business-center/affiliate/marketing/certification",
      label:
        marketingCompleted > 0
          ? "Continue Marketing & Coaching"
          : "Start Marketing & Coaching",
    };
  } else if (!input.specialistCredentialComplete) {
    nextStep = {
      kind: "claim_specialist",
      route: "/business-center/affiliate/marketing/certification/complete",
      label: "Claim Specialist Certificate",
    };
  } else if (
    input.proCareTrainingEligible &&
    !input.proCareTrainingComplete
  ) {
    nextStep = {
      kind: "start_procare",
      route: "/certifications/procare_certification",
      label: "Start ProCare Certification",
    };
  } else if (input.proCareTrainingComplete) {
    nextStep = {
      kind: "view_procare",
      route: "/procare-certified",
      label: "View ProCare Credential",
    };
  } else {
    nextStep = {
      kind: "view_specialist",
      route: "/business-center/affiliate/marketing/certification/view",
      label: "View Specialist Certificate",
    };
  }

  return {
    phase1: {
      complete: phase1Complete,
      completed: platformCompleted,
      total: PLATFORM_MASTERY_LESSON_IDS.length,
    },
    phase2: {
      complete: phase2Complete,
      completed: marketingCompleted,
      total: MARKETING_COACHING_MODULE_IDS.length,
    },
    specialist: {
      eligible: specialistEligible,
      complete: input.specialistCredentialComplete,
    },
    proCare: {
      eligible: input.proCareTrainingEligible,
      complete: input.proCareTrainingComplete,
      optional: true,
    },
    nextStep,
  };
}