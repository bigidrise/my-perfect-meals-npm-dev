import {
  HYDRATION_DOOR_KEYS,
  buildLiquidExecutionPlan,
  canActivateLiquidProtocol,
  canHandoffLiquidProtocol,
  getProtocolUnresolvedItems,
  isLiquidProtocolExpired,
  liquidNutritionProtocolInputSchema,
  sickDayHydrationRequiresEscalation,
  type HydrationProtocolRecord,
} from "@shared/hydration/fourDoor";

const explicitInput = {
  reason: "Temporary procedure preparation",
  protocolType: "clear_liquid" as const,
  originalInstructionText: "Clear liquids from Monday through Tuesday. Sip with meals.",
  startsOn: "2026-08-31",
  endsOn: "2026-09-01",
  reviewOn: null,
  allowedCategories: ["broth", "clear juice"],
  restrictedCategories: ["solid food"],
  textureRequirements: ["no pulp"],
  explicitTimingText: "Sip with meals",
};

describe("four-door Hydration contracts", () => {
  it("keeps all four experiences inside one shared Hub model", () => {
    expect(HYDRATION_DOOR_KEYS).toEqual([
      "everyday",
      "athletic",
      "sick_day",
      "liquid_nutrition",
    ]);
  });

  it("accepts a time-bounded explicit instruction and rejects reversed dates", () => {
    expect(liquidNutritionProtocolInputSchema.parse(explicitInput)).toEqual(explicitInput);
    expect(() =>
      liquidNutritionProtocolInputSchema.parse({
        ...explicitInput,
        startsOn: "2026-09-02",
        endsOn: "2026-09-01",
      }),
    ).toThrow("End date must be on or after the start date");
  });

  it("builds dated checklist entries from supplied dates and preserves timing verbatim", () => {
    const plan = buildLiquidExecutionPlan(explicitInput);
    expect(plan.status).toBe("ready");
    expect(plan.days).toHaveLength(2);
    expect(plan.days.map((day) => day.date)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(plan.days.every((day) => day.timing.text === "Sip with meals")).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch(/targetMl|ouncesPerHour|sodiumMg|electrolyteDose/i);
  });

  it("leaves missing timing unresolved instead of constructing a schedule", () => {
    const plan = buildLiquidExecutionPlan({
      ...explicitInput,
      explicitTimingText: "",
    });
    expect(plan.status).toBe("needs_clarification");
    expect(plan.unresolvedItems).toContainEqual({
      code: "TIMING_NOT_STATED",
      label: "Timing or frequency was not stated.",
    });
    expect(plan.days.every((day) => day.timing.text === null)).toBe(true);
  });

  it("blocks activation when explicit item categories are absent or conflict", () => {
    const missing = getProtocolUnresolvedItems({
      allowedCategories: [],
      restrictedCategories: [],
      explicitTimingText: "As directed",
    });
    const conflicting = getProtocolUnresolvedItems({
      allowedCategories: ["broth"],
      restrictedCategories: ["Broth"],
      explicitTimingText: "As directed",
    });
    expect(canActivateLiquidProtocol(missing)).toBe(false);
    expect(canActivateLiquidProtocol(conflicting)).toBe(false);
    expect(conflicting.map((item) => item.code)).toContain("CONFLICTING_ITEM_CATEGORIES");
  });

  it("allows confirmation with explicit item categories while timing remains visibly unresolved", () => {
    const unresolved = getProtocolUnresolvedItems({
      allowedCategories: ["broth"],
      restrictedCategories: ["solid food"],
      explicitTimingText: "",
    });
    expect(unresolved.map((item) => item.code)).toEqual(["TIMING_NOT_STATED"]);
    expect(canActivateLiquidProtocol(unresolved)).toBe(true);
  });

  it("uses the subject local date when determining expiry", () => {
    expect(isLiquidProtocolExpired({ status: "active", endsOn: "2026-08-31" }, "2026-09-01")).toBe(true);
    expect(isLiquidProtocolExpired({ status: "active", endsOn: "2026-08-31" }, "2026-08-31")).toBe(false);
  });

  it("escalates warning signs without treating ordinary tolerability context as an emergency", () => {
    expect(sickDayHydrationRequiresEscalation(["nausea", "sore_throat"])).toBe(false);
    expect(sickDayHydrationRequiresEscalation(["unable_to_keep_fluids"])).toBe(true);
    expect(sickDayHydrationRequiresEscalation(["fainting_or_confusion"])).toBe(true);
  });

  it("allows Liquid Nutrition Creator handoff only for complete verified professional context", () => {
    const base = {
      status: "active",
      source: "professional_workflow",
      verificationStatus: "professionally_verified",
      unresolvedItems: [],
    } satisfies Pick<
      HydrationProtocolRecord,
      "status" | "source" | "verificationStatus" | "unresolvedItems"
    >;
    expect(canHandoffLiquidProtocol(base)).toBe(true);
    expect(canHandoffLiquidProtocol({ ...base, source: "user_entered", verificationStatus: "unverified" })).toBe(false);
    expect(canHandoffLiquidProtocol({
      ...base,
      unresolvedItems: [{ code: "TIMING_NOT_STATED", label: "Timing or frequency was not stated." }],
    })).toBe(false);
  });
});