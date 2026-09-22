import { Sprout } from "lucide-react";
import { buildNutritionPriorityLibraryTopics } from "@/lib/nutritionPriorityLibrary";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "@shared/nutritionPriorities";

describe("Nutrition Priority App Library", () => {
  it("builds all eight active concepts from the canonical registry", () => {
    const topics = buildNutritionPriorityLibraryTopics(Sprout);
    expect(topics).toHaveLength(8);
    expect(topics.map((topic) => topic.title)).toEqual(
      Object.values(FOOD_INCLUSION_PRIORITY_REGISTRY).map((entry) => entry.label),
    );
  });

  it("uses canonical education and citation records", () => {
    const topic = buildNutritionPriorityLibraryTopics(Sprout).find(
      (item) => item.id === "nutrition-priority-fermented_foods",
    )!;
    const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    expect(topic.content.sections[0].text).toBe(definition.whatItIs);
    expect(topic.content.sections[5].list).toBe(definition.limitations);
    expect(topic.citations).toBe(definition.citations);
    expect(topic.content.sections[5].list?.join(" ")).toMatch(
      /does not automatically mean probiotic/i,
    );
  });

  it("does not expose deferred concepts as active library topics", () => {
    const text = JSON.stringify(buildNutritionPriorityLibraryTopics(Sprout));
    expect(text).not.toMatch(/prebiotic|potassium|ginger|turmeric/i);
  });
});