import {
  emptyMyPerfectMenuPreferences,
  myPerfectMenuPreferencesSchema,
} from "@shared/myPerfectMenu";
import {
  buildMyPerfectMenuContextStamp,
  isMyPerfectMenuContextStampFresh,
  type MyPerfectMenuAuthorityMaterial,
} from "../services/myPerfectMenu/contextStamp";

const base: MyPerfectMenuAuthorityMaterial = {
  subject: { kind: "user", id: "user-1" },
  builder: { key: "general_nutrition", namespace: "generalNutrition" },
  effectiveDiet: ["balanced"],
  allergies: ["peanuts"],
  avoidances: ["mushrooms"],
  dislikes: ["very spicy"],
  cuisine: "Japanese",
  foodsIEnjoy: ["dish.sushi"],
  diabetes: {
    applicable: true,
    state: "IN_RANGE",
    activePreferences: ["lentils"],
    producePreferences: ["broccoli"],
  },
  protocol: {
    classification: ["diabetes-type-2"],
    active: true,
    conditionKeys: ["diabetes"],
  },
  glp1: { active: false, escalation: false, adaptationState: "none" },
  targetPresence: { protocol: true, diabetes: true, glp1: false, foodsIEnjoy: true },
};

describe("My Perfect Menu context stamps", () => {
  const fixed = new Date("2026-01-02T03:04:05.000Z");

  it("parses legacy preferences and defaults additive per-category stamps", () => {
    const legacy = myPerfectMenuPreferencesSchema.parse({
      version: 1,
      categories: {},
      recentSignatures: [],
      recentCulinaryFingerprints: [],
      updatedAt: fixed.toISOString(),
    });
    expect(legacy.contextStamps).toEqual({});
    expect(emptyMyPerfectMenuPreferences().contextStamps).toEqual({});
  });

  it("produces deterministic opaque base64url stamps and fresh/mismatch comparisons", () => {
    const one = buildMyPerfectMenuContextStamp(base, "lunch", fixed);
    const two = buildMyPerfectMenuContextStamp(base, "lunch", new Date("2027-01-02T03:04:05.000Z"));
    expect(one.digest).toBe(two.digest);
    expect(one.digest).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(one.digest).not.toContain("Japanese");
    expect(isMyPerfectMenuContextStampFresh(one, two)).toBe(true);
    expect(isMyPerfectMenuContextStampFresh(one, { ...two, digest: `${two.digest}x` })).toBe(false);
    expect(isMyPerfectMenuContextStampFresh(one, { ...two, category: "dinner" })).toBe(false);
    expect(isMyPerfectMenuContextStampFresh(undefined, two)).toBe(false);
  });

  it.each([
    ["diet", { effectiveDiet: ["vegan"] }],
    ["allergy", { allergies: ["shellfish"] }],
    ["avoidance", { avoidances: ["cilantro"] }],
    ["cuisine", { cuisine: "Mexican" }],
    ["diabetes state", { diabetes: { ...base.diabetes, state: "HIGH" } }],
    ["protocol", { protocol: { ...base.protocol, conditionKeys: ["renal"] } }],
    ["GLP-1 tolerance", { glp1: { active: true, escalation: false, adaptationState: "nausea:mild" } }],
  ])("changes digest when authoritative %s changes", (_label, change) => {
    const changed = buildMyPerfectMenuContextStamp({ ...base, ...change } as MyPerfectMenuAuthorityMaterial, "lunch", fixed);
    expect(changed.digest).not.toBe(buildMyPerfectMenuContextStamp(base, "lunch", fixed).digest);
  });

  it("does not persist raw glucose values or other sensitive material", () => {
    const stamp = buildMyPerfectMenuContextStamp(base, "breakfast", fixed);
    const serialized = JSON.stringify(stamp);
    expect(serialized).not.toContain("120");
    expect(serialized).not.toContain("IN_RANGE");
    expect(serialized).not.toContain("peanuts");
    expect(Object.keys(stamp)).toEqual([
      "version",
      "digest",
      "generatedAt",
      "subjectId",
      "category",
      "builderKey",
      "builderNamespace",
    ]);
  });

  it("represents missing GLP-1 check-in without gating and approved escalation as coarse state", () => {
    const missing = buildMyPerfectMenuContextStamp({
      ...base,
      glp1: { active: true, escalation: false, adaptationState: "none" },
    }, "snack", fixed);
    const approvedEscalation = buildMyPerfectMenuContextStamp({
      ...base,
      glp1: { active: true, escalation: true, adaptationState: "approved" },
    }, "snack", fixed);
    expect(missing.digest).toBeTruthy();
    expect(approvedEscalation.digest).not.toBe(missing.digest);
  });
});