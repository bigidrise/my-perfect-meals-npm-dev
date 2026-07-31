/**
 * Unit tests for the lesson-09 sequential-unlock gate in Certification Mode.
 *
 * The route handler for POST /api/academy/platform-mastery/lessons/:lessonId/read
 * (and the exercise + quiz routes) runs this check in cert mode:
 *
 *   const prereq = getPrerequisiteId(lessonId);
 *   if (prereq && progressMap.get(prereq)?.status !== "completed") {
 *     return res.status(403).json({ error: "Complete the previous lesson first" });
 *   }
 *
 * These tests verify that the gate data (LESSON_IDS position, getPrerequisiteId
 * return value) is correct for lesson-09, and that the gate condition used by
 * all three routes (read / exercise / quiz) evaluates to 403 when lesson-08 is
 * not yet completed.
 */

import { LESSON_IDS, getPrerequisiteId } from "../routes/academyLessonIds";
import { PLATFORM_MASTERY_LESSONS } from "@/data/platformMasteryLessons";

// ── 1. Lesson registry ────────────────────────────────────────────────────────

describe("LESSON_IDS registry", () => {
  it("includes lesson-09", () => {
    expect(LESSON_IDS).toContain("lesson-09");
  });

  it("includes lesson-08 immediately before lesson-09", () => {
    const idx08 = LESSON_IDS.indexOf("lesson-08");
    const idx09 = LESSON_IDS.indexOf("lesson-09");
    expect(idx08).toBeGreaterThanOrEqual(0);
    expect(idx09).toBe(idx08 + 1);
  });
});

// ── 2. getPrerequisiteId ──────────────────────────────────────────────────────

describe("getPrerequisiteId", () => {
  it("returns lesson-08 as the prerequisite for lesson-09", () => {
    expect(getPrerequisiteId("lesson-09")).toBe("lesson-08");
  });

  it("returns lesson-07 as the prerequisite for lesson-08 (adjacent check)", () => {
    expect(getPrerequisiteId("lesson-08")).toBe("lesson-07");
  });

  it("returns null for lesson-01 (no prerequisite)", () => {
    expect(getPrerequisiteId("lesson-01")).toBeNull();
  });

  it("returns null for an unknown lesson ID", () => {
    expect(getPrerequisiteId("lesson-99")).toBeNull();
  });
});

// ── 3. Gate condition — simulates the route handler logic ─────────────────────

/**
 * Mirrors the exact guard used in the read / exercise / quiz routes:
 *
 *   const prereq = getPrerequisiteId(lessonId);
 *   if (prereq && progressMap.get(prereq)?.status !== "completed") → 403
 */
function wouldBlock(
  lessonId: string,
  isCertificationTrack: boolean,
  progressMap: Map<string, { status: string }>,
): boolean {
  if (!isCertificationTrack) return false;
  const prereq = getPrerequisiteId(lessonId);
  if (!prereq) return false;
  return progressMap.get(prereq)?.status !== "completed";
}

describe("lesson-09 cert-mode gate (simulates route 403 logic)", () => {
  it("blocks lesson-09 when lesson-08 is not started", () => {
    const progress = new Map<string, { status: string }>();
    expect(wouldBlock("lesson-09", true, progress)).toBe(true);
  });

  it("blocks lesson-09 when lesson-08 is in_progress", () => {
    const progress = new Map([["lesson-08", { status: "in_progress" }]]);
    expect(wouldBlock("lesson-09", true, progress)).toBe(true);
  });

  it("blocks lesson-09 when lesson-08 has quiz_failed status", () => {
    const progress = new Map([["lesson-08", { status: "quiz_failed" }]]);
    expect(wouldBlock("lesson-09", true, progress)).toBe(true);
  });

  it("allows lesson-09 when lesson-08 is completed in cert mode", () => {
    const progress = new Map([["lesson-08", { status: "completed" }]]);
    expect(wouldBlock("lesson-09", true, progress)).toBe(false);
  });

  it("never blocks in learning mode (non-cert track), even without prior lesson", () => {
    const progress = new Map<string, { status: string }>();
    expect(wouldBlock("lesson-09", false, progress)).toBe(false);
  });

  it("never blocks lesson-01 in cert mode (no prerequisite exists)", () => {
    const progress = new Map<string, { status: string }>();
    expect(wouldBlock("lesson-01", true, progress)).toBe(false);
  });
});

// ── 4. Client/server lesson-order sync ───────────────────────────────────────
//
// PLATFORM_MASTERY_LESSONS (client) and LESSON_IDS (server) must stay in sync.
// If someone adds or reorders a lesson in one file but not the other, the client
// redirect and the server 403 will disagree — one will block, the other won't.

describe("client/server lesson order sync", () => {
  const clientIds = PLATFORM_MASTERY_LESSONS.map((l) => l.id);

  it("client lesson IDs match server LESSON_IDS exactly (same order)", () => {
    expect(clientIds).toEqual(LESSON_IDS);
  });

  it("every server LESSON_ID appears in the client data", () => {
    for (const id of LESSON_IDS) {
      expect(clientIds).toContain(id);
    }
  });

  it("every client lesson ID appears in server LESSON_IDS", () => {
    for (const id of clientIds) {
      expect(LESSON_IDS).toContain(id);
    }
  });
});
