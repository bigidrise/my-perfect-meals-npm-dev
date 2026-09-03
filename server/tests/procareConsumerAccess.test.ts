import { evaluateConsumerProCareAccess } from "../../shared/procareConsumerAccess";
import { filterNutritionSummaryForProvider } from "../services/procareClientDataPolicy";

describe("consumer ProCare eligibility", () => {
  const decide = (planLookupKey: string, providerRole: string) =>
    evaluateConsumerProCareAccess({
      accessTier: "PAID_FULL",
      planLookupKey,
      providerRole,
    });

  it.each(["mpm_premium", "mpm_premium_monthly", "mpm_ultimate", "mpm_ultimate_monthly"])(
    "allows Pro-or-higher plan %s to connect with a trainer",
    (planLookupKey) => {
      expect(decide(planLookupKey, "trainer")).toMatchObject({ allowed: true, relationshipType: "coaching" });
    },
  );

  it.each(["mpm_free", "mpm_basic", "mpm_basic_monthly"])(
    "requires Pro for plan %s to connect with a trainer",
    (planLookupKey) => {
      expect(decide(planLookupKey, "trainer")).toMatchObject({
        allowed: false,
        code: "PRO_REQUIRED",
        requiredTier: "pro",
      });
    },
  );

  it("keeps physician, dietitian, and nurse-practitioner relationships Clinical-only", () => {
    for (const providerRole of ["physician", "dietitian", "nurse_practitioner"]) {
      expect(decide("mpm_premium", providerRole)).toMatchObject({
        allowed: false,
        code: "CLINICAL_REQUIRED",
      });
      expect(decide("mpm_ultimate_monthly", providerRole)).toMatchObject({ allowed: true });
    }
  });

  it("fails closed for unsupported provider roles", () => {
    expect(decide("mpm_ultimate_monthly", "business")).toMatchObject({
      allowed: false,
      code: "UNSUPPORTED_PROVIDER_ROLE",
    });
  });
});

describe("coach client-data filtering", () => {
  const summary: any = {
    activeInputs: {
      health: [{ key: "diabetes", label: "Diabetes", priority: "high" }],
      performance: { label: "Strength", detail: "" },
      pregnancy: { label: "Pregnancy", detail: "Week 12" },
      therapeutic: { label: "Therapeutic support", detail: "Semaglutide" },
      cuisine: null,
      dietary: ["Vegan"],
      goal: "Fat loss",
      macros: { calories: 1800, proteinG: 140, carbsG: 160, starchyCarbsG: 80, fibrousCarbsG: 80, fatG: 60 },
    },
    dietaryIdentity: ["Vegan"],
    mealBuilderLabel: null,
    nutritionDrivers: {
      medicalConditions: [{ key: "diabetes", label: "Diabetes", priority: "high" }],
      therapeuticInputs: [{ name: "Semaglutide", dose: "1 mg" }],
      liveMetrics: [{ label: "Glucose", value: "140 mg/dL" }],
    },
    nutritionPriorities: ["Manage blood glucose"],
    compositeExplanation: "Clinical explanation",
    conflictPolicy: "Safety first",
    hasAnyActiveProtocol: true,
    carbCycleActive: false,
    alphaGal: null,
    professionalUpdates: [{ id: "1", kind: "macros", title: "Clinical update", detail: "Dose", changedAt: "", href: "/" }],
    meta: { generatedAt: "2026-08-31T00:00:00.000Z" },
  };

  it("withholds Clinical-only fields from coaches and trainers", () => {
    const filtered = filterNutritionSummaryForProvider(summary, "trainer");
    expect(filtered.activeInputs.health).toEqual([]);
    expect(filtered.activeInputs.therapeutic).toBeNull();
    expect(filtered.activeInputs.pregnancy).toBeNull();
    expect(filtered.nutritionDrivers).toBeNull();
    expect(filtered.nutritionPriorities).toEqual([]);
    expect(filtered.professionalUpdates).toBeUndefined();
    expect(filtered.activeInputs.macros).toEqual(summary.activeInputs.macros);
    expect(filtered.activeInputs.performance).toEqual(summary.activeInputs.performance);
  });

  it("preserves the authorized Clinical summary for physicians", () => {
    expect(filterNutritionSummaryForProvider(summary, "physician")).toBe(summary);
  });
});