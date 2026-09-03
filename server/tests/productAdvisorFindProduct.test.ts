/**
 * Product Advisor — Find a Product mode (engine-level)
 *
 * Covers the review-mandated behaviors:
 *  1. FAIL-CLOSED clinical guard: engine throws ClinicalContextUnavailableError
 *     when glp1Failed, or when glp1Active with no resolved targets (routes map
 *     this to 503 retryable — same policy as /recommend).
 *  2. usualPick server-side validation: a model-asserted usualPick is dropped
 *     unless its brand matches one of the user's COMPLIANT saved rows.
 *  3. usualPick deduplication: a verified usualPick is removed from the
 *     `recommended` ranked list.
 *  4. Shared context string: buildProtocolContextString includes protocol,
 *     GLP-1, macro, and labeled saved-favorites blocks.
 */

import {
  ProductAdvisorEngine,
  ClinicalContextUnavailableError,
  buildProtocolContextString,
  sanitizeUsualPicks,
  createProductAdvisorEngineForTest,
  type BrandKnowledgeProvider,
  type CartRecommendationResult,
} from "../services/productAdvisor";
import type { GroceryCoachContext } from "../services/groceryCoachContext";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseCtx = (overrides: Partial<GroceryCoachContext> = {}): GroceryCoachContext =>
  ({
    envelope: {} as any,
    protocolContext: "PROTOCOL: cardiac",
    glp1Failed: false,
    glp1Active: false,
    glp1Targets: null,
    glp1RecommendationBlock: "",
    macroContext: "MACROS: 1800 kcal",
    dailyCarbsTarget: null,
    savedGroceriesBlock: "",
    savedRows: [],
    compliantSavedRows: [],
    isClinical: false,
    hasDiabetes: false,
    ...overrides,
  }) as GroceryCoachContext;

const advisorResult = (result: CartRecommendationResult): BrandKnowledgeProvider => ({
  getCartRecommendations: jest.fn().mockResolvedValue(result),
  getSwapRecommendation: jest.fn(),
});

const SAUCE_RESULT: CartRecommendationResult = {
  advice: [
    {
      ingredient: "Marinara Sauce",
      category: "Sauce",
      usualPick: { brand: "Carbone Marinara", reason: "Your saved favorite" },
      recommended: [
        { brand: "Rao's Marinara", rank: 1, grade: "A", reason: "Low sodium for your cardiac protocol" },
        { brand: "Carbone Marinara", rank: 2, grade: "A", reason: "duplicate of usual pick" },
        { brand: "Victoria Marinara", rank: 3, grade: "B", reason: "Clean list" },
      ],
      avoid: [],
    },
  ],
  profileUsed: ["Cardiac Protocol"],
};

// ── 1. Fail-closed clinical guard ────────────────────────────────────────────

describe("ProductAdvisorEngine clinical fail-closed guard", () => {
  it("throws ClinicalContextUnavailableError when glp1Failed", async () => {
    const provider = advisorResult(SAUCE_RESULT);
    const engine = createProductAdvisorEngineForTest(provider, async () =>
      baseCtx({ glp1Failed: true }),
    );
    await expect(engine.buildCartRecommendations("u1", ["milk"])).rejects.toBeInstanceOf(
      ClinicalContextUnavailableError,
    );
    expect(provider.getCartRecommendations).not.toHaveBeenCalled();
  });

  it("throws when GLP-1 is active but targets are unresolved", async () => {
    const provider = advisorResult(SAUCE_RESULT);
    const engine = createProductAdvisorEngineForTest(provider, async () =>
      baseCtx({ glp1Active: true, glp1Targets: null }),
    );
    await expect(engine.buildCartRecommendations("u1", ["milk"])).rejects.toBeInstanceOf(
      ClinicalContextUnavailableError,
    );
    expect(provider.getCartRecommendations).not.toHaveBeenCalled();
  });

  it("error is marked retryable (route maps it to 503 retryable)", async () => {
    const err = new ClinicalContextUnavailableError();
    expect(err.retryable).toBe(true);
  });

  it("proceeds normally when GLP-1 targets resolved", async () => {
    const provider = advisorResult(SAUCE_RESULT);
    const engine = createProductAdvisorEngineForTest(provider, async () =>
      baseCtx({
        glp1Active: true,
        glp1Targets: { maximumToleratedFatGrams: 15, resolvedMealCalories: 500 } as any,
        glp1RecommendationBlock: "GLP-1 BLOCK",
      }),
    );
    const res = await engine.buildCartRecommendations("u1", ["marinara sauce"]);
    expect(provider.getCartRecommendations).toHaveBeenCalled();
    expect(res.profileUsed).toContain("Cardiac Protocol");
  });
});

// ── 2 & 3. usualPick validation + dedupe ─────────────────────────────────────

describe("sanitizeUsualPicks", () => {
  it("drops a hallucinated usualPick not present in compliant saved rows", () => {
    const out = sanitizeUsualPicks(SAUCE_RESULT, baseCtx({ compliantSavedRows: [] }));
    expect(out.advice[0].usualPick).toBeUndefined();
    // recommended untouched when pick dropped
    expect(out.advice[0].recommended).toHaveLength(3);
  });

  it("drops a usualPick that was saved but filtered out for non-compliance", () => {
    const ctx = baseCtx({
      savedRows: [{ productName: "Carbone Marinara", brand: "Carbone", category: "Sauce", nutritionJson: null }],
      compliantSavedRows: [], // compliance filter removed it
    });
    const out = sanitizeUsualPicks(SAUCE_RESULT, ctx);
    expect(out.advice[0].usualPick).toBeUndefined();
  });

  it("keeps a verified usualPick and removes it from recommended", () => {
    const ctx = baseCtx({
      compliantSavedRows: [
        { productName: "Carbone Marinara Sauce", brand: "Carbone", category: "Sauce", nutritionJson: null },
      ],
    });
    const out = sanitizeUsualPicks(SAUCE_RESULT, ctx);
    expect(out.advice[0].usualPick?.brand).toBe("Carbone Marinara");
    const brands = out.advice[0].recommended.map((r) => r.brand);
    expect(brands).not.toContain("Carbone Marinara");
    expect(brands).toEqual(["Rao's Marinara", "Victoria Marinara"]);
  });

  it("matches case-insensitively and by substring in either direction", () => {
    const ctx = baseCtx({
      compliantSavedRows: [
        { productName: "carbone marinara", brand: null, category: "Sauce", nutritionJson: null },
      ],
    });
    const out = sanitizeUsualPicks(SAUCE_RESULT, ctx);
    expect(out.advice[0].usualPick?.brand).toBe("Carbone Marinara");
  });

  it("engine applies sanitization end-to-end", async () => {
    const provider = advisorResult(SAUCE_RESULT);
    const engine = createProductAdvisorEngineForTest(provider, async () => baseCtx());
    const out = await engine.buildCartRecommendations("u1", ["marinara sauce"]);
    expect(out.advice[0].usualPick).toBeUndefined(); // no compliant saved rows
  });
});

// ── 4. Shared context string ─────────────────────────────────────────────────

describe("buildProtocolContextString", () => {
  it("includes protocol, GLP-1, macro and labeled saved-favorites blocks", () => {
    const s = buildProtocolContextString(
      baseCtx({
        glp1RecommendationBlock: "GLP-1 TARGETS: max 15g fat",
        savedGroceriesBlock: "- Carbone Marinara (Sauce)",
      }),
    );
    expect(s).toContain("PROTOCOL: cardiac");
    expect(s).toContain("GLP-1 TARGETS: max 15g fat");
    expect(s).toContain("MACROS: 1800 kcal");
    expect(s).toContain("=== SAVED GROCERY FAVORITES");
    expect(s).toContain("- Carbone Marinara (Sauce)");
  });

  it("falls back to a safe default when no context exists", () => {
    const s = buildProtocolContextString(
      baseCtx({ protocolContext: "", macroContext: "" }),
    );
    expect(s).toMatch(/No specific dietary or medical constraints/);
  });
});
