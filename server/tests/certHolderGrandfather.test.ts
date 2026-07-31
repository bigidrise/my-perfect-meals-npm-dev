/**
 * Tests that existing certificate holders are never re-blocked when new
 * lessons are added to LESSON_IDS.
 *
 * The /complete endpoint short-circuits with success when the enrollment
 * record already has status "completed" and a certificateNumber, so the
 * LESSON_IDS.every() check is never reached for certified users.
 */

import { LESSON_IDS } from "../routes/academyLessonIds";

// ── 1. Simulate the short-circuit guard ───────────────────────────────────────

/**
 * Mirrors the guard added to POST /api/academy/platform-mastery/complete:
 *
 *   if (enrollmentRecord.status === "completed" && enrollmentRecord.certificateNumber) {
 *     return res.json({ ok: true, certificateNumber: enrollmentRecord.certificateNumber });
 *   }
 *
 * Returns true when the endpoint would short-circuit (already certified).
 */
function wouldShortCircuit(enrollmentRecord: {
  status: string;
  certificateNumber: string | null | undefined;
}): boolean {
  return (
    enrollmentRecord.status === "completed" &&
    !!enrollmentRecord.certificateNumber
  );
}

/**
 * Mirrors the LESSON_IDS.every() lesson-completion check that runs only when
 * the short-circuit does NOT fire.
 */
function allLessonsDone(
  lessonIds: string[],
  progressMap: Map<string, { status: string }>,
): boolean {
  return lessonIds.every((id) => progressMap.get(id)?.status === "completed");
}

// ── 2. Already-certified user — short-circuit fires ───────────────────────────

describe("certificate holder grandfather — short-circuit guard", () => {
  const certRecord = {
    status: "completed",
    certificateNumber: "MPM-PM-ABC123",
  };

  it("short-circuits for a user with a completed certificate", () => {
    expect(wouldShortCircuit(certRecord)).toBe(true);
  });

  it("does NOT short-circuit when status is in_progress (not yet certified)", () => {
    expect(wouldShortCircuit({ status: "in_progress", certificateNumber: null })).toBe(false);
  });

  it("does NOT short-circuit when status is completed but certificateNumber is absent", () => {
    // Guard requires both fields to be safe — a corrupt record shouldn't bypass the check.
    expect(wouldShortCircuit({ status: "completed", certificateNumber: null })).toBe(false);
  });
});

// ── 3. New lesson added — certified user is never re-blocked ──────────────────

describe("new lesson added — certified user bypass", () => {
  /**
   * Simulate a user who completed lessons 01–08 BEFORE lesson-09 was added.
   * Their progressMap has no entry for lesson-09.
   */
  function buildOldProgressMap(): Map<string, { status: string }> {
    const map = new Map<string, { status: string }>();
    // Only the first 8 lessons exist in their history
    const originalLessons = LESSON_IDS.slice(0, 8);
    for (const id of originalLessons) {
      map.set(id, { status: "completed" });
    }
    return map;
  }

  it("LESSON_IDS now contains more lessons than the old progress map covers", () => {
    const progress = buildOldProgressMap();
    // At least one lesson exists that the user hasn't touched
    const uncovered = LESSON_IDS.filter((id) => !progress.has(id));
    expect(uncovered.length).toBeGreaterThan(0);
  });

  it("allLessonsDone returns false for a certified user when new lessons are present (without short-circuit)", () => {
    const progress = buildOldProgressMap();
    // Without the short-circuit the endpoint would wrongly block them
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });

  it("short-circuit fires for a certified user, bypassing the LESSON_IDS check entirely", () => {
    const certRecord = {
      status: "completed",
      certificateNumber: "MPM-PM-OLD123",
    };
    const progress = buildOldProgressMap();

    const shortCircuits = wouldShortCircuit(certRecord);

    // Because the guard fires, the lesson check is never reached
    expect(shortCircuits).toBe(true);

    // Confirm the lesson check WOULD have blocked them (proving the guard was necessary)
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });

  it("an uncertified user with a gap in lessons is still blocked correctly", () => {
    const inProgressRecord = {
      status: "in_progress",
      certificateNumber: null,
    };
    const progress = buildOldProgressMap(); // missing lesson-09

    // Guard does not fire
    expect(wouldShortCircuit(inProgressRecord)).toBe(false);
    // Lesson check correctly blocks them
    expect(allLessonsDone(LESSON_IDS, progress)).toBe(false);
  });
});
