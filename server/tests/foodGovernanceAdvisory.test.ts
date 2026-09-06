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
});