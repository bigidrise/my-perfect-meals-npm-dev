/**
 * copilotDiabeticHubKeywords.test.ts
 *
 * Confirms that the Diabetic Hub Copilot keyword block routes voice queries to
 * /diabetic-hub and that the hub's spokenText describes GlucoseGuard and the
 * hub's core surfaces.
 *
 * Regression guard: a future keyword-map refactor that silently breaks
 * "blood sugar", "glucose", or "diabetic hub" routing will fail here.
 */

import { findFeatureFromKeywords } from "@/components/copilot/KeywordFeatureMap";
import { PAGE_EXPLANATIONS } from "@/components/copilot/CopilotPageExplanations";

// ── 1. Keyword → path routing ─────────────────────────────────────────────────

describe("Diabetic Hub KeywordFeatureMap routing", () => {
  const DIABETIC_PATH = "/diabetic-hub";

  /** All keywords declared in the diabetic-hub block must route correctly. */
  const allDiabeticKeywords = [
    "diabetic",
    "diabetes",
    "sugar control",
    "blood sugar",
    "glucose",
    "diabetic hub",
    "diabetes hub",
  ];

  test.each(allDiabeticKeywords)(
    'keyword "%s" resolves to /diabetic-hub',
    (keyword) => {
      const result = findFeatureFromKeywords(keyword);
      expect(result).not.toBeNull();
      expect(result!.path).toBe(DIABETIC_PATH);
    },
  );

  /** Realistic voice queries that contain a registered keyword as a substring. */
  test("voice query 'I need help with blood sugar management' resolves to /diabetic-hub", () => {
    const result = findFeatureFromKeywords(
      "I need help with blood sugar management",
    );
    expect(result).not.toBeNull();
    expect(result!.path).toBe(DIABETIC_PATH);
  });

  test("voice query 'show me the glucose tracking' resolves to /diabetic-hub", () => {
    const result = findFeatureFromKeywords("show me the glucose tracking");
    expect(result).not.toBeNull();
    expect(result!.path).toBe(DIABETIC_PATH);
  });

  test("voice query 'open the diabetic hub' resolves to /diabetic-hub", () => {
    const result = findFeatureFromKeywords("open the diabetic hub");
    expect(result).not.toBeNull();
    expect(result!.path).toBe(DIABETIC_PATH);
  });

  test("voice query 'I am diabetic' resolves to /diabetic-hub", () => {
    const result = findFeatureFromKeywords("I am diabetic");
    expect(result).not.toBeNull();
    expect(result!.path).toBe(DIABETIC_PATH);
  });
});

// ── 2. /diabetic-hub spokenText covers GlucoseGuard and core hub surfaces ─────

describe("Diabetic Hub page explanation coverage", () => {
  const explanation = PAGE_EXPLANATIONS["/diabetic-hub"];

  test("/diabetic-hub explanation entry exists", () => {
    expect(explanation).toBeDefined();
  });

  test("spokenText is non-empty", () => {
    expect(explanation.spokenText.length).toBeGreaterThan(100);
  });

  test("spokenText mentions GlucoseGuard", () => {
    expect(explanation.spokenText).toContain("GlucoseGuard");
  });

  test("spokenText explains blood sugar / glucose management", () => {
    const text = explanation.spokenText.toLowerCase();
    const describesBloodSugar =
      text.includes("blood sugar") || text.includes("glucose");
    expect(describesBloodSugar).toBe(true);
  });

  test("spokenText mentions glucose logging capability", () => {
    const text = explanation.spokenText.toLowerCase();
    const describesLogging =
      text.includes("log glucose") || text.includes("glucose reading");
    expect(describesLogging).toBe(true);
  });

  test("spokenText describes meal generation adjustment by glucose state", () => {
    const text = explanation.spokenText.toLowerCase();
    // GlucoseGuard adjusts meals based on current glucose reading
    const describesAdjustment =
      text.includes("adjusts") || text.includes("adjust");
    expect(describesAdjustment).toBe(true);
  });

  test("spokenText references the diabetic meal builder as the next step", () => {
    const text = explanation.spokenText.toLowerCase();
    const referencesMealBuilder =
      text.includes("diabetic meal builder") ||
      text.includes("meal builder");
    expect(referencesMealBuilder).toBe(true);
  });
});

// ── 3. KeywordFeatureMap entry integrity ──────────────────────────────────────

describe("Diabetic Hub KeywordFeatureMap entry integrity", () => {
  test("diabetic-hub mapping has correct walkthroughId", () => {
    const result = findFeatureFromKeywords("diabetic hub");
    expect(result).not.toBeNull();
    expect(result!.walkthroughId).toBe("diabetic-hub");
  });

  test("diabetic-hub mapping has correct path", () => {
    const result = findFeatureFromKeywords("blood sugar");
    expect(result).not.toBeNull();
    expect(result!.path).toBe("/diabetic-hub");
  });
});
