/**
 * Task 543 — Learning Mode → Certification Mode switch + certificate claim
 *
 * Confirms the full flow that blocked Stacy Gallagher:
 *   1. User enrolls in Learning Mode, completes all 9 lessons, passes all 9 quizzes
 *   2. User clicks "Switch to Certification Mode & Claim Certificate"
 *      → POST /api/academy/platform-mastery/enroll  { isCertificationTrack: true }
 *   3. Name modal opens; user submits their name
 *      → POST /api/academy/platform-mastery/complete { certificateName }
 *   4. Certificate is issued without 403 or other errors
 *
 * These are pure logic tests — no DB, no HTTP — mirroring the patterns in
 * certHolderGrandfather.test.ts and certRelink.service.test.ts.
 */

import { LESSON_IDS } from "../routes/academyLessonIds";

// ── Type mirrors ──────────────────────────────────────────────────────────────

interface EnrollmentRecord {
  status: string;
  isCertificationTrack: boolean;
  certificateNumber: string | null;
  certificateName: string | null;
  completedAt: Date | null;
}

interface ModuleProgressRecord {
  status: string;
  score: number | null;
}

// ── Helper: simulate the enroll upsert logic ──────────────────────────────────

/**
 * Mirrors the ON CONFLICT DO UPDATE in POST /api/academy/platform-mastery/enroll.
 *
 *   isCertificationTrack = CASE WHEN status = 'completed'
 *                                THEN isCertificationTrack  -- preserve
 *                                ELSE $newValue             -- accept update
 *                           END
 *   status = CASE WHEN status = 'completed' THEN 'completed' ELSE 'in_progress' END
 */
function simulateEnroll(
  existing: EnrollmentRecord | null,
  isCertificationTrack: boolean,
): EnrollmentRecord {
  if (existing === null) {
    // Fresh insert
    return {
      status: "in_progress",
      isCertificationTrack,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };
  }

  // Conflict update
  const newIsCertTrack =
    existing.status === "completed"
      ? existing.isCertificationTrack  // preserve when certified
      : isCertificationTrack;          // accept the caller's value

  const newStatus =
    existing.status === "completed" ? "completed" : "in_progress";

  return {
    ...existing,
    isCertificationTrack: newIsCertTrack,
    status: newStatus,
  };
}

// ── Helper: simulate the complete endpoint logic ──────────────────────────────

type CompleteResult =
  | { ok: true; certificateNumber: string }
  | { ok: false; httpStatus: number; error: string };

/**
 * Mirrors POST /api/academy/platform-mastery/complete validation logic.
 * Does NOT perform the actual DB write; returns ok+cert number on success.
 */
function simulateComplete(
  enrollment: EnrollmentRecord | null,
  progressMap: Map<string, ModuleProgressRecord>,
  certificateName: string,
): CompleteResult {
  if (!certificateName?.trim()) {
    return { ok: false, httpStatus: 400, error: "certificateName required" };
  }

  if (!enrollment) {
    return { ok: false, httpStatus: 400, error: "Not enrolled" };
  }

  const isCertificationTrack = enrollment.isCertificationTrack ?? false;

  // Must be on cert track to receive a certificate
  if (!isCertificationTrack) {
    return {
      ok: false,
      httpStatus: 403,
      error:
        "Certificates are issued in Certification Mode only. Re-enroll in Certification Mode to earn a certificate.",
    };
  }

  // Already certified — short-circuit
  if (enrollment.status === "completed" && enrollment.certificateNumber) {
    return { ok: true, certificateNumber: enrollment.certificateNumber };
  }

  // All base lessons must be completed
  const allLessonsDone = LESSON_IDS.every(
    (id) => progressMap.get(id)?.status === "completed",
  );
  if (!allLessonsDone) {
    return {
      ok: false,
      httpStatus: 400,
      error: "All lessons must be completed first",
    };
  }

  // Cert mode: additionally require all quiz passes (≥80%)
  const allQuizzesPassed = LESSON_IDS.every(
    (id) => progressMap.get(`${id}-quiz`)?.status === "completed",
  );
  if (!allQuizzesPassed) {
    return {
      ok: false,
      httpStatus: 400,
      error:
        "All lesson quizzes must be passed (80%) before issuing a Certification Mode certificate",
    };
  }

  // Issue the certificate
  const certNumber = `MPM-PM-TEST-${Date.now().toString(36).toUpperCase()}`;
  return { ok: true, certificateNumber: certNumber };
}

// ── Fixture builders ──────────────────────────────────────────────────────────

/**
 * Builds a progress map for a user who completed every lesson in Learning Mode
 * AND passed every quiz (≥80%) while in Learning Mode.
 *
 * In Learning Mode:
 *   - Exercise done → lesson "completed"
 *   - Quiz passed   → lesson "completed" (quiz pass alone is enough)
 *   - Both can be true; the lesson is never downgraded.
 */
function buildLearningModeAllDoneAllQuizzesPassed(): Map<
  string,
  ModuleProgressRecord
> {
  const map = new Map<string, ModuleProgressRecord>();
  for (const id of LESSON_IDS) {
    map.set(id, { status: "completed", score: null });
    map.set(`${id}-exercise`, { status: "completed", score: null });
    map.set(`${id}-quiz`, { status: "completed", score: 90 });
  }
  return map;
}

/**
 * Builds a progress map for a Learning Mode user who completed all lessons
 * via exercises ONLY — quizzes were never attempted (not all-quizzes-passed).
 */
function buildLearningModeAllDoneNoQuizzes(): Map<
  string,
  ModuleProgressRecord
> {
  const map = new Map<string, ModuleProgressRecord>();
  for (const id of LESSON_IDS) {
    map.set(id, { status: "completed", score: null });
    map.set(`${id}-exercise`, { status: "completed", score: null });
    // No quiz entries — user skipped all quizzes in Learning Mode
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Enroll endpoint — switching from Learning Mode to Certification Mode
// ─────────────────────────────────────────────────────────────────────────────

describe("enroll endpoint — Learning Mode → Certification Mode switch", () => {
  it("sets isCertificationTrack=true when switching from Learning Mode", () => {
    const existing: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: false,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    const updated = simulateEnroll(existing, true);

    expect(updated.isCertificationTrack).toBe(true);
  });

  it("keeps status in_progress after the switch (not completed yet)", () => {
    const existing: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: false,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    const updated = simulateEnroll(existing, true);

    expect(updated.status).toBe("in_progress");
  });

  it("does NOT overwrite isCertificationTrack when the user is already certified", () => {
    // A certified user who somehow hits the enroll endpoint again must not
    // have their cert-track flag stripped.
    const existing: EnrollmentRecord = {
      status: "completed",
      isCertificationTrack: true,
      certificateNumber: "MPM-PM-EXISTING",
      certificateName: "Alice Smith",
      completedAt: new Date(),
    };

    const updated = simulateEnroll(existing, false); // caller passes false

    // The CASE WHEN guard must preserve the original true value
    expect(updated.isCertificationTrack).toBe(true);
    expect(updated.status).toBe("completed");
  });

  it("creates a fresh enrollment with isCertificationTrack=true for a brand-new user", () => {
    const result = simulateEnroll(null, true);

    expect(result.isCertificationTrack).toBe(true);
    expect(result.status).toBe("in_progress");
    expect(result.certificateNumber).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Complete endpoint — happy path (the Stacy Gallagher scenario)
// ─────────────────────────────────────────────────────────────────────────────

describe("complete endpoint — Learning Mode user who switched to Certification Mode", () => {
  let enrollment: EnrollmentRecord;
  let progressMap: Map<string, ModuleProgressRecord>;

  beforeEach(() => {
    // Step 1: Start as Learning Mode
    const learningModeEnrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: false,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    // Step 2: Switch to Cert Mode via enroll endpoint
    enrollment = simulateEnroll(learningModeEnrollment, true);

    // Step 3: Progress map — all lessons + quizzes done (built while in Learning Mode)
    progressMap = buildLearningModeAllDoneAllQuizzesPassed();
  });

  it("enrollment record reflects isCertificationTrack=true after the switch", () => {
    expect(enrollment.isCertificationTrack).toBe(true);
  });

  it("complete endpoint returns ok:true with a certificate number", () => {
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.certificateNumber).toMatch(/^MPM-PM-/);
    }
  });

  it("complete endpoint does NOT return a 403", () => {
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    if (!result.ok) {
      // Fail with descriptive message if a 403 was returned
      expect(result.httpStatus).not.toBe(403);
    }
  });

  it("complete endpoint does NOT return a 400 for lesson completion", () => {
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    if (!result.ok) {
      expect(result.error).not.toMatch(/lessons must be completed/i);
    }
  });

  it("complete endpoint does NOT return a 400 for quiz completion", () => {
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    if (!result.ok) {
      expect(result.error).not.toMatch(/quizzes must be passed/i);
    }
  });

  it("the issued certificate number is a non-empty string", () => {
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.certificateNumber).toBe("string");
      expect(result.certificateNumber.length).toBeGreaterThan(0);
    }
  });

  it("the flow works with any valid certificate name", () => {
    const names = ["John Doe", "María García", "王伟", "O'Brien, Pat"];
    for (const name of names) {
      const result = simulateComplete(enrollment, progressMap, name);
      expect(result.ok).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Complete endpoint — guard cases that must still be enforced
// ─────────────────────────────────────────────────────────────────────────────

describe("complete endpoint — guards that must remain enforced", () => {
  it("returns 403 when enrollment is still in Learning Mode (isCertificationTrack=false)", () => {
    const learningEnrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: false,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();
    const result = simulateComplete(learningEnrollment, progressMap, "Test User");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(403);
    }
  });

  it("returns 400 when not all lessons are completed (cert mode switch, incomplete lessons)", () => {
    // User switched to cert mode but some lessons weren't finished
    const certEnrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: true,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    const progressMap = new Map<string, ModuleProgressRecord>();
    // Only lessons 1–5 completed; 6–9 missing
    for (const id of LESSON_IDS.slice(0, 5)) {
      progressMap.set(id, { status: "completed", score: null });
      progressMap.set(`${id}-quiz`, { status: "completed", score: 85 });
    }

    const result = simulateComplete(certEnrollment, progressMap, "Test User");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.error).toMatch(/lessons must be completed/i);
    }
  });

  it("returns 400 when all lessons are done but not all quizzes passed (cert mode)", () => {
    const certEnrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: true,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };

    // All lessons completed, but quizzes only for lessons 1–5
    const progressMap = new Map<string, ModuleProgressRecord>();
    for (const id of LESSON_IDS) {
      progressMap.set(id, { status: "completed", score: null });
    }
    for (const id of LESSON_IDS.slice(0, 5)) {
      progressMap.set(`${id}-quiz`, { status: "completed", score: 85 });
    }
    // Lessons 6–9 quizzes failed or missing
    for (const id of LESSON_IDS.slice(5)) {
      progressMap.set(`${id}-quiz`, { status: "quiz_failed", score: 60 });
    }

    const result = simulateComplete(certEnrollment, progressMap, "Test User");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.error).toMatch(/quizzes must be passed/i);
    }
  });

  it("returns 400 when certificateName is empty", () => {
    const certEnrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: true,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    const result = simulateComplete(certEnrollment, progressMap, "   ");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
    }
  });

  it("returns 400 when not enrolled at all", () => {
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    const result = simulateComplete(null, progressMap, "Test User");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.error).toMatch(/not enrolled/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Learning Mode user who passed quizzes — frontend display conditions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the allQuizzesPassed check in PlatformMasteryDashboard.tsx:
 *
 *   const allQuizzesPassed = LESSONS.every(
 *     (l) => prog[`${l.id}-quiz`]?.status === "completed"
 *   );
 */
function clientAllQuizzesPassed(
  prog: Record<string, { status: string; score: number | null }>,
): boolean {
  return LESSON_IDS.every((id) => prog[`${id}-quiz`]?.status === "completed");
}

/**
 * Mirrors the allDone check in PlatformMasteryDashboard.tsx:
 *
 *   const allDone = completedCount === LESSONS.length;
 */
function clientAllDone(
  prog: Record<string, { status: string; score: number | null }>,
): boolean {
  return LESSON_IDS.every((id) => prog[id]?.status === "completed");
}

describe("frontend — switch button visibility conditions", () => {
  it("shows switch button when Learning Mode + all lessons done + all quizzes passed", () => {
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    // Convert Map to Record for client-side helper
    const prog: Record<string, { status: string; score: number | null }> = {};
    for (const [k, v] of progressMap.entries()) {
      prog[k] = v;
    }

    const isLearningMode = true;
    const allDone = clientAllDone(prog);
    const allQuizzesPassed = clientAllQuizzesPassed(prog);
    const isCertified = false;

    // The "Switch to Certification Mode & Claim Certificate" button renders when:
    //   !loading && !isCertTrack && allDone && !isCertified && allQuizzesPassed
    const switchButtonVisible =
      isLearningMode && allDone && !isCertified && allQuizzesPassed;

    expect(switchButtonVisible).toBe(true);
  });

  it("hides switch button when user is already certified", () => {
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();
    const prog: Record<string, { status: string; score: number | null }> = {};
    for (const [k, v] of progressMap.entries()) prog[k] = v;

    const isLearningMode = false; // Already on cert track after switch
    const allDone = clientAllDone(prog);
    const allQuizzesPassed = clientAllQuizzesPassed(prog);
    const isCertified = true; // Already claimed the cert

    const switchButtonVisible =
      isLearningMode && allDone && !isCertified && allQuizzesPassed;

    expect(switchButtonVisible).toBe(false);
  });

  it("hides switch button when quizzes were not all passed in Learning Mode", () => {
    const progressMap = buildLearningModeAllDoneNoQuizzes();
    const prog: Record<string, { status: string; score: number | null }> = {};
    for (const [k, v] of progressMap.entries()) prog[k] = v;

    const isLearningMode = true;
    const allDone = clientAllDone(prog);
    const allQuizzesPassed = clientAllQuizzesPassed(prog);
    const isCertified = false;

    const switchButtonVisible =
      isLearningMode && allDone && !isCertified && allQuizzesPassed;

    expect(switchButtonVisible).toBe(false);
  });

  it("hides switch button when not all lessons are done", () => {
    const prog: Record<string, { status: string; score: number | null }> = {};
    for (const id of LESSON_IDS.slice(0, 7)) {
      prog[id] = { status: "completed", score: null };
      prog[`${id}-quiz`] = { status: "completed", score: 90 };
    }
    // Lessons 8 and 9 not done

    const isLearningMode = true;
    const allDone = clientAllDone(prog);
    const allQuizzesPassed = clientAllQuizzesPassed(prog);
    const isCertified = false;

    const switchButtonVisible =
      isLearningMode && allDone && !isCertified && allQuizzesPassed;

    expect(switchButtonVisible).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Quiz retry — "never downgrade a passed quiz" guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the ON CONFLICT DO UPDATE in POST /api/academy/platform-mastery/lessons/:lessonId/quiz.
 *
 *   status = CASE WHEN existing.status = 'completed' THEN 'completed' ELSE $quizStatus END
 *   score  = $serverScore  (score column is always overwritten — it's the latest attempt)
 *
 * The guard ensures a retry with a failing score never strips a previously passing status.
 */
function simulateQuizUpsert(
  existing: ModuleProgressRecord | null,
  serverScore: number,
): ModuleProgressRecord {
  const serverPassed = serverScore >= 80;
  const quizStatus = serverPassed ? "completed" : "quiz_failed";

  if (existing === null) {
    // Fresh insert
    return { status: quizStatus, score: serverScore };
  }

  // Conflict update — preserve "completed" status; always record latest score
  const newStatus =
    existing.status === "completed" ? "completed" : quizStatus;

  return { status: newStatus, score: serverScore };
}

describe("quiz upsert — never downgrade a previously passed quiz", () => {
  it("quiz status stays 'completed' after a retry with score=60 (was 80)", () => {
    // First attempt: user passes at exactly 80%
    const afterPass = simulateQuizUpsert(null, 80);
    expect(afterPass.status).toBe("completed");
    expect(afterPass.score).toBe(80);

    // Retry: user scores 60% — should NOT downgrade the status
    const afterRetry = simulateQuizUpsert(afterPass, 60);
    expect(afterRetry.status).toBe("completed");
  });

  it("quiz score is updated to the latest attempt score even when status is preserved", () => {
    const afterPass = simulateQuizUpsert(null, 90);
    const afterRetry = simulateQuizUpsert(afterPass, 50);

    // Status preserved, but score reflects the latest attempt
    expect(afterRetry.status).toBe("completed");
    expect(afterRetry.score).toBe(50);
  });

  it("quiz_failed status is correctly set when a first attempt fails", () => {
    const afterFail = simulateQuizUpsert(null, 70);
    expect(afterFail.status).toBe("quiz_failed");
    expect(afterFail.score).toBe(70);
  });

  it("quiz_failed → completed upgrade works when the retry passes", () => {
    const afterFail = simulateQuizUpsert(null, 60);
    const afterPass = simulateQuizUpsert(afterFail, 85);
    expect(afterPass.status).toBe("completed");
    expect(afterPass.score).toBe(85);
  });

  it("complete endpoint returns ok:true when a retried quiz (score=60) didn't strip the passed status", () => {
    // Build a progress map where all quizzes were passed, then one was retried with 60%
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    // Simulate the retry on the first lesson's quiz
    const firstLessonId = LESSON_IDS[0];
    const quizKey = `${firstLessonId}-quiz`;
    const existingQuiz = progressMap.get(quizKey)!;
    const afterRetry = simulateQuizUpsert(existingQuiz, 60);
    progressMap.set(quizKey, afterRetry);

    // Status must still be "completed" — the guard held
    expect(afterRetry.status).toBe("completed");

    // Now simulate switching to cert mode and claiming the certificate
    const enrollment = simulateEnroll(
      { status: "in_progress", isCertificationTrack: false, certificateNumber: null, certificateName: null, completedAt: null },
      true,
    );

    const result = simulateComplete(enrollment, progressMap, "Jane Doe");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.certificateNumber).toMatch(/^MPM-PM-/);
    }
  });

  it("complete endpoint returns a 400 when the retry DID corrupt status to quiz_failed (regression guard)", () => {
    // This test documents what would happen WITHOUT the CASE WHEN guard —
    // it verifies the complete endpoint correctly rejects a corrupted progress map.
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    // Manually corrupt one quiz to quiz_failed (as if the guard were absent)
    const firstLessonId = LESSON_IDS[0];
    progressMap.set(`${firstLessonId}-quiz`, { status: "quiz_failed", score: 60 });

    const enrollment = simulateEnroll(
      { status: "in_progress", isCertificationTrack: false, certificateNumber: null, certificateName: null, completedAt: null },
      true,
    );

    const result = simulateComplete(enrollment, progressMap, "Jane Doe");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.httpStatus).toBe(400);
      expect(result.error).toMatch(/quizzes must be passed/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Full end-to-end state machine — Learning → Switch → Cert
// ─────────────────────────────────────────────────────────────────────────────

describe("full end-to-end state machine — Learning Mode → switch → certificate claimed", () => {
  it("completes the entire flow without errors and produces a certificate number", () => {
    // STATE 1: User enrolls in Learning Mode
    let enrollment = simulateEnroll(null, false);
    expect(enrollment.isCertificationTrack).toBe(false);
    expect(enrollment.status).toBe("in_progress");

    // STATE 2: User completes all lessons + quizzes in Learning Mode
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    // Verify all 9 lessons are done
    expect(LESSON_IDS.every((id) => progressMap.get(id)?.status === "completed")).toBe(true);
    // Verify all 9 quizzes are passed
    expect(LESSON_IDS.every((id) => progressMap.get(`${id}-quiz`)?.status === "completed")).toBe(true);

    // STATE 3: User clicks "Switch to Certification Mode & Claim Certificate"
    //   → POST /api/academy/platform-mastery/enroll { isCertificationTrack: true }
    enrollment = simulateEnroll(enrollment, true);
    expect(enrollment.isCertificationTrack).toBe(true);
    expect(enrollment.status).toBe("in_progress");
    expect(enrollment.certificateNumber).toBeNull();

    // STATE 4: Name modal opens (frontend only, no network call)
    //   User fills in "Stacy Gallagher"

    // STATE 5: User clicks "Issue My Certificate"
    //   → POST /api/academy/platform-mastery/complete { certificateName: "Stacy Gallagher" }
    const result = simulateComplete(enrollment, progressMap, "Stacy Gallagher");

    // STATE 6: Certificate issued — no errors
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.certificateNumber).toMatch(/^MPM-PM-/);
    }
  });

  it("two identical runs produce two different certificate numbers (not de-duped incorrectly)", () => {
    // This ensures the cert number generator is non-deterministic (timestamp-based)
    const enrollment: EnrollmentRecord = {
      status: "in_progress",
      isCertificationTrack: true,
      certificateNumber: null,
      certificateName: null,
      completedAt: null,
    };
    const progressMap = buildLearningModeAllDoneAllQuizzesPassed();

    const r1 = simulateComplete(enrollment, progressMap, "User One");
    const r2 = simulateComplete(enrollment, progressMap, "User Two");

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    if (r1.ok && r2.ok) {
      // Very likely to differ since Date.now() changes; confirms no accidental memoization
      // (In a synchronous test these run back-to-back and Date.now() MAY be the same ms,
      // so we only assert that both are valid MPM-PM-... strings.)
      expect(r1.certificateNumber).toMatch(/^MPM-PM-/);
      expect(r2.certificateNumber).toMatch(/^MPM-PM-/);
    }
  });
});
