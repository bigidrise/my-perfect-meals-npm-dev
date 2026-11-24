// All profile and paid-provider dependencies are isolated before loading the service.
jest.mock("../utils/openaiSafe", () => ({ openai: {}, chatJson: jest.fn() }));
jest.mock("../services/protocolEnvelope", () => ({ loadUserProtocolEnvelope: jest.fn() }));
jest.mock("../services/ingredientIntelligence", () => ({ scanTextForHighRiskIngredients: jest.fn() }));
jest.mock("../services/groceryChoiceMemory", () => ({
  ...jest.requireActual("../services/groceryChoiceMemory"),
  developmentGroceryChoiceStore: jest.fn(async () => null),
}));

import { chatJson } from "../utils/openaiSafe";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { analyzeProductByName, analyzeFullProduct, analyzeIngredientContent } from "../services/ingredientScanService";

test("by-name service fails closed on a fabricated soy/TRT restriction without mutating historical results", async () => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(profile());
  (chatJson as jest.Mock).mockResolvedValue(analysis({
    verdict: "Avoid soy sauce during testosterone replacement therapy due to phytoestrogens.",
  }));
  const result = await analyzeProductByName("Soy sauce", "synthetic-shopper");
  expect(result.fallbackUsed).toBe(true);
  expect(result.whatMattersMost).toEqual([]);
  expect(result.verdict).not.toMatch(/phytoestrogen/i);
});

const profile = (extra: Record<string, unknown> = {}) => ({
  userId: "synthetic-shopper", dietaryIdentity: ["vegan"], allergies: [],
  medicalHardLimits: [], medicalOptimization: [], conditionGuidanceBlocks: [],
  avoidances: [], procedural: { forbiddenInstructions: [] }, goalType: "maintain",
  ...extra,
});
const analysis = (extra: Record<string, unknown> = {}) => ({
  alignmentGrade: "A", verdictLevel: "buy", verdict: "A nutrition option to consider.",
  overallSummary: "Compare the current sodium and serving size for your goals.",
  betterAlternatives: [
    { category: "Example Tomato Sauce", whyBetter: ["Compare added sugar."], targetCriteria: "Check current ingredients." },
    { category: "Example Marinara", whyBetter: ["Compare sodium."], targetCriteria: "Check serving size." },
  ],
  ingredientConsiderations: [], profileFactorsUsed: ["Vegan diet"],
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(profile());
  (chatJson as jest.Mock).mockResolvedValue(analysis());
});

test("existing by-name analysis uses the current subject's profile and supports a category request", async () => {
  const result = await analyzeProductByName("I'm looking for spaghetti sauce.", "synthetic-shopper");
  expect(loadUserProtocolEnvelope).toHaveBeenCalledWith("synthetic-shopper");
  const request = (chatJson as jest.Mock).mock.calls[0][0];
  expect(request.user).toContain("I'm looking for spaghetti sauce.");
  expect(request.user).toMatch(/vegan/i);
  expect(request.system).toContain("Return fewer or none rather than inventing options");
  expect(request.system).not.toContain('Do NOT use "may contain" or "check the label"');
  expect(request.model).toBe("gpt-4o");
  expect(result.betterAlternatives).toHaveLength(2);
  expect(result.analysisProfile).toContain("Vegan diet");
  expect(result.educationalFooter).toMatch(/not a verified label scan/i);
  expect(result.extractedIngredients).toEqual([]);
  expect(result.fallbackUsed).toBe(false);
});

test.each([
  ["allergy", { allergies: ["peanut"] }],
  ["Alpha-Gal", { alphaGalContext: { active: true } }],
  ["pregnancy", { pregnancySupportContext: { active: true, stage: "trimester-2" } }],
])("%s receives qualified guidance, never unconditional safety clearance", async (_name, extra) => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(profile(extra));
  const result = await analyzeProductByName("spaghetti sauce", "synthetic-shopper");
  expect(result.betterAlternatives).toHaveLength(2);
  expect(result.verdictLevel).toBe("caution");
  expect(result.verdict).toMatch(/consideration only/i);
  expect(result.ingredientConsiderations[0]).toMatch(/Do not consume until/);
  expect(result.educationalFooter).toMatch(/not allergy or medical safety clearance/);
});

test("retains a skip verdict rather than upgrading a conflict to a suggestion", async () => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(profile({ allergies: ["milk"] }));
  (chatJson as jest.Mock).mockResolvedValue(analysis({ verdictLevel: "skip", verdict: "Known milk conflict." }));
  const result = await analyzeProductByName("cheese sauce", "synthetic-shopper");
  expect(result.verdictLevel).toBe("skip");
  expect(result.verdict).toBe("Known milk conflict.");
});

test("unsupported grades do not reject useful guidance or fabricate extra options", async () => {
  (chatJson as jest.Mock).mockResolvedValue(analysis({ alignmentGrade: "", betterAlternatives: [] }));
  const result = await analyzeProductByName("spaghetti sauce", "synthetic-shopper");
  expect(result.gradeUnavailable).toBe(true);
  expect(result.betterAlternatives).toEqual([]);
  expect(result.fallbackUsed).toBe(false);
});

test("unavailable profile does not become an unrestricted shopper", async () => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(null);
  await expect(analyzeProductByName("spaghetti sauce", "synthetic-shopper")).rejects.toThrow(/profile.*unavailable/i);
  expect(chatJson).not.toHaveBeenCalled();
});

test("provider failure remains a retryable analysis failure, not made-up guidance", async () => {
  (chatJson as jest.Mock).mockRejectedValue(new Error("offline"));
  const result = await analyzeProductByName("spaghetti sauce", "synthetic-shopper");
  expect(result.fallbackUsed).toBe(true);
  expect(result.betterAlternatives).toEqual([]);
});

test("photo-based full-product analysis retains label authority and existing medical safeguards", async () => {
  await analyzeFullProduct("Example sauce", "Tomatoes, water, salt", "synthetic-shopper");
  const request = (chatJson as jest.Mock).mock.calls[0][0];
  expect(request.system).toContain("MEDICAL AUTHORITY:");
  expect(request.system).toContain("Use only applicable supplied rules.");
  expect(request.system).toContain("Given a specific branded product name");
  expect(request.user).toContain("Tomatoes, water, salt");
  expect(request.user).toContain("Example sauce");
  expect(request.user).toMatch(/vegan/i);
});

test.each(["by_name", "by_label", "full_product"] as const)(
  "Development %s scans delegate the final verdict and alternatives to exact-catalog verification",
  async method => {
    const environment = process.env.NODE_ENV;
    const verification = await import("../services/productDiscovery/developmentGroceryVerification");
    const marker = { ...analysis(), productName: "Verified synthetic result", betterAlternatives: [] };
    const spy = jest.spyOn(verification, "verifyDevelopmentScanResult").mockResolvedValue(marker as any);
    try {
      process.env.NODE_ENV = "development";
      const result = method === "by_name"
        ? await analyzeProductByName("Example sauce", "synthetic-shopper", { memoryStore: null })
        : method === "full_product"
          ? await analyzeFullProduct("Example sauce", "Tomatoes, water", "synthetic-shopper")
          : await analyzeIngredientContent("synthetic-shopper", { rawText: "Tomatoes, water" });
      expect(result).toBe(marker);
      expect(spy).toHaveBeenCalledWith("synthetic-shopper", expect.any(Object), expect.objectContaining({ userId: "synthetic-shopper" }));
    } finally {
      process.env.NODE_ENV = environment;
      spy.mockRestore();
    }
  },
);
