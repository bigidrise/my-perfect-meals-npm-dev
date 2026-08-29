export const PROCARE_CERTIFICATION_TYPE = "procare_certification";
export const LEGACY_PROCARE_CERTIFICATION_TYPE = "platform";
export const PROCARE_FINAL_ASSESSMENT_ID = "final";
export const PROCARE_PASSING_SCORE = 80;
export const PROCARE_FINAL_QUESTION_COUNT = 20;

export const PROCARE_MODULE_SEQUENCE = [
  "module-1",
  "quiz-1",
  "module-2",
  "quiz-2",
  "module-3",
  "quiz-3",
] as const;

export const PROCARE_REQUIRED_SEQUENCE = [
  ...PROCARE_MODULE_SEQUENCE,
  PROCARE_FINAL_ASSESSMENT_ID,
] as const;

export const PROCARE_VIDEO_MODULE_IDS = [
  "module-1",
  "module-2",
  "module-3",
] as const;

export const PROCARE_QUIZ_MODULE_IDS = [
  "quiz-1",
  "quiz-2",
  "quiz-3",
] as const;

export type ProCareModuleId = (typeof PROCARE_REQUIRED_SEQUENCE)[number];

type CourseModuleEvidence = {
  slug: string;
  moduleType: string;
};

export type ProCareProgressEvidence = {
  moduleId: string;
  status: string;
  score?: number | null;
  videoWatchedPct?: number | null;
};

export type ProCareQuestionEvidence = {
  id: string;
  moduleSlug: string;
  sortOrder?: number | null;
};

export type ProCareAttemptSnapshot = {
  assessmentId: string;
  submittedAnswers: Record<string, string>;
};

const EXPECTED_MODULE_TYPES = new Map<string, string>([
  ["module-1", "video"],
  ["quiz-1", "quiz"],
  ["module-2", "video"],
  ["quiz-2", "quiz"],
  ["module-3", "video"],
  ["quiz-3", "quiz"],
]);

const PROCARE_EVIDENCE_IDS = new Set<string>(PROCARE_REQUIRED_SEQUENCE);

export function isProCareCertificationType(certType: string): boolean {
  return (
    certType === PROCARE_CERTIFICATION_TYPE ||
    certType === LEGACY_PROCARE_CERTIFICATION_TYPE
  );
}

/**
 * A bare legacy "platform" type is ambiguous. The six known LMS modules and
 * their types are the positive evidence that the stored course is ProCare.
 */
export function isProCareCourseStructure(
  modules: CourseModuleEvidence[],
): boolean {
  const moduleTypes = new Map(
    modules.map((module) => [module.slug, module.moduleType]),
  );
  return [...EXPECTED_MODULE_TYPES].every(
    ([slug, moduleType]) => moduleTypes.get(slug) === moduleType,
  );
}

export function hasLegacyProCareProgressEvidence(
  progress: ProCareProgressEvidence[],
): boolean {
  return progress.some((row) => PROCARE_EVIDENCE_IDS.has(row.moduleId));
}

export function filterProCareProgress<T extends ProCareProgressEvidence>(
  progress: T[],
): T[] {
  return progress.filter((row) => PROCARE_EVIDENCE_IDS.has(row.moduleId));
}

/**
 * Builds the approved cumulative assessment from the existing question bank.
 * With 20 questions across three modules, the deterministic allocation is
 * 7 from Quiz 1, 7 from Quiz 2, and 6 from Quiz 3.
 */
export function selectProCareFinalAssessmentQuestions<
  T extends ProCareQuestionEvidence,
>(questions: T[]): T[] | null {
  const base = Math.floor(
    PROCARE_FINAL_QUESTION_COUNT / PROCARE_QUIZ_MODULE_IDS.length,
  );
  const remainder =
    PROCARE_FINAL_QUESTION_COUNT % PROCARE_QUIZ_MODULE_IDS.length;

  const selected: T[] = [];
  for (const [index, moduleSlug] of PROCARE_QUIZ_MODULE_IDS.entries()) {
    const limit = base + (index < remainder ? 1 : 0);
    const moduleQuestions = questions
      .filter((question) => question.moduleSlug === moduleSlug)
      .sort(
        (left, right) =>
          (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
          left.id.localeCompare(right.id),
      );
    if (moduleQuestions.length < limit) {
      return null;
    }
    selected.push(...moduleQuestions.slice(0, limit));
  }

  return selected;
}

export type AssessmentSubmissionValidation =
  | { ok: true }
  | {
      ok: false;
      missingQuestionIds: string[];
      unexpectedQuestionIds: string[];
    };

export function validateCompleteAssessmentSubmission(
  expectedQuestionIds: string[],
  answers: Record<string, string>,
): AssessmentSubmissionValidation {
  const expected = new Set(expectedQuestionIds);
  const submitted = new Set(Object.keys(answers));
  const missingQuestionIds = expectedQuestionIds.filter(
    (questionId) => !submitted.has(questionId) || !answers[questionId],
  );
  const unexpectedQuestionIds = [...submitted].filter(
    (questionId) => !expected.has(questionId),
  );

  return missingQuestionIds.length === 0 && unexpectedQuestionIds.length === 0
    ? { ok: true }
    : { ok: false, missingQuestionIds, unexpectedQuestionIds };
}

export function scoreAssessment(
  expectedQuestionIds: string[],
  answers: Record<string, string>,
  correctOptionByQuestion: Map<string, string>,
  passingScore = PROCARE_PASSING_SCORE,
) {
  let correct = 0;
  const correctAnswers: Record<string, string> = {};

  for (const questionId of expectedQuestionIds) {
    const correctOptionId = correctOptionByQuestion.get(questionId) ?? "";
    correctAnswers[questionId] = correctOptionId;
    if (correctOptionId && answers[questionId] === correctOptionId) {
      correct++;
    }
  }

  const total = expectedQuestionIds.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return {
    correct,
    total,
    score,
    passed: score >= passingScore,
    correctAnswers,
  };
}

export function getProCareAssessmentPrerequisites(
  assessmentId: string,
): string[] {
  const quizIndex = PROCARE_QUIZ_MODULE_IDS.indexOf(
    assessmentId as (typeof PROCARE_QUIZ_MODULE_IDS)[number],
  );
  if (quizIndex >= 0) {
    return [PROCARE_VIDEO_MODULE_IDS[quizIndex]];
  }
  if (assessmentId === PROCARE_FINAL_ASSESSMENT_ID) {
    return [...PROCARE_MODULE_SEQUENCE];
  }
  return [];
}

export function validateProCareCertificationProgress(
  progress: ProCareProgressEvidence[],
) {
  const byModule = new Map(progress.map((row) => [row.moduleId, row]));
  const missing: string[] = [];

  for (const moduleId of PROCARE_VIDEO_MODULE_IDS) {
    const row = byModule.get(moduleId);
    if (
      row?.status !== "completed" ||
      (row.videoWatchedPct ?? 0) < 100
    ) {
      missing.push(moduleId);
    }
  }

  for (const moduleId of [
    ...PROCARE_QUIZ_MODULE_IDS,
    PROCARE_FINAL_ASSESSMENT_ID,
  ]) {
    const row = byModule.get(moduleId);
    if (
      row?.status !== "completed" ||
      (row.score ?? 0) < PROCARE_PASSING_SCORE
    ) {
      missing.push(moduleId);
    }
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

export function buildAttemptHistoryModuleId(
  assessmentId: string,
  uniqueAttemptId: string,
): string {
  return `${assessmentId}::attempt::${uniqueAttemptId}`;
}