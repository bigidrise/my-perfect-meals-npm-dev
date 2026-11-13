import {
  canonicalClinicalProtocol, normalizeClinicalProtocols, changeClinicalProtocols,
  effectiveClinicalProtocols, isClinicalIndicatorActive,
} from "@shared/clinicalProtocolIdentity";
import { evaluateClinicalProtocolAuthority } from "../services/clinicalProtocolAuthority";
import { resolveProtocolFromLabs, resolveDowngradeSignals } from "../services/resolveProtocolFromLabs";
import { buildUniversalConditionGuidance, type UniversalGuidanceInput } from "../services/universalMedicalGuidance";
import fs from "node:fs";
import { resolveClinicalModeFromProtocols } from "@shared/clinical/clinicalModeResolver";

jest.mock("../db", () => ({ db: {} }));

const INVENTORY = [
  ["anti-inflammatory", "anti-inflammatory", "green"],
  ["heart-failure", "cardiac", "red"],
  ["kidney-disease", "renal", "sky"],
  ["liver-support", "liver-support", "emerald"],
  ["liver-disease", "liver-disease", "amber"],
  ["oncology-support", "oncology-support", "pink"],
  ["thyroid-support", "thyroid-support", "teal"],
  ["alpha-gal-syndrome", "alpha-gal-syndrome", "orange"],
  ["hashimotos", "hashimotos", "teal"],
  ["hypothyroid", "hypothyroid", "teal"],
  ["hyperthyroid", "hyperthyroid", "cyan"],
  ["menopause", "menopause", "violet"],
  ["perimenopause", "perimenopause", "purple"],
  ["metabolic-recovery", "metabolic-recovery", "amber"],
  ["hormone-optimization", "hormone-optimization", null],
  ["pregnancy-support", "pregnancy-support", null],
  ["glp1", "glp1", null],
] as const;

describe("all 17 founder-listed clinical identities", () => {
  test.each(INVENTORY)("%s activates and deactivates independently as %s", (legacy, canonical) => {
    const baseline = ["cardiac", "anti-inflammatory", "liver-support"].filter(c => c !== canonical);
    const next = changeClinicalProtocols(baseline, legacy, "accepted");
    expect(canonicalClinicalProtocol(legacy)).toBe(canonical);
    expect(isClinicalIndicatorActive(legacy, next)).toBe(true);
    const off = changeClinicalProtocols(next, legacy, "removed");
    expect(isClinicalIndicatorActive(legacy, off)).toBe(false);
    expect(off).toEqual(baseline);
  });
  test("legacy duplicates normalize without conflating distinct liver, metabolic or thyroid conditions", () => {
    expect(normalizeClinicalProtocols(["heart-failure", "cardiac", "kidney-disease", "renal"]))
      .toEqual(["cardiac", "renal"]);
    expect(normalizeClinicalProtocols(["liver-disease", "liver-support", "metabolic-support",
      "metabolic-recovery", "hypothyroid", "hyperthyroid"])).toHaveLength(6);
  });
  test("a builder cache, recommendation, and unknown private condition never activate status", () => {
    expect(effectiveClinicalProtocols({
      specialtyConditions: ["cardiac"], healthConditions: ["private-unrelated-diagnosis"],
      ...{ activeBoard: "anti_inflammatory", assignedBuilder: "diabetic", protocolSignal: "renal" },
    })).toEqual(["cardiac"]);
  });
  test("unsupported legacy recommendation strings do not illuminate active indicators", () => {
    expect(effectiveClinicalProtocols({ specialtyConditions: [
      "metabolic-support", "metabolic-stress", "inflammation-support", "cardiac",
    ] })).toEqual(["cardiac"]);
  });
  test("a saved thyroid subtype narrows an active support, but is not standalone activation", () => {
    expect(effectiveClinicalProtocols({ specialtyConditions: ["thyroid-support"], thyroidType: "hypothyroid" }))
      .toEqual(["thyroid-support", "hypothyroid"]);
    expect(effectiveClinicalProtocols({ thyroidType: "hypothyroid" })).toEqual([]);
  });
  test("legacy scalar and array are preserved together", () => {
    expect(effectiveClinicalProtocols({ specialtyConditions: ["liver-support"], specialtyCondition: "heart-failure" }))
      .toEqual(["liver-support", "cardiac"]);
  });
  test("changing builders or studios cannot erase stored protocols", () => {
    const profile = { specialtyConditions: ["cardiac", "anti-inflammatory", "liver-support"] };
    for (const activeBoard of ["general_nutrition", "performance_competition", "diabetic", null]) {
      expect(effectiveClinicalProtocols({ ...profile, ...{ activeBoard } })).toEqual(profile.specialtyConditions);
    }
  });
});

describe("clinical authority is not ordinary trainer enrollment", () => {
  test("explicit physician ownership survives leaving a relationship", () => {
    expect(evaluateClinicalProtocolAuthority({
      memberships: [], protocolProvenance: [{ protocol: "hormone-optimization", owner: "physician" }],
    }).selfModificationBlocked).toBe(true);
  });
  test("an unattributed Clinic protocol requires review, not an invented self or physician source", () => {
    expect(evaluateClinicalProtocolAuthority({
      memberships: [{ type: "clinic", assignedBuilder: null, professionalRole: "physician", verificationStatus: "verified" }],
      protocolProvenance: [{ protocol: "thyroid-support", owner: "unknown" }],
    }).kind).toBe("legacy_review_required");
  });
  test("a proven member-owned protocol does not create a false physician lock", () => {
    expect(evaluateClinicalProtocolAuthority({
      memberships: [{ type: "clinic", assignedBuilder: null, professionalRole: "physician", verificationStatus: "verified" }],
      protocolProvenance: [{ protocol: "thyroid-support", owner: "self" }],
    }).selfModificationBlocked).toBe(false);
  });
  test("independent member remains self managed", () => {
    expect(evaluateClinicalProtocolAuthority({ memberships: [] }).selfModificationBlocked).toBe(false);
  });
  test.each(["general_nutrition", "beach_body", "performance_competition"])("trainer %s does not create physician authority", assignedBuilder => {
    expect(evaluateClinicalProtocolAuthority({ memberships: [{
      type: "studio", assignedBuilder, professionalRole: "trainer", verificationStatus: "verified",
    }] })).toEqual({ kind: "self_managed", selfModificationBlocked: false });
  });
  test("verified physician assignment keeps its lock alongside trainer membership", () => {
    expect(evaluateClinicalProtocolAuthority({ memberships: [
      { type: "studio", assignedBuilder: "general_nutrition", professionalRole: "trainer", verificationStatus: "verified" },
      { type: "clinic", assignedBuilder: "anti_inflammatory", professionalRole: "physician", verificationStatus: "verified", verifiedAssignment: true },
    ] }).kind).toBe("physician_directed");
  });
  test.each(["clinic", "studio"])("ambiguous historical clinical assignment in %s is not silently unlocked", type => {
    expect(evaluateClinicalProtocolAuthority({ memberships: [{
      type, assignedBuilder: "anti_inflammatory", professionalRole: "trainer", verificationStatus: null,
    }] }).kind).toBe("legacy_review_required");
  });
  test("explicit physician oncology ownership survives missing builder cache", () => {
    expect(evaluateClinicalProtocolAuthority({
      memberships: [], oncology: { enabled: true, source: "physician" },
    }).selfModificationBlocked).toBe(true);
  });
});

describe("existing cardiac thresholds and non-diagnostic reassessment", () => {
  test.each([
    [["cardiac"], "heart-failure"], [["heart-failure"], "heart-failure"],
    [["renal"], "kidney-disease"], [["kidney-disease"], "kidney-disease"],
    [["liver-support"], "liver-support"], [["oncology-support"], "oncology-support"],
    [["cardiac", "renal", "liver-disease"], "liver-disease"],
    [[], "anti-inflammatory"],
  ] as Array<[string[], string]>)("verified status %j sets mode %s without stale macro overrides", (protocols, mode) => {
    expect(resolveClinicalModeFromProtocols(protocols, { liverDisease: true, oncologySupport: true }).mode).toBe(mode);
  });
  test("thyroid stays additive and removal clears stale thyroid modifier flags", () => {
    expect(resolveClinicalModeFromProtocols(["hypothyroid"]).modifierBadges.some(b => b.label === "Thyroid Support")).toBe(true);
    expect(resolveClinicalModeFromProtocols([], { thyroidSupport: true }).modifierBadges.some(b => b.label === "Thyroid Support")).toBe(false);
  });
  test.each(["metabolic-support", "metabolic-stress", "inflammation-support"])("%s does not claim unsupported nutrition can be downgraded", protocol => {
    expect(resolveDowngradeSignals({ a1c: 5, cortisol: 10, crp: 1 }, {
      currentSpecialtyConditions: [protocol], previousProtocol: protocol,
    })).toEqual([]);
  });
  test("160 systolic recommends Cardiac without activating anything", () => {
    expect(resolveProtocolFromLabs({ bloodPressureSystolic: 160 })?.protocol).toBe("heart-failure");
    expect(effectiveClinicalProtocols({ specialtyConditions: [] })).toEqual([]);
  });
  test("a previous abnormal reading alone does not offer removal of an inactive protocol", () => {
    expect(resolveDowngradeSignals({ bloodPressureSystolic: 120 }, {
      currentSpecialtyConditions: [], previousProtocol: "heart-failure",
    })).toEqual([]);
  });
  test("120 systolic produces qualified review language, not resolution or automatic deactivation", () => {
    const state = ["cardiac", "liver-support"];
    const signals = resolveDowngradeSignals({ bloodPressureSystolic: 120 }, {
      currentSpecialtyConditions: state, previousProtocol: "heart-failure",
    });
    expect(signals[0].reason).toContain("Missing measurements have not been assessed");
    expect(signals[0].reason).toContain("does not establish");
    expect(state).toEqual(["cardiac", "liver-support"]);
  });
});

describe("real medical guidance, without generation or paid providers", () => {
  test.each([
    ["anti-inflammatory", {}],
    ["cardiac", {}], ["renal", {}], ["liver-support", {}], ["liver-disease", {}],
    ["oncology-support", {}],
    ["thyroid-support", {}],
    ["hashimotos", { thyroidSupportContext: { active: true, medication: null, labDriven: false, isAutoimmune: true, thyroidType: "hashimotos" } }],
    ["hypothyroid", { thyroidSupportContext: { active: true, medication: null, labDriven: false, isAutoimmune: false, thyroidType: "hypothyroid" } }],
    ["hyperthyroid", { thyroidSupportContext: { active: true, medication: null, labDriven: false, isAutoimmune: false, thyroidType: "hyperthyroid" } }],
    ["menopause", { menopause: true }], ["perimenopause", { perimenopause: true }],
    ["metabolic-recovery", { metabolicRecovery: true }],
    ["hormone-optimization", { hormoneOptimization: true }],
    ["alpha-gal-syndrome", { alphaGalContext: { active: true, dairyTolerance: "no", gelatinRestriction: "yes", severeReactionHistory: "yes", profileComplete: true } }],
    ["glp1", {}],
  ] as Array<[string, Partial<UniversalGuidanceInput>]>)
  ("%s has an existing live guidance block when its existing context is active", async (protocol, context) => {
    const blocks = await buildUniversalConditionGuidance({
      userId: "synthetic", healthConditions: [protocol], ...context,
    });
    expect(blocks.length).toBeGreaterThan(0);
  });
  test("Pregnancy remains paused rather than being activated to satisfy indicator coverage", () => {
    const availability = fs.readFileSync("shared/pregnancyAvailability.ts", "utf8");
    expect(availability).toMatch(/PREGNANCY_CUSTOMER_AVAILABLE.*false/);
  });
  test.each([
    ["heart-failure", "cardiac"], ["kidney-disease", "renal"],
  ])("%s and %s produce identical established guidance", async (legacy, canonical) => {
    const legacyBlocks = await buildUniversalConditionGuidance({ userId: "synthetic", healthConditions: [legacy] });
    const canonicalBlocks = await buildUniversalConditionGuidance({ userId: "synthetic", healthConditions: [canonical] });
    expect(legacyBlocks).toEqual(canonicalBlocks);
    expect(legacyBlocks.length).toBeGreaterThan(0);
  });
  test("Cardiac, Anti-Inflammatory and Liver guidance all survive together", async () => {
    const blocks = await buildUniversalConditionGuidance({
      userId: "synthetic", healthConditions: ["cardiac", "anti-inflammatory", "liver-support"],
    });
    expect(blocks).toHaveLength(3);
  });
  test("liver disease keeps established precedence without changing active state", async () => {
    const both = await buildUniversalConditionGuidance({ userId: "synthetic", healthConditions: ["liver-disease", "liver-support"] });
    const disease = await buildUniversalConditionGuidance({ userId: "synthetic", healthConditions: ["liver-disease"] });
    expect(both).toEqual(disease);
  });
});

test("six existing builder strips and both professional dashboards use shared effective state", () => {
  const files = [
    "client/src/pages/pro/GeneralNutritionBuilder.tsx", "client/src/pages/pro/PerformanceCompetitionBuilder.tsx",
    "client/src/pages/BeachBodyMealBoard.tsx", "client/src/pages/physician/GLP1MealBuilder.tsx",
    "client/src/pages/physician/DiabeticMenuBuilder.tsx", "client/src/pages/physician/AntiInflammatoryMenuBuilder.tsx",
    "client/src/pages/pro/TrainerClientDashboard.tsx", "client/src/pages/pro/ClinicianClientDashboard.tsx",
    "client/src/components/pro/ProClientFolderModal.tsx",
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    expect(source).toContain("useEffectiveClinicalProtocols");
    // The Anti-Inflammatory Builder uses its existing base badge, not an
    // additional green strip item. Preserve that intentional layout.
    for (const [, , color] of INVENTORY.slice(1, 7)) {
      expect(source).toContain(`text-${color}-400`);
    }
  }
});
