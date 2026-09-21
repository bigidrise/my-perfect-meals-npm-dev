import {
  adultNutritionPrioritiesQueryKey,
  childNutritionPrioritiesQueryKey,
  scopeChildNutritionPrioritiesDraft,
} from "@/hooks/useNutritionPriorities";

describe("Nutrition Priorities query identity", () => {
  it("keeps adult and child caches separate", () => {
    expect(adultNutritionPrioritiesQueryKey("parent-a")).toEqual([
      "nutrition-priorities",
      "adult",
      "parent-a",
    ]);
    expect(childNutritionPrioritiesQueryKey("parent-a", "child-a")).toEqual([
      "nutrition-priorities",
      "child",
      "parent-a",
      "child-a",
    ]);
  });

  it("keeps Child A and Child B in separate actor-scoped caches", () => {
    expect(childNutritionPrioritiesQueryKey("parent-a", "child-a")).not.toEqual(
      childNutritionPrioritiesQueryKey("parent-a", "child-b"),
    );
    expect(childNutritionPrioritiesQueryKey("parent-a", "child-a")).not.toEqual(
      childNutritionPrioritiesQueryKey("parent-b", "child-a"),
    );
  });

  it("drops Child A values synchronously when the child identity changes", () => {
    const childA = {
      identity: "parent-a:child-a",
      selectedPriorityIds: ["fiber_rich_foods" as const],
      isDirty: true,
    };
    expect(scopeChildNutritionPrioritiesDraft(childA, "parent-a:child-b")).toEqual({
      identity: "parent-a:child-b",
      selectedPriorityIds: [],
      isDirty: false,
    });
  });

  it("drops a new-child draft before an existing child can use it", () => {
    const newChildDraft = {
      identity: "parent-a:new",
      selectedPriorityIds: ["iron_rich_foods" as const],
      isDirty: true,
    };
    expect(scopeChildNutritionPrioritiesDraft(newChildDraft, "parent-a:child-b")).toEqual({
      identity: "parent-a:child-b",
      selectedPriorityIds: [],
      isDirty: false,
    });
  });
});