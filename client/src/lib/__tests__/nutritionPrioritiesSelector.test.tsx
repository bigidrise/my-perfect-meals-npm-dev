import { renderToStaticMarkup } from "react-dom/server";
import {
  ACTIVE_NUTRITION_PRIORITY_DEFINITIONS,
  NutritionPrioritiesSelector,
  toggleNutritionPrioritySelection,
} from "@/components/NutritionPrioritiesSelector";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "@shared/nutritionPriorities";

describe("NutritionPrioritiesSelector", () => {
  it("renders only the eight active central-registry concepts", () => {
    const html = renderToStaticMarkup(
      <NutritionPrioritiesSelector
        selectedPriorityIds={[]}
        onChange={() => {}}
      />,
    );

    expect(ACTIVE_NUTRITION_PRIORITY_DEFINITIONS).toHaveLength(8);
    for (const definition of ACTIVE_NUTRITION_PRIORITY_DEFINITIONS) {
      expect(html).toContain(definition.label);
    }
    for (const deferred of ["Prebiotic-Rich Foods", "Potassium-Rich Foods", "Ginger", "Turmeric"]) {
      expect(html).not.toContain(deferred);
    }
  });

  it("supports independent multi-select and a valid empty selection", () => {
    expect(toggleNutritionPrioritySelection([], "fiber_rich_foods")).toEqual(["fiber_rich_foods"]);
    expect(toggleNutritionPrioritySelection(
      ["fiber_rich_foods"],
      "calcium_rich_foods",
    )).toEqual(["fiber_rich_foods", "calcium_rich_foods"]);
    expect(toggleNutritionPrioritySelection(
      ["fiber_rich_foods"],
      "fiber_rich_foods",
    )).toEqual([]);
  });

  it("uses the central registry objects as the Learn More source", () => {
    const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    expect(ACTIVE_NUTRITION_PRIORITY_DEFINITIONS.find((item) => item.id === "fermented_foods")).toBe(definition);
    expect(definition.whatItIs).toBeTruthy();
    expect(definition.whyChooseIt).toBeTruthy();
    expect(definition.whatMpmDoes).toBeTruthy();
    expect(definition.limitations).toContain("Fermented does not automatically mean probiotic.");
  });
});
