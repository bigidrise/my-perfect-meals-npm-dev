import {
  buildMyPerfectMenuReturnTarget,
  sanitizeMyPerfectMenuReturnTarget,
} from "../myPerfectMenuReturn";

describe("My Perfect Menu Builder return contract", () => {
  it.each(["breakfast", "lunch", "dinner", "snack"] as const)(
    "round-trips the %s category with the originating Builder identity",
    (category) => {
      const target = buildMyPerfectMenuReturnTarget({
        builderKey: "general_nutrition",
        category,
        selectedConceptId: `${category}-concept-a`,
      });
      expect(sanitizeMyPerfectMenuReturnTarget(target)).toBe(target);
      expect(new URL(target, "https://local.test").searchParams.get("category")).toBe(category);
      expect(new URL(target, "https://local.test").searchParams.get("builder")).toBe("general_nutrition");
    },
  );

  it("keeps the same active category identity while A, B, and C are inspected", () => {
    const activeConceptIds = ["breakfast-a", "breakfast-b", "breakfast-c"];
    const targets = activeConceptIds.map((selectedConceptId) => buildMyPerfectMenuReturnTarget({
      builderKey: "diabetic",
      category: "breakfast",
      selectedConceptId,
    }));

    expect(targets.map((target) => {
      const params = new URL(target, "https://local.test").searchParams;
      return [params.get("builder"), params.get("category")];
    })).toEqual([
      ["diabetic", "breakfast"],
      ["diabetic", "breakfast"],
      ["diabetic", "breakfast"],
    ]);
    expect(targets.map((target) => new URL(target, "https://local.test").searchParams.get("selectedConceptId")))
      .toEqual(activeConceptIds);
  });

  it("preserves an authorized household subject without falling back to owner context", () => {
    const householdProfileId = "018f8f7c-2ac4-4df7-8bb5-5525aa31b115";
    const target = buildMyPerfectMenuReturnTarget({
      builderKey: "glp1",
      category: "lunch",
      householdProfileId,
      selectedConceptId: "lunch-concept-a",
    });
    expect(new URL(target, "https://local.test").searchParams.get("householdProfileId"))
      .toBe(householdProfileId);
    expect(sanitizeMyPerfectMenuReturnTarget(target)).toBe(target);
  });

  it("keeps adult and household return identities isolated", () => {
    const adultTarget = buildMyPerfectMenuReturnTarget({
      builderKey: "anti_inflammatory",
      category: "dinner",
    });
    const householdTarget = buildMyPerfectMenuReturnTarget({
      builderKey: "anti_inflammatory",
      category: "dinner",
      householdProfileId: "018f8f7c-2ac4-4df7-8bb5-5525aa31b115",
    });
    expect(adultTarget).not.toContain("householdProfileId");
    expect(householdTarget).toContain("householdProfileId");
    expect(adultTarget).not.toBe(householdTarget);
  });

  it("preserves the exact Performance destination date and slot", () => {
    const target = buildMyPerfectMenuReturnTarget({
      builderKey: "performance_competition",
      category: "dinner",
      destinationDate: "2026-09-25",
      destinationSlot: "meal5",
      selectedConceptId: "dinner-concept-a",
    });
    const params = new URL(target, "https://local.test").searchParams;
    expect(params.get("destinationDate")).toBe("2026-09-25");
    expect(params.get("destinationSlot")).toBe("meal5");
    expect(sanitizeMyPerfectMenuReturnTarget(target)).toBe(target);
  });

  it.each([
    "https://evil.example/foods-i-enjoy?builder=diabetic&category=lunch",
    "//evil.example/foods-i-enjoy?builder=diabetic&category=lunch",
    "/foods-i-enjoy?builder=unknown&category=lunch",
    "/foods-i-enjoy?builder=diabetic&category=unknown",
    "/foods-i-enjoy?builder=diabetic&category=lunch&householdProfileId=owner",
    "/foods-i-enjoy?builder=diabetic&category=lunch&destinationDate=tomorrow",
    "/foods-i-enjoy?builder=diabetic&category=lunch&unexpected=1",
  ])("rejects unsafe or incomplete return target %s", (target) => {
    expect(sanitizeMyPerfectMenuReturnTarget(target)).toBeNull();
  });
});