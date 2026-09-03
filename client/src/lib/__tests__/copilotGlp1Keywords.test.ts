/**
 * copilotGlp1Keywords.test.ts
 *
 * Confirms that the GLP-1 Copilot keyword block routes voice queries to
 * /glp1-hub and that the hub's spokenText describes the platform-wide overlay.
 *
 * Regression guard for Task 810 which added overlay-related keywords.
 * A future keyword-map refactor that silently breaks routing will fail here.
 *
 * ── KEYWORD SNAPSHOT ────────────────────────────────────────────────────────
 * GLP1_KEYWORDS_SNAPSHOT below mirrors the keywords[] array in the "GLP-1 Hub"
 * entry of KEYWORD_FEATURE_MAP (KeywordFeatureMap.ts).
 *
 * If you add, remove, or rename a keyword in KeywordFeatureMap.ts you MUST
 * update GLP1_KEYWORDS_SNAPSHOT here to match, otherwise the
 * "GLP-1 keyword snapshot" suite will fail.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { findFeatureFromKeywords, KEYWORD_FEATURE_MAP } from "@/components/copilot/KeywordFeatureMap";
import { PAGE_EXPLANATIONS } from "@/components/copilot/CopilotPageExplanations";

// ── 1. Keyword → path routing ─────────────────────────────────────────────────

describe("GLP-1 KeywordFeatureMap routing", () => {
  const GLP1_PATH = "/glp1-hub";

  /**
   * These are the keywords added/updated in Task 810 that we must protect.
   * Each one represents a realistic voice query a user might say.
   */
  const newOverlayKeywords = [
    "glp-1 support",
    "glp-1 overlay",
    "glp-1 platform",
    "metabolic medication support",
    "how does glp work",
    "glp-1 how it works",
    "glp platform wide",
    "glp everywhere",
    "glp-1 across app",
    "glp-1 baseline",
    "glp-1 and performance",
  ];

  test.each(newOverlayKeywords)(
    'keyword "%s" resolves to /glp1-hub',
    (keyword) => {
      const result = findFeatureFromKeywords(keyword);
      expect(result).not.toBeNull();
      expect(result!.path).toBe(GLP1_PATH);
    },
  );

  /** Older core keywords must still resolve to the same path */
  const coreKeywords = [
    "glp-1",
    "glp one",
    "ozempic",
    "wegovy",
    "semaglutide",
    "glp hub",
  ];

  test.each(coreKeywords)(
    'core keyword "%s" still resolves to /glp1-hub',
    (keyword) => {
      const result = findFeatureFromKeywords(keyword);
      expect(result).not.toBeNull();
      expect(result!.path).toBe(GLP1_PATH);
    },
  );

  test("voice query 'how does glp-1 support work' resolves to /glp1-hub", () => {
    const result = findFeatureFromKeywords("how does glp-1 support work");
    expect(result).not.toBeNull();
    expect(result!.path).toBe(GLP1_PATH);
  });

  test("voice query 'glp-1 platform' resolves to /glp1-hub", () => {
    const result = findFeatureFromKeywords("tell me about the glp-1 platform");
    expect(result).not.toBeNull();
    expect(result!.path).toBe(GLP1_PATH);
  });
});

// ── 2. /glp1-hub spokenText covers platform-wide overlay surfaces ─────────────

describe("GLP-1 hub page explanation overlay coverage", () => {
  const explanation = PAGE_EXPLANATIONS["/glp1-hub"];

  test("/glp1-hub explanation entry exists", () => {
    expect(explanation).toBeDefined();
  });

  test("spokenText is non-empty", () => {
    expect(explanation.spokenText.length).toBeGreaterThan(100);
  });

  /**
   * Each of these surfaces should be explicitly mentioned in the spoken
   * explanation so users understand which parts of the app carry their
   * GLP-1 intelligence automatically.
   */
  const requiredSurfaces = [
    "Meal Creation",
    "Craving Creator",
    "Fridge Rescue",
    "Restaurant Guide",
    "Grocery Coach",
    "Find Meals Near Me",
  ];

  test.each(requiredSurfaces)(
    'spokenText mentions overlay surface "%s"',
    (surface) => {
      expect(explanation.spokenText).toContain(surface);
    },
  );

  test("spokenText explains that GLP-1 intelligence travels across the platform", () => {
    const text = explanation.spokenText.toLowerCase();
    // Should describe the cross-surface propagation concept
    const describesOverlay =
      text.includes("carries that intelligence") ||
      text.includes("across multiple food surfaces") ||
      text.includes("cross-surface") ||
      text.includes("throughout");
    expect(describesOverlay).toBe(true);
  });

  test("spokenText explains GLP-1 relationship with Macro Calculator baseline", () => {
    const text = explanation.spokenText.toLowerCase();
    const describesBaseline =
      text.includes("macro calculator") && text.includes("baseline");
    expect(describesBaseline).toBe(true);
  });

  test("spokenText explains GLP-1 and Performance Nutrition coexistence", () => {
    const text = explanation.spokenText.toLowerCase();
    const describesPerformance =
      text.includes("performance nutrition") ||
      text.includes("performance");
    expect(describesPerformance).toBe(true);
  });
});

// ── 3. walkthroughId sanity check ────────────────────────────────────────────

describe("GLP-1 KeywordFeatureMap entry integrity", () => {
  test("glp1-hub mapping has correct walkthroughId", () => {
    const result = findFeatureFromKeywords("glp-1");
    expect(result).not.toBeNull();
    expect(result!.walkthroughId).toBe("glp1-hub");
  });
});

// ── 4. Keyword snapshot — MUST be kept in sync with KeywordFeatureMap.ts ─────
//
// This is the structural enforcement gate described in the file header.
// When you change the GLP-1 Hub keywords[] in KeywordFeatureMap.ts you MUST
// update GLP1_KEYWORDS_SNAPSHOT below to match, or this suite will fail.

/**
 * Exact mirror of the keywords[] array in the "GLP-1 Hub" KEYWORD_FEATURE_MAP
 * entry.  Sorted alphabetically so diff output is human-readable.
 */
const GLP1_KEYWORDS_SNAPSHOT: readonly string[] = [
  "g l p one",
  "glp",
  "glp hub",
  "glp one",
  "glp platform wide",
  "glp everywhere",
  "glp-1",
  "glp-1 across app",
  "glp-1 and performance",
  "glp-1 baseline",
  "glp-1 how it works",
  "glp-1 hub",
  "glp-1 overlay",
  "glp-1 platform",
  "glp-1 support",
  "how does glp work",
  "injection",
  "metabolic medication support",
  "ozempic",
  "semaglutide",
  "wegovy",
  "weight loss meds",
];

describe("GLP-1 keyword snapshot", () => {
  /** Pull the live entry straight from the map so there is no indirection. */
  const glp1Entry = KEYWORD_FEATURE_MAP.find(
    (m) => m.walkthroughId === "glp1-hub",
  );

  test("GLP-1 hub entry exists in KEYWORD_FEATURE_MAP", () => {
    expect(glp1Entry).toBeDefined();
  });

  test("keyword count matches snapshot — add/remove requires updating GLP1_KEYWORDS_SNAPSHOT", () => {
    const liveKeywords = [...(glp1Entry?.keywords ?? [])].sort();
    expect(liveKeywords.length).toBe(GLP1_KEYWORDS_SNAPSHOT.length);
  });

  test("exact keyword set matches snapshot — no silent additions or removals", () => {
    const liveKeywords = [...(glp1Entry?.keywords ?? [])].sort();
    const snapshotSorted = [...GLP1_KEYWORDS_SNAPSHOT].sort();
    expect(liveKeywords).toEqual(snapshotSorted);
  });
});
