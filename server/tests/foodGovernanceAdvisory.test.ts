let mockUser: any;

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(async () => [mockUser]),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(async () => undefined),
    })),
  },
}));

import { enforceSafetyProfile } from "../services/safetyProfileService";

describe("server-authoritative food governance advisory classification", () => {
  beforeEach(() => {
    mockUser = {
      id: "food-governance-user",
      allergies: [],
      dietaryRestrictions: [],
      healthConditions: [],
      dislikedFoods: [],
      avoidedFoods: [],
    };
  });

  it.each([
    "Spicy Beef and Cauliflower Stir-Fry",
    "Thai chicken basil",
    "Chicken curry",
    "Chicken fried rice",
    "Vegetable sushi",
    "Chicken gumbo",
    "Vegetable tempura",
    "Beef pho",
  ])("defers only speculative associations for the selected concept: %s", async (title) => {
    mockUser.allergies = ["shellfish"];
    const usual = await enforceSafetyProfile(mockUser.id, title, "ordinary-precheck", { safetyMode: "STRICT" });
    const selected = await enforceSafetyProfile(mockUser.id, title, "menu-selected-concept", {
      safetyMode: "STRICT", deferAmbiguousDishCheck: true,
    });
    expect(selected.result).toBe("SAFE");
    if (usual.result === "AMBIGUOUS") expect(usual.ambiguousTerms.length).toBeGreaterThan(0);
  });

  it("still blocks explicit shrimp in a selected stir-fry and in a finished recipe", async () => {
    mockUser.allergies = ["shellfish"];
    const selected = await enforceSafetyProfile(mockUser.id, "Shrimp Stir-Fry", "menu-selected-concept", {
      safetyMode: "STRICT", deferAmbiguousDishCheck: true,
    });
    expect(selected.result).toBe("BLOCKED");
    const finished = await enforceSafetyProfile(mockUser.id, "Beef stir-fry with shrimp", "finished-recipe", {
      safetyMode: "STRICT",
    });
    expect(finished.result).toBe("BLOCKED");
  });

  it.each(["allergy", "avoidance"] as const)(
    "allows a pork-free gumbo but never treats pork as an acceptable %s substitute",
    async (restriction) => {
      if (restriction === "allergy") mockUser.allergies = ["pork"];
      else mockUser.avoidedFoods = ["pork"];
      const safe = await enforceSafetyProfile(mockUser.id, "Chicken and Okra Gumbo", "menu-selected-concept", {
        safetyMode: "STRICT", deferAmbiguousDishCheck: true,
      });
      const pork = await enforceSafetyProfile(mockUser.id, "Pork and Okra Gumbo", "menu-selected-concept", {
        safetyMode: "STRICT", deferAmbiguousDishCheck: true,
      });
      expect(safe.result).toBe("SAFE");
      expect(pork.result).toBe(restriction === "allergy" ? "BLOCKED" : "ADVISORY");
    },
  );

  it("classifies an avoided Pork request as a bypassable advisory with the exact reason", async () => {
    mockUser.avoidedFoods = ["pork"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Pork Chop",
      "create-dish",
      { safetyMode: "STRICT" },
    );

    expect(result).toMatchObject({
      result: "ADVISORY",
      reasonCode: "avoidance:pork",
      enforcementLevel: "advisory",
      overrideAllowed: true,
      requestedFood: "pork",
      blockedTerms: ["pork"],
    });
    expect(result.message).toContain("avoid pork");
  });

  it("recognizes one legacy comma-packed avoidance without hiding the exact match", async () => {
    mockUser.avoidedFoods = ["cauliflower, quinoa, pork, brussels sprouts"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Make pork chops",
      "create-dish",
      { safetyMode: "STRICT" },
    );

    expect(result.reasonCode).toBe("avoidance:pork");
    expect(result.blockedTerms).toEqual(["pork"]);
  });

  it("allows only the server-authorized matching avoidance to be ignored", async () => {
    mockUser.avoidedFoods = ["pork", "quinoa"];

    const pork = await enforceSafetyProfile(
      mockUser.id,
      "Pork Chop",
      "create-dish",
      { safetyMode: "STRICT", ignoredAvoidances: ["pork"] },
    );
    const quinoa = await enforceSafetyProfile(
      mockUser.id,
      "Quinoa bowl",
      "create-dish",
      { safetyMode: "STRICT", ignoredAvoidances: ["pork"] },
    );

    expect(pork.result).toBe("SAFE");
    expect(quinoa).toMatchObject({
      result: "ADVISORY",
      reasonCode: "avoidance:quinoa",
    });
  });

  it("keeps a confirmed allergy as a non-bypassable hard block before avoidance handling", async () => {
    mockUser.allergies = ["pork"];
    mockUser.avoidedFoods = ["pork"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Pork Chop",
      "create-dish",
      { safetyMode: "STRICT", ignoredAvoidances: ["pork"] },
    );

    expect(result).toMatchObject({
      result: "BLOCKED",
      enforcementLevel: "hard_block",
      overrideAllowed: false,
    });
    expect(result.reasonCode).toMatch(/^allergy:/);
  });

  it("classifies vegan steak as a bypassable dietary-identity advisory with the actual reason", async () => {
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Steak",
      "create-dish",
      { safetyMode: "STRICT" },
    );

    expect(result).toMatchObject({
      result: "ADVISORY",
      reasonCode: "dietary_identity:vegan",
      enforcementLevel: "advisory",
      overrideAllowed: true,
      requestedFood: "steak",
    });
    expect(result.message).toContain("Nutrition Life Plan");
    expect(result.message).toContain("vegan");
    expect(result.recommendedAlternative).toContain("vegan-friendly");
  });

  it("suppresses only the server-authorized dietary identity for one request", async () => {
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Steak",
      "create-dish",
      {
        safetyMode: "STRICT",
        ignoredDietaryRestrictions: ["vegan"],
      },
    );

    expect(result.result).toBe("SAFE");
  });

  it("does not warn for a compatible request", async () => {
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Roasted cauliflower with lentils",
      "create-dish",
      { safetyMode: "STRICT" },
    );

    expect(result.result).toBe("SAFE");
  });

  it.each([
    "Strawberry vegan ice cream",
    "Chinese strawberry vegan ice cream",
    "Strawberry ice cream with coconut milk",
    "Strawberry ice cream with oat milk and cashew cream",
    "Peanut butter ice cream made with almond milk",
  ])("does not treat compound food intent as a vegan conflict: %s", async (request) => {
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      request,
      "craving-creator",
      { safetyMode: "STRICT" },
    );

    expect(result.result).toBe("SAFE");
    expect(result.message).not.toContain("Nutrition Life Plan is currently set");
  });

  it("still flags actual heavy cream even when the dish is called vegan ice cream", async () => {
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Vegan strawberry ice cream made with heavy cream",
      "craving-creator",
      { safetyMode: "STRICT" },
    );

    expect(result).toMatchObject({
      result: "ADVISORY",
      reasonCode: "dietary_identity:vegan",
      requestedFood: "cream",
    });
    expect(result.blockedTerms).toContain("cream");
  });

  it("keeps ingredient-specific allergies active inside safe compounds", async () => {
    mockUser.allergies = ["tree nuts"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Strawberry ice cream made with almond milk",
      "craving-creator",
      { safetyMode: "STRICT" },
    );

    expect(result.result).toBe("BLOCKED");
    expect(result.blockedTerms.some(term => term.includes("almond"))).toBe(true);
  });

  it("keeps an allergy hard block above a dietary-identity override", async () => {
    mockUser.allergies = ["shrimp"];
    mockUser.dietaryRestrictions = ["vegan"];

    const result = await enforceSafetyProfile(
      mockUser.id,
      "Shrimp",
      "create-dish",
      {
        safetyMode: "STRICT",
        ignoredDietaryRestrictions: ["vegan"],
      },
    );

    expect(result).toMatchObject({
      result: "BLOCKED",
      enforcementLevel: "hard_block",
      overrideAllowed: false,
    });
  });

});