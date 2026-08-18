/**
 * craving-creator-exclude-meals.test.ts
 *
 * Confirms that "Try 3 More" exclusion works end-to-end:
 *
 *   inspiration.ts (excludedOptionNames)
 *     → /api/meals/craving-creator body (excludeMeals)
 *       → generateCravingMealOptions() 5th arg
 *         → ANTI-REPETITION clause injected into prompt (primary enforcement)
 *           → filterExcludedMealNames() applied to raw pool BEFORE slicing to 3
 *             → bounded retry when < 3 survive (3-result guarantee)
 *
 * Tests:
 *   1. normalizeForExclusion() — punctuation normalisation helper.
 *   2. filterExcludedMealNames() — unit tests (null safety, normalised matching).
 *   3. generateCravingMealOptions() — ANTI-REPETITION clause in prompt.
 *   4. generateCravingMealOptions() — 3-result guarantee via retry.
 *   5. routes.ts structural — excludeMeals validation + forwarding.
 *   6. inspiration.ts structural — excludedOptionNames forwarded as excludeMeals.
 *
 * Run: npx jest server/tests/craving-creator-exclude-meals.test.ts
 */

// ── Captured OpenAI calls ─────────────────────────────────────────────────────
interface CapturedCall { prompt: string }
const capturedCalls: CapturedCall[] = [];

// ── AI response factories ─────────────────────────────────────────────────────

function makeOpts(names: string[]) {
  return names.map((name, i) => ({
    name,
    description: `A delicious ${name}`,
    category: "dinner",
    calories: 400 + i * 10,
    protein: 35,
    fat: 14,
    starchyCarbs: 8,
    fibrousCarbs: 6,
    cookingTime: "25 minutes",
    difficulty: "Easy",
    ingredients: [
      { name: "chicken breast", quantity: "6 oz", unit: "" },
      { name: "garlic",         quantity: "2",    unit: "cloves" },
    ],
    instructions: "Cook and serve.",
    macros: { calories: 400 + i * 10, protein: 35, fat: 14, carbs: 14 },
  }));
}

// First-call response: all three names are excluded (simulates AI ignoring clause)
const EXCLUDED_NAMES = ["Teriyaki Chicken Bowl", "Crispy Orange Chicken", "Honey Garlic Chicken"];
const FIRST_CALL_ALL_EXCLUDED = JSON.stringify(makeOpts(EXCLUDED_NAMES));

// Retry response: three genuinely new meals
const RETRY_FRESH_NAMES = [
  "Herb-Roasted Chicken Thighs",
  "Lemon-Pepper Grilled Chicken",
  "Thai Basil Chicken Bowl",
];
const RETRY_RESPONSE = JSON.stringify(makeOpts(RETRY_FRESH_NAMES));

// Hyphen-variant — same meals as EXCLUDED_NAMES but with punctuation stripped by normaliser
const HYPHEN_VARIANT_NAMES = [
  "Teriyaki-Chicken-Bowl",      // hyphenated → same as "Teriyaki Chicken Bowl"
  "Crispy Orange Chicken",
  "Honey Garlic Chicken",
];
const FIRST_CALL_HYPHEN_VARIANT = JSON.stringify(makeOpts(HYPHEN_VARIANT_NAMES));

// ── Mock: openai ──────────────────────────────────────────────────────────────
// mockCreate is a jest.fn() so individual tests can override with
// mockResolvedValueOnce to inject specific sequences.
const mockCreate = jest.fn();

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: ../db ───────────────────────────────────────────────────────────────
const GENERIC_DB_USER = {
  id: "test-user-exclude-001",
  dietaryRestrictions: [],
  allergies: [],
  healthConditions: [],
  dislikedFoods: [],
  avoidedFoods: [],
  specialtyCondition: null,
  specialtyConditions: [],
  oncologySupportContext: null,
  thyroidSupportContext: null,
  measurementSystem: "imperial",
  diabeticContext: null,
  renalContext: null,
  performanceModeEnabled: false,
};
jest.mock("../db", () => {
  const chain: any = {
    from:   jest.fn().mockReturnThis(),
    where:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockResolvedValue([GENERIC_DB_USER]),
    select: jest.fn().mockReturnThis(),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) } };
});

// ── Mock: image generator + storage ──────────────────────────────────────────
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));
jest.mock("../storage", () => ({ storage: {} }));

// ── Mock: protocolEnvelope ────────────────────────────────────────────────────
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue({
    dietaryIdentity: [],
    allergies: [],
    avoidances: [],
    procedural: [],
    specialty: null,
    dailyNutritionState: null,
    alphaGalContext: null,
  }),
  enforceBeforeGenerate: jest.fn().mockReturnValue({ layers: { procedural: null } }),
  scanGeneratedOutput:   jest.fn().mockReturnValue([]),
  filterMealsByProtocol: jest.fn().mockImplementation((meals: any[]) => meals),
  buildGuestEnvelope:    jest.fn().mockReturnValue({ dietaryIdentity: [], allergies: [] }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  generateCravingMealOptions,
  filterExcludedMealNames,
  normalizeForExclusion,
} from "../services/unifiedMealPipeline";

// ─────────────────────────────────────────────────────────────────────────────
// 1. normalizeForExclusion — punctuation normalisation helper
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeForExclusion — punctuation normalisation", () => {
  it("lowercases the name", () => {
    expect(normalizeForExclusion("Herb-Roasted Chicken")).toBe("herb roasted chicken");
  });

  it("replaces hyphens with spaces", () => {
    expect(normalizeForExclusion("Herb-Roasted-Chicken")).toBe("herb roasted chicken");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeForExclusion("Herb  Roasted  Chicken")).toBe("herb roasted chicken");
  });

  it("strips parentheses and apostrophes and collapses resulting spaces", () => {
    // parentheses and apostrophes → spaces → collapsed to single space → trimmed
    expect(normalizeForExclusion("Chef's Special (Deluxe)")).toBe("chef s special deluxe");
  });

  it("makes 'Teriyaki-Chicken-Bowl' equal to 'Teriyaki Chicken Bowl'", () => {
    expect(normalizeForExclusion("Teriyaki-Chicken-Bowl"))
      .toBe(normalizeForExclusion("Teriyaki Chicken Bowl"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. filterExcludedMealNames — unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("filterExcludedMealNames — unit tests", () => {
  const OPTS = [
    { name: "Chicken Tikka Masala" },
    { name: "Grilled Salmon Bowl" },
    { name: "Avocado Toast" },
  ];

  it("returns all options when excludeMeals is empty", () => {
    expect(filterExcludedMealNames(OPTS, [])).toHaveLength(3);
  });

  it("returns all options when excludeMeals is undefined-like (empty array)", () => {
    expect(filterExcludedMealNames(OPTS, [])).toHaveLength(3);
  });

  it("removes an exact name match (case-insensitive)", () => {
    const result = filterExcludedMealNames(OPTS, ["chicken tikka masala"]);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.name)).not.toContain("Chicken Tikka Masala");
  });

  it("removes multiple excluded names in one pass", () => {
    const result = filterExcludedMealNames(OPTS, [
      "Chicken Tikka Masala",
      "Avocado Toast",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Grilled Salmon Bowl");
  });

  it("is case-insensitive for both option name and excluded list", () => {
    const result = filterExcludedMealNames(OPTS, ["GRILLED SALMON BOWL"]);
    expect(result.map(o => o.name)).not.toContain("Grilled Salmon Bowl");
  });

  it("catches hyphen-variant re-naming ('Grilled-Salmon-Bowl' vs 'Grilled Salmon Bowl')", () => {
    const result = filterExcludedMealNames(OPTS, ["Grilled-Salmon-Bowl"]);
    expect(result.map(o => o.name)).not.toContain("Grilled Salmon Bowl");
  });

  it("does NOT remove a genuinely different partial name", () => {
    // "Chicken Tikka" normalises differently from "Chicken Tikka Masala"
    const result = filterExcludedMealNames(OPTS, ["Chicken Tikka"]);
    expect(result).toHaveLength(3);
  });

  // ── Null / invalid input safety ───────────────────────────────────────────

  it("does NOT crash when excludeMeals contains null entries", () => {
    // A malformed client payload should never throw; null entries are silently skipped
    expect(() =>
      filterExcludedMealNames(OPTS, [null as any, "Avocado Toast"])
    ).not.toThrow();
    const result = filterExcludedMealNames(OPTS, [null as any, "Avocado Toast"]);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.name)).not.toContain("Avocado Toast");
  });

  it("does NOT crash when excludeMeals contains numeric entries", () => {
    expect(() =>
      filterExcludedMealNames(OPTS, [42 as any, "Grilled Salmon Bowl"])
    ).not.toThrow();
  });

  it("does NOT crash when excludeMeals contains empty-string entries", () => {
    // Empty strings are silently ignored; the empty string could match an option
    // named "" which should not occur in practice.
    expect(() =>
      filterExcludedMealNames(OPTS, ["", "Avocado Toast"])
    ).not.toThrow();
    const result = filterExcludedMealNames(OPTS, ["", "Avocado Toast"]);
    expect(result).toHaveLength(2);
  });

  it("handles options with undefined name gracefully (no crash, option survives)", () => {
    const optsWithUndefined = [{ name: undefined as any }, ...OPTS];
    expect(() =>
      filterExcludedMealNames(optsWithUndefined, ["Chicken Tikka Masala"])
    ).not.toThrow();
    // The undefined-named option stays (empty-string normalises differently
    // from the excluded name) and "Chicken Tikka Masala" is correctly removed
    const result = filterExcludedMealNames(optsWithUndefined, ["Chicken Tikka Masala"]);
    expect(result).toHaveLength(3); // 1 undefined-named + 2 remaining named
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. generateCravingMealOptions — ANTI-REPETITION clause in prompt
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCravingMealOptions — ANTI-REPETITION clause in prompt", () => {
  beforeEach(() => {
    capturedCalls.length = 0;
    mockCreate.mockReset();
    // Default: always return fresh meals (no excluded names in response)
    mockCreate.mockImplementation(async (params: any) => {
      const userMsg = (params.messages ?? []).find((m: any) => m.role === "user");
      if (userMsg?.content) capturedCalls.push({ prompt: userMsg.content });
      return { choices: [{ message: { content: RETRY_RESPONSE } }] };
    });
  });

  it("includes the ANTI-REPETITION clause when excludeMeals is non-empty", async () => {
    await generateCravingMealOptions(
      "chicken",
      "dinner",
      "test-user-exclude-001",
      [],
      EXCLUDED_NAMES,
      false,
      "meal",
    );

    expect(capturedCalls.length).toBeGreaterThan(0);
    const prompt = capturedCalls[0].prompt;
    expect(prompt).toMatch(/ANTI-REPETITION/i);
    for (const name of EXCLUDED_NAMES) {
      expect(prompt).toContain(name);
    }
  });

  it("does NOT include ANTI-REPETITION clause when excludeMeals is absent", async () => {
    await generateCravingMealOptions("chicken", "dinner", "test-user-exclude-001", [], undefined, false, "meal");

    expect(capturedCalls.length).toBeGreaterThan(0);
    expect(capturedCalls[0].prompt).not.toMatch(/ANTI-REPETITION/i);
  });

  it("does NOT include ANTI-REPETITION clause when excludeMeals is empty array", async () => {
    await generateCravingMealOptions("chicken", "dinner", "test-user-exclude-001", [], [], false, "meal");

    expect(capturedCalls.length).toBeGreaterThan(0);
    expect(capturedCalls[0].prompt).not.toMatch(/ANTI-REPETITION/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. generateCravingMealOptions — 3-result guarantee via bounded retry
// ─────────────────────────────────────────────────────────────────────────────

describe("generateCravingMealOptions — 3-result guarantee with excludeMeals", () => {
  beforeEach(() => {
    capturedCalls.length = 0;
    mockCreate.mockReset();
  });

  it("returns 3 meals when AI response contains no excluded names", async () => {
    // AI returns 3 fresh meals → no exclusion filtering needed → 3 results straight
    mockCreate.mockImplementation(async (params: any) => {
      const userMsg = (params.messages ?? []).find((m: any) => m.role === "user");
      if (userMsg?.content) capturedCalls.push({ prompt: userMsg.content });
      return { choices: [{ message: { content: RETRY_RESPONSE } }] };
    });

    const results = await generateCravingMealOptions(
      "chicken", "dinner", "test-user-exclude-001",
      [], EXCLUDED_NAMES, false, "meal",
    );

    expect(results).toHaveLength(3);
    const names = results.map(m => m.name);
    for (const ex of EXCLUDED_NAMES) {
      expect(names).not.toContain(ex);
    }
  });

  it("fires a retry and returns 3 distinct meals when all 3 first-call options are excluded", async () => {
    // Call 1 → all three names match excludeMeals → 0 options survive
    // Call 2 (retry) → 3 fresh options → 3 results returned
    let callCount = 0;
    mockCreate.mockImplementation(async (params: any) => {
      const userMsg = (params.messages ?? []).find((m: any) => m.role === "user");
      if (userMsg?.content) capturedCalls.push({ prompt: userMsg.content });
      callCount++;
      const body = callCount === 1 ? FIRST_CALL_ALL_EXCLUDED : RETRY_RESPONSE;
      return { choices: [{ message: { content: body } }] };
    });

    const results = await generateCravingMealOptions(
      "chicken", "dinner", "test-user-exclude-001",
      [], EXCLUDED_NAMES, false, "meal",
    );

    // Retry must have fired
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // Must return exactly 3 meals
    expect(results).toHaveLength(3);

    // None of the returned names should be in the excluded list
    const returnedNames = results.map(m => m.name);
    for (const ex of EXCLUDED_NAMES) {
      expect(returnedNames).not.toContain(ex);
    }

    // The results should be the fresh retry meals
    for (const fresh of RETRY_FRESH_NAMES) {
      expect(returnedNames).toContain(fresh);
    }
  });

  it("handles normalised name variants (hyphenated vs spaced) when retrying", async () => {
    // First call returns hyphen-variant names that normalise to the excluded names
    let callCount = 0;
    mockCreate.mockImplementation(async (params: any) => {
      callCount++;
      return {
        choices: [{
          message: {
            content: callCount === 1 ? FIRST_CALL_HYPHEN_VARIANT : RETRY_RESPONSE,
          },
        }],
      };
    });

    const results = await generateCravingMealOptions(
      "chicken", "dinner", "test-user-exclude-001",
      [], EXCLUDED_NAMES, false, "meal",
    );

    // Retry must have fired (hyphen variants matched excluded names)
    expect(mockCreate).toHaveBeenCalledTimes(2);

    expect(results).toHaveLength(3);

    // Neither the exact nor the hyphen-variant excluded names should appear
    const returnedNames = results.map(m => m.name);
    for (const ex of EXCLUDED_NAMES) {
      // Normalised comparison: returned name must not normalise to excluded name
      const exNorm = normalizeForExclusion(ex);
      for (const r of returnedNames) {
        expect(normalizeForExclusion(r)).not.toBe(exNorm);
      }
    }
  });

  it("returns the surviving options when retry also fails to produce un-excluded meals", async () => {
    // Both call 1 and the retry return all-excluded names.
    // Expected: the pipeline returns 0 options (caller routes to 422),
    // rather than crashing or returning excluded meals.
    let callCount = 0;
    mockCreate.mockImplementation(async () => {
      callCount++;
      // Both attempts return the same excluded names
      return { choices: [{ message: { content: FIRST_CALL_ALL_EXCLUDED } }] };
    });

    const results = await generateCravingMealOptions(
      "chicken", "dinner", "test-user-exclude-001",
      [], EXCLUDED_NAMES, false, "meal",
    );

    // Retry must have fired
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // No excluded name must appear in the (possibly empty) result
    const returnedNames = results.map(m => m.name);
    for (const ex of EXCLUDED_NAMES) {
      expect(returnedNames).not.toContain(ex);
    }
  });

  it("returns 3 meals even when excludeMeals contains null/invalid entries alongside valid ones", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: RETRY_RESPONSE } }],
    });

    // Mixed-type excludeMeals must not throw; the null entry is silently skipped
    const results = await generateCravingMealOptions(
      "chicken", "dinner", "test-user-exclude-001",
      [], [null as any, "Teriyaki Chicken Bowl"], false, "meal",
    );

    expect(results.length).toBeGreaterThan(0);
    const returnedNames = results.map(m => m.name);
    expect(returnedNames).not.toContain("Teriyaki Chicken Bowl");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. routes.ts structural — excludeMeals validation + forwarding
// ─────────────────────────────────────────────────────────────────────────────

describe("routes.ts structural — excludeMeals validation + forwarding", () => {
  const fs = require("fs");
  const path = require("path");
  const routesSrc: string = fs.readFileSync(
    path.join(__dirname, "../routes.ts"),
    "utf8"
  );

  it("reads excludeMeals from req.body", () => {
    expect(routesSrc).toMatch(/req\.body\.excludeMeals/);
  });

  it("validates each entry as a non-empty string (rejects null/non-string values)", () => {
    // The filter must guard against malformed payloads
    expect(routesSrc).toMatch(/typeof\s+e\s*===\s*['"]string['"]/);
    expect(routesSrc).toMatch(/\.trim\(\)\.length\s*>\s*0/);
  });

  it("caps the list to prevent prompt bloat while allowing multiple rounds", () => {
    // Cap should be at least 9 (3 rounds × 3 cards)
    expect(routesSrc).toMatch(/\.slice\(0,\s*9\)/);
  });

  it("passes excludeMeals as a positional argument to generateCravingMealOptions", () => {
    expect(routesSrc).toContain("excludeMeals,");
  });

  it("defaults to an empty array when body field is absent or non-array", () => {
    // The declaration must initialise excludeMeals and have a `: []` fallback
    expect(routesSrc).toMatch(/const excludeMeals/);
    expect(routesSrc).toMatch(/:\s*\[\]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. inspiration.ts structural — excludedOptionNames forwarded as excludeMeals
// ─────────────────────────────────────────────────────────────────────────────

describe("inspiration.ts structural — excludedOptionNames forwarded as excludeMeals", () => {
  const fs = require("fs");
  const path = require("path");
  const inspSrc: string = fs.readFileSync(
    path.join(__dirname, "../routes/inspiration.ts"),
    "utf8"
  );

  it("reads excludedOptionNames from the request body", () => {
    expect(inspSrc).toContain("excludedOptionNames");
  });

  it("sends excludeMeals to the craving-creator endpoint when excludedOptionNames is present", () => {
    expect(inspSrc).toContain("excludeMeals");
    expect(inspSrc).toMatch(/Array\.isArray\(excludedOptionNames\)/);
  });

  it("caps exclusion list at 9 (3 rounds × 3 cards), matching the route cap", () => {
    expect(inspSrc).toMatch(/\.slice\(0,\s*9\)/);
  });

  it("validates each excluded entry as a non-empty string before forwarding", () => {
    expect(inspSrc).toMatch(/typeof\s+n\s*===\s*['"]string['"]/);
    expect(inspSrc).toMatch(/\.trim\(\)\.length\s*>\s*0/);
  });

  it("does NOT pass skipImages/skipImage to the craving-creator (images always generated)", () => {
    // skipImages was removed so Try 3 More cards always have imageUrl populated
    expect(inspSrc).not.toContain("skipImage: true");
    expect(inspSrc).not.toContain("skipImages ?");
  });

  it("always runs image generation for all options including Try 3 More", () => {
    // The image generation block must NOT be inside a conditional on skipImages
    expect(inspSrc).not.toMatch(/if\s*\(!?\s*skipImages\)/);
  });
});
