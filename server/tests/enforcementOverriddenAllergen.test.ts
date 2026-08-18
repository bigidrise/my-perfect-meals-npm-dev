/**
 * enforcementOverriddenAllergen.test.ts
 *
 * Regression: a Safety PIN override allergen must ONLY propagate out of
 * runEnforcement when enforceSafetyProfile actually validated, one-time
 * claimed, and audited the token (i.e. the assessment carries
 * overriddenAllergen). A valid-but-unclaimed token — supplied with input that
 * triggers no allergy conflict — must NOT surface an overriddenAllergen on
 * the enforcement result, so the /api/meals/generate route (which reads
 * ONLY enforcement.overriddenAllergen) never suppresses post-generation
 * scanning for an unaudited allergen.
 *
 * Pure unit tests — safetyProfileService is mocked; no db/network.
 *
 * Run: npx jest server/tests/enforcementOverriddenAllergen.test.ts --runInBand
 */

jest.mock("../db", () => ({ db: {} }));
jest.mock("../storage", () => ({ storage: {} }));

const mockLoadSafetyProfile = jest.fn();
const mockEnforceSafetyProfile = jest.fn();

jest.mock("../services/safetyProfileService", () => ({
  loadSafetyProfile: (...args: any[]) => mockLoadSafetyProfile(...args),
  enforceSafetyProfile: (...args: any[]) => mockEnforceSafetyProfile(...args),
}));

import { runEnforcement } from "../services/enforcementGateway";

const baseProfile = {
  userId: "u1",
  dietType: null,
  allergies: ["shellfish"],
  avoidIngredients: [],
};

const baseRequest = {
  userId: "u1",
  builderType: "create_with_chef",
  phase: "pre_generation" as const,
  inputText: "a simple green salad",
  safetyMode: "CUSTOM_AUTHENTICATED" as const,
  overrideToken: "valid-but-unclaimed-token",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadSafetyProfile.mockResolvedValue(baseProfile);
});

describe("runEnforcement — overriddenAllergen propagation", () => {
  test("ALLOW without a claimed override does NOT expose overriddenAllergen (unclaimed token)", async () => {
    // Input has no allergy conflict → enforceSafetyProfile allows WITHOUT
    // claiming the token and returns no overriddenAllergen.
    mockEnforceSafetyProfile.mockResolvedValue({ result: "ALLOWED" });

    const result = await runEnforcement(baseRequest as any);

    expect(result.decision).toBe("ALLOW");
    expect(result.overriddenAllergen).toBeUndefined();
  });

  test("ALLOW with a claimed override exposes exactly the audited allergen", async () => {
    mockEnforceSafetyProfile.mockResolvedValue({
      result: "ALLOWED",
      overriddenAllergen: "shellfish",
    });

    const result = await runEnforcement(baseRequest as any);

    expect(result.decision).toBe("ALLOW");
    expect(result.overriddenAllergen).toBe("shellfish");
  });

  test("BLOCK never exposes overriddenAllergen", async () => {
    mockEnforceSafetyProfile.mockResolvedValue({
      result: "BLOCKED",
      blockedTerms: ["shrimp"],
      message: "Contains shrimp (shellfish allergy)",
    });

    const result = await runEnforcement({
      ...baseRequest,
      inputText: "shrimp gumbo",
    } as any);

    expect(result.decision).toBe("BLOCK");
    expect((result as any).overriddenAllergen).toBeUndefined();
  });
});
