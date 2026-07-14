/**
 * Unit tests for resolveScrollTarget()
 *
 * Verifies that the cert dashboard scroll-to-lesson effect targets the correct
 * DOM element (or no element) based on the parsed lesson number and the module
 * list returned by the API.
 *
 * This covers the live effect in PlatformCertDashboard.tsx which calls:
 *   const el = resolveScrollTarget(modules, targetLessonNum, moduleEls.current);
 *   if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
 */

import { resolveScrollTarget } from "@/lib/resolveScrollTarget";

type FakeEl = { id: string; scrollIntoView: jest.Mock };

function makeEl(id: string): FakeEl {
  return { id, scrollIntoView: jest.fn() };
}

const videoModule = (slug: string, sortOrder: number) => ({
  id: slug,
  slug,
  title: `Lesson ${sortOrder}`,
  description: "",
  moduleType: "video" as const,
  sortOrder,
  passingScorePct: 0,
  questionLimit: 0,
});

const quizModule = (slug: string, sortOrder: number) => ({
  id: slug,
  slug,
  title: `Quiz ${sortOrder}`,
  description: "",
  moduleType: "quiz" as const,
  sortOrder,
  passingScorePct: 80,
  questionLimit: 20,
});

describe("resolveScrollTarget — no-op cases", () => {
  it("returns null when targetLessonNum is null (no ?lesson= param)", () => {
    const modules = [videoModule("intro", 1), videoModule("basics", 2)];
    const map = new Map<string, FakeEl>([
      ["intro", makeEl("el-intro")],
      ["basics", makeEl("el-basics")],
    ]);
    expect(resolveScrollTarget(modules, null, map)).toBeNull();
  });

  it("returns null when the module list is empty (data not yet loaded)", () => {
    const map = new Map<string, FakeEl>([["intro", makeEl("el-intro")]]);
    expect(resolveScrollTarget([], 1, map)).toBeNull();
  });

  it("returns null when targetLessonNum exceeds the number of video modules", () => {
    const modules = [videoModule("intro", 1), videoModule("basics", 2)];
    const map = new Map<string, FakeEl>([
      ["intro", makeEl("el-intro")],
      ["basics", makeEl("el-basics")],
    ]);
    expect(resolveScrollTarget(modules, 3, map)).toBeNull();
  });

  it("returns null when the element is not yet in the ref map (not yet rendered)", () => {
    const modules = [videoModule("intro", 1)];
    const emptyMap = new Map<string, FakeEl>();
    expect(resolveScrollTarget(modules, 1, emptyMap)).toBeNull();
  });

  it("returns null when all modules are quizzes / assessments (no video modules)", () => {
    const modules = [quizModule("quiz-1", 1), quizModule("final", 2)];
    const map = new Map<string, FakeEl>([
      ["quiz-1", makeEl("el-quiz-1")],
      ["final", makeEl("el-final")],
    ]);
    expect(resolveScrollTarget(modules, 1, map)).toBeNull();
  });
});

describe("resolveScrollTarget — valid scroll target", () => {
  const modules = [
    videoModule("intro", 1),
    quizModule("quiz-1", 2),
    videoModule("basics", 3),
    quizModule("quiz-2", 4),
    videoModule("advanced", 5),
  ];

  let elIntro: FakeEl;
  let elBasics: FakeEl;
  let elAdvanced: FakeEl;
  let map: Map<string, FakeEl>;

  beforeEach(() => {
    elIntro = makeEl("el-intro");
    elBasics = makeEl("el-basics");
    elAdvanced = makeEl("el-advanced");
    map = new Map([
      ["intro", elIntro],
      ["quiz-1", makeEl("el-quiz-1")],
      ["basics", elBasics],
      ["quiz-2", makeEl("el-quiz-2")],
      ["advanced", elAdvanced],
    ]);
  });

  it("returns the element for lesson 1 (first video module)", () => {
    const el = resolveScrollTarget(modules, 1, map);
    expect(el).toBe(elIntro);
  });

  it("returns the element for lesson 2 (second video module, skipping the quiz between)", () => {
    const el = resolveScrollTarget(modules, 2, map);
    expect(el).toBe(elBasics);
  });

  it("returns the element for lesson 3 (last video module)", () => {
    const el = resolveScrollTarget(modules, 3, map);
    expect(el).toBe(elAdvanced);
  });

  it("the caller can then call scrollIntoView on the returned element", () => {
    const el = resolveScrollTarget(modules, 2, map)!;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });
});

describe("resolveScrollTarget — extra URL params do not affect resolution", () => {
  it("selects the correct element regardless of what other query params are present", () => {
    const modules = [videoModule("intro", 1), videoModule("deep-dive", 2)];
    const elDeepDive = makeEl("el-deep-dive");
    const map = new Map<string, FakeEl>([
      ["intro", makeEl("el-intro")],
      ["deep-dive", elDeepDive],
    ]);
    // Simulate a URL like ?utm_source=email&lesson=2&ref=newsletter
    // parseLessonParam strips the extras; we receive targetLessonNum=2 here.
    const el = resolveScrollTarget(modules, 2, map);
    expect(el).toBe(elDeepDive);
  });
});
