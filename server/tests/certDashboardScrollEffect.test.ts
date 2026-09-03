/**
 * End-to-end pipeline tests for the cert dashboard scroll-to-lesson effect.
 *
 * PlatformCertDashboard.tsx runs this logic inside a useEffect:
 *
 *   const targetLessonNum = parseLessonParam(window.location.search, total);
 *   ...
 *   const el = resolveScrollTarget(modules, targetLessonNum, moduleEls.current);
 *   if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
 *
 * These tests exercise that complete pipeline (URL string → parsed index →
 * element selection → scrollIntoView call), proving the correct element is
 * targeted (or that no element is targeted) for every URL variant the
 * component encounters.
 *
 * Testing the pipeline directly — rather than mounting the full component —
 * is intentional: `resolveScrollTarget` IS the effect's logic, extracted so
 * it can be verified without a browser environment.
 */

import { parseLessonParam } from "@/lib/parseLessonParam";
import { resolveScrollTarget } from "@/lib/resolveScrollTarget";

// ── Fixture helpers ────────────────────────────────────────────────────────

type FakeEl = { slug: string; scrollIntoView: jest.Mock };

function makeEl(slug: string): FakeEl {
  return { slug, scrollIntoView: jest.fn() };
}

function makeVideoModule(slug: string, sortOrder: number) {
  return {
    id: slug,
    slug,
    title: `Lesson ${sortOrder}`,
    description: "",
    moduleType: "video" as const,
    sortOrder,
    passingScorePct: 0,
    questionLimit: 0,
  };
}

function makeQuizModule(slug: string, sortOrder: number) {
  return {
    id: slug,
    slug,
    title: `Quiz ${sortOrder}`,
    description: "",
    moduleType: "quiz" as const,
    sortOrder,
    passingScorePct: 80,
    questionLimit: 20,
  };
}

/**
 * Simulates the full scroll effect pipeline used in PlatformCertDashboard:
 *   1. Parse ?lesson= from a URL search string
 *   2. Resolve the element to scroll to
 *   3. Call scrollIntoView on it (if found)
 *
 * Returns the element that received scrollIntoView (or null if no-op).
 */
function runScrollEffect(
  search: string,
  modules: ReturnType<typeof makeVideoModule | typeof makeQuizModule>[],
  elementMap: Map<string, FakeEl>,
): FakeEl | null {
  const videoModules = modules.filter((m) => m.moduleType === "video");
  const total = videoModules.length > 0 ? videoModules.length : undefined;
  const targetLessonNum = parseLessonParam(search, total);
  const el = resolveScrollTarget(modules, targetLessonNum, elementMap);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  return el;
}

// ── Shared fixture ────────────────────────────────────────────────────────

/**
 * Realistic course layout:
 *   sortOrder 1 → video  "intro"
 *   sortOrder 2 → quiz   "quiz-1"   (interleaved — not a lesson)
 *   sortOrder 3 → video  "core-concepts"
 *   sortOrder 4 → video  "advanced"
 *   sortOrder 5 → quiz   "final-assessment"
 *
 * So video lesson 1 = intro, lesson 2 = core-concepts, lesson 3 = advanced.
 */
const MODULES = [
  makeVideoModule("intro", 1),
  makeQuizModule("quiz-1", 2),
  makeVideoModule("core-concepts", 3),
  makeVideoModule("advanced", 4),
  makeQuizModule("final-assessment", 5),
];

let elIntro: FakeEl;
let elCoreConcepts: FakeEl;
let elAdvanced: FakeEl;
let elementMap: Map<string, FakeEl>;

beforeEach(() => {
  elIntro = makeEl("intro");
  elCoreConcepts = makeEl("core-concepts");
  elAdvanced = makeEl("advanced");
  elementMap = new Map<string, FakeEl>([
    ["intro", elIntro],
    ["quiz-1", makeEl("quiz-1")],
    ["core-concepts", elCoreConcepts],
    ["advanced", elAdvanced],
    ["final-assessment", makeEl("final-assessment")],
  ]);
});

// ── Valid deep-links ──────────────────────────────────────────────────────

describe("valid ?lesson= param — correct element receives scrollIntoView", () => {
  it("?lesson=1  →  first video module (intro)", () => {
    const el = runScrollEffect("?lesson=1", MODULES, elementMap);
    expect(el).toBe(elIntro);
    expect(elIntro.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(elCoreConcepts.scrollIntoView).not.toHaveBeenCalled();
    expect(elAdvanced.scrollIntoView).not.toHaveBeenCalled();
  });

  it("?lesson=2  →  second video module (core-concepts), skipping interleaved quiz", () => {
    const el = runScrollEffect("?lesson=2", MODULES, elementMap);
    expect(el).toBe(elCoreConcepts);
    expect(elCoreConcepts.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(elIntro.scrollIntoView).not.toHaveBeenCalled();
    expect(elAdvanced.scrollIntoView).not.toHaveBeenCalled();
  });

  it("?lesson=3  →  last video module (advanced)", () => {
    const el = runScrollEffect("?lesson=3", MODULES, elementMap);
    expect(el).toBe(elAdvanced);
    expect(elAdvanced.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(elIntro.scrollIntoView).not.toHaveBeenCalled();
    expect(elCoreConcepts.scrollIntoView).not.toHaveBeenCalled();
  });
});

// ── Extra URL params (the task's headline scenario) ───────────────────────

describe("?lesson= mixed with extra query params — scroll still targets the right element", () => {
  it("?lesson=2&utm_source=email  →  core-concepts (utm param ignored)", () => {
    const el = runScrollEffect("?lesson=2&utm_source=email", MODULES, elementMap);
    expect(el).toBe(elCoreConcepts);
    expect(elCoreConcepts.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("?utm_source=email&lesson=1&ref=newsletter  →  intro (sandwiched between extra params)", () => {
    const el = runScrollEffect("?utm_source=email&lesson=1&ref=newsletter", MODULES, elementMap);
    expect(el).toBe(elIntro);
    expect(elIntro.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("?tab=overview&lesson=3&campaign=summer  →  advanced (unrelated params stripped)", () => {
    const el = runScrollEffect("?tab=overview&lesson=3&campaign=summer", MODULES, elementMap);
    expect(el).toBe(elAdvanced);
    expect(elAdvanced.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("?lesson=2&utm_medium=push&utm_campaign=cert  →  only core-concepts is scrolled", () => {
    runScrollEffect("?lesson=2&utm_medium=push&utm_campaign=cert", MODULES, elementMap);
    expect(elCoreConcepts.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(elIntro.scrollIntoView).not.toHaveBeenCalled();
    expect(elAdvanced.scrollIntoView).not.toHaveBeenCalled();
  });
});

// ── No-op cases ───────────────────────────────────────────────────────────

describe("missing or invalid ?lesson= param — effect is a no-op (scrollIntoView never called)", () => {
  it("empty query string", () => {
    const el = runScrollEffect("", MODULES, elementMap);
    expect(el).toBeNull();
    for (const fakeEl of elementMap.values()) {
      expect(fakeEl.scrollIntoView).not.toHaveBeenCalled();
    }
  });

  it("?lesson= (no value)", () => {
    const el = runScrollEffect("?lesson=", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=abc (non-numeric)", () => {
    const el = runScrollEffect("?lesson=abc", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=0 (zero — below 1-based minimum)", () => {
    const el = runScrollEffect("?lesson=0", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=-1 (negative)", () => {
    const el = runScrollEffect("?lesson=-1", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=99 (exceeds total video module count)", () => {
    const el = runScrollEffect("?lesson=99", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=4 (off-by-one: one past the last video module)", () => {
    const el = runScrollEffect("?lesson=4", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("?lesson=2.5 (float string)", () => {
    const el = runScrollEffect("?lesson=2.5", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("no ?lesson= key at all (only other params)", () => {
    const el = runScrollEffect("?utm_source=email&ref=push", MODULES, elementMap);
    expect(el).toBeNull();
  });

  it("module list empty (data not yet loaded)", () => {
    const el = runScrollEffect("?lesson=1", [], elementMap);
    expect(el).toBeNull();
  });
});
