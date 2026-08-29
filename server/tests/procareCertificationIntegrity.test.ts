import {
  buildAttemptHistoryModuleId,
  filterProCareProgress,
  hasLegacyProCareProgressEvidence,
  isProCareCourseStructure,
  PROCARE_FINAL_ASSESSMENT_ID,
  PROCARE_MODULE_SEQUENCE,
  PROCARE_QUIZ_MODULE_IDS,
  PROCARE_VIDEO_MODULE_IDS,
  scoreAssessment,
  selectProCareFinalAssessmentQuestions,
  validateCompleteAssessmentSubmission,
  validateProCareCertificationProgress,
} from "../services/procareCertification";

const proCareModules = [
  { slug: "module-1", moduleType: "video" },
  { slug: "quiz-1", moduleType: "quiz" },
  { slug: "module-2", moduleType: "video" },
  { slug: "quiz-2", moduleType: "quiz" },
  { slug: "module-3", moduleType: "video" },
  { slug: "quiz-3", moduleType: "quiz" },
];

function completeProgress() {
  return [
    ...PROCARE_VIDEO_MODULE_IDS.map((moduleId) => ({
      moduleId,
      status: "completed",
      score: null,
      videoWatchedPct: 100,
    })),
    ...PROCARE_QUIZ_MODULE_IDS.map((moduleId) => ({
      moduleId,
      status: "completed",
      score: 80,
      videoWatchedPct: null,
    })),
    {
      moduleId: PROCARE_FINAL_ASSESSMENT_ID,
      status: "completed",
      score: 80,
      videoWatchedPct: null,
    },
  ];
}

describe("Phase 3 ProCare compatibility identity", () => {
  it("recognizes the existing six-step ProCare LMS structure", () => {
    expect(isProCareCourseStructure(proCareModules)).toBe(true);
  });

  it("does not treat historical Platform Mastery lesson structure as ProCare", () => {
    const academyModules = Array.from({ length: 9 }, (_, index) => ({
      slug: `lesson-${String(index + 1).padStart(2, "0")}`,
      moduleType: "lesson",
    }));
    expect(isProCareCourseStructure(academyModules)).toBe(false);
  });

  it("recognizes legacy ProCare user progress without mutating the source rows", () => {
    const source = [
      { moduleId: "lesson-01", status: "completed" },
      { moduleId: "module-1", status: "completed", videoWatchedPct: 100 },
      { moduleId: "quiz-1", status: "completed", score: 80 },
    ];
    const before = JSON.parse(JSON.stringify(source));
    const filtered = filterProCareProgress(source);

    expect(hasLegacyProCareProgressEvidence(source)).toBe(true);
    expect(filtered.map((row) => row.moduleId)).toEqual([
      "module-1",
      "quiz-1",
    ]);
    expect(source).toEqual(before);
  });

  it("does not recognize Academy-only progress as legacy ProCare evidence", () => {
    expect(
      hasLegacyProCareProgressEvidence([
        { moduleId: "lesson-01", status: "completed" },
        { moduleId: "lesson-09", status: "completed" },
      ]),
    ).toBe(false);
  });
});

describe("Phase 3 cumulative final assessment", () => {
  const bank = PROCARE_QUIZ_MODULE_IDS.flatMap((moduleSlug, moduleIndex) =>
    Array.from({ length: 10 }, (_, questionIndex) => ({
      id: `${moduleSlug}-q${questionIndex + 1}`,
      moduleSlug,
      sortOrder: moduleIndex * 10 + questionIndex,
    })),
  );

  it("draws 20 approved questions across all three modules", () => {
    const selected = selectProCareFinalAssessmentQuestions(bank);
    expect(selected).not.toBeNull();
    expect(selected).toHaveLength(20);
    expect(
      selected?.filter((question) => question.moduleSlug === "quiz-1"),
    ).toHaveLength(7);
    expect(
      selected?.filter((question) => question.moduleSlug === "quiz-2"),
    ).toHaveLength(7);
    expect(
      selected?.filter((question) => question.moduleSlug === "quiz-3"),
    ).toHaveLength(6);
  });

  it("stops when the approved bank cannot support the cumulative assessment", () => {
    expect(
      selectProCareFinalAssessmentQuestions(
        bank.filter((question) => question.moduleSlug !== "quiz-3"),
      ),
    ).toBeNull();
  });
});

describe("Phase 3 assessment integrity", () => {
  const questionIds = Array.from({ length: 10 }, (_, index) => `q-${index}`);
  const completeAnswers = Object.fromEntries(
    questionIds.map((questionId) => [questionId, `correct-${questionId}`]),
  );

  it("rejects incomplete and unexpected answer sets", () => {
    expect(
      validateCompleteAssessmentSubmission(questionIds, {
        ...completeAnswers,
        "q-9": "",
      }),
    ).toEqual({
      ok: false,
      missingQuestionIds: ["q-9"],
      unexpectedQuestionIds: [],
    });
    expect(
      validateCompleteAssessmentSubmission(questionIds, {
        ...completeAnswers,
        extra: "option",
      }),
    ).toEqual({
      ok: false,
      missingQuestionIds: [],
      unexpectedQuestionIds: ["extra"],
    });
  });

  it("accepts only the complete configured answer set", () => {
    expect(
      validateCompleteAssessmentSubmission(questionIds, completeAnswers),
    ).toEqual({ ok: true });
  });

  it("fails 79% and passes 80%", () => {
    const ids = Array.from({ length: 100 }, (_, index) => `q-${index}`);
    const correctMap = new Map(ids.map((id) => [id, `correct-${id}`]));
    const answers79 = Object.fromEntries(
      ids.map((id, index) => [
        id,
        index < 79 ? `correct-${id}` : `wrong-${id}`,
      ]),
    );
    const answers80 = {
      ...answers79,
      "q-79": "correct-q-79",
    };

    expect(scoreAssessment(ids, answers79, correctMap).passed).toBe(false);
    expect(scoreAssessment(ids, answers79, correctMap).score).toBe(79);
    expect(scoreAssessment(ids, answers80, correctMap).passed).toBe(true);
    expect(scoreAssessment(ids, answers80, correctMap).score).toBe(80);
  });
});

describe("Phase 3 certificate gate", () => {
  it("rejects partial course completion", () => {
    const result = validateProCareCertificationProgress([
      {
        moduleId: "module-1",
        status: "completed",
        videoWatchedPct: 100,
      },
    ]);
    expect(result.complete).toBe(false);
  });

  it("rejects three videos without passed quizzes", () => {
    const result = validateProCareCertificationProgress(
      completeProgress().filter(
        (row) =>
          !(PROCARE_QUIZ_MODULE_IDS as readonly string[]).includes(
            row.moduleId,
          ) && row.moduleId !== PROCARE_FINAL_ASSESSMENT_ID,
      ),
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(PROCARE_QUIZ_MODULE_IDS));
  });

  it("rejects passed quizzes without required videos", () => {
    const result = validateProCareCertificationProgress(
      completeProgress().filter(
        (row) =>
          !(PROCARE_VIDEO_MODULE_IDS as readonly string[]).includes(
            row.moduleId,
          ),
      ),
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(PROCARE_VIDEO_MODULE_IDS));
  });

  it("requires the final assessment", () => {
    const result = validateProCareCertificationProgress(
      completeProgress().filter(
        (row) => row.moduleId !== PROCARE_FINAL_ASSESSMENT_ID,
      ),
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toContain(PROCARE_FINAL_ASSESSMENT_ID);
  });

  it("requires every video and assessment at the passing boundary", () => {
    expect(validateProCareCertificationProgress(completeProgress())).toEqual({
      complete: true,
      missing: [],
    });

    const failed = completeProgress().map((row) =>
      row.moduleId === "quiz-2" ? { ...row, score: 79 } : row,
    );
    expect(validateProCareCertificationProgress(failed)).toEqual({
      complete: false,
      missing: ["quiz-2"],
    });
  });
});

describe("Phase 3 attempt history identity", () => {
  it("keeps failed and successful retakes as distinct append-only rows", () => {
    const failedAttempt = buildAttemptHistoryModuleId("quiz-1", "failed-id");
    const passedAttempt = buildAttemptHistoryModuleId("quiz-1", "passed-id");

    expect(failedAttempt).toBe("quiz-1::attempt::failed-id");
    expect(passedAttempt).toBe("quiz-1::attempt::passed-id");
    expect(failedAttempt).not.toBe(passedAttempt);
    expect(PROCARE_MODULE_SEQUENCE).not.toContain(failedAttempt as any);
  });

  it("does not overlap immutable history IDs with configured assessment IDs", () => {
    for (const assessmentId of [
      ...PROCARE_QUIZ_MODULE_IDS,
      PROCARE_FINAL_ASSESSMENT_ID,
    ]) {
      const historyId = buildAttemptHistoryModuleId(
        assessmentId,
        "immutable-id",
      );
      expect([
        ...PROCARE_QUIZ_MODULE_IDS,
        PROCARE_FINAL_ASSESSMENT_ID,
      ]).not.toContain(historyId);
    }
  });
});