import type { OneTouchDirection } from "@shared/oneTouch";
import {
  generateOneTouchDirections, validateCravingConcept, validateDishConcept,
} from "../services/oneTouch/directions";

function concept(title: string, form: string, foodRole: "dessert" | "general_snack" = "general_snack",
  polarity: "sweet" | "savory" = "savory") {
  return {
    title, description: `A prepared ${title} with tomatoes and lentils.`,
    primaryIngredients: ["tomatoes", "lentils"], primaryProtein: "lentils",
    produceItems: ["tomatoes"], cuisine: "Italian", dietaryEvidence: [],
    preparationMethod: "simmered", signature: `${form}|lentils|${title}`,
    culinaryIdentity: {
      dishForm: form, preparationStyle: "simmered", temperature: "hot" as const,
      primaryProteinBase: "lentils", majorStarchBase: null,
      flavorFamily: title, cuisineEvidence: "Italian",
      definingComponents: ["tomatoes", "lentils"],
    },
    foodIdentity: {
      foodRole, polarity,
      formatFamily: foodRole === "dessert" ? "cheesecake" as const : "general_snack" as const,
    },
  };
}

describe("Creator Menu culinary concepts, separate from clinical meal slots", () => {
  it("generates exactly three coherent DISH concepts and rejects a generic composed plate", async () => {
    const attempts: number[] = [];
    let prompt = "";
    const result = await generateOneTouchDirections({
      menuShape: "dish", occasion: "lunch", targetCount: 3,
      history: [], validate: () => [],
      generate: async ({ requestedCount, ...rest }) => {
        attempts.push(requestedCount);
        prompt = (rest as { system: string }).system ?? prompt;
        return { concepts: attempts.length === 1
          ? [
              concept("Grilled Protein Plate", "plate"),
              concept("Tomato Lentil Stew", "stew"),
              concept("Vegetable Lasagna", "lasagna"),
            ] : [concept("Mushroom Lentil Chili", "chili")] };
      },
    });
    expect(result.directions).toHaveLength(3);
    expect(result.directions.map((item) => item.title)).not.toContain("Grilled Protein Plate");
    expect(result.directions.every((item) => validateDishConcept(item).length === 0)).toBe(true);
    expect(attempts).toEqual([3, 1]);
    // The shared engine only applies the dish instruction when explicitly requested.
    expect(prompt).toContain("DISH MENU");
    expect(prompt).toContain("ONE recognizable culinary preparation");
    expect(validateDishConcept({
      ...result.directions[0], title: "lentils", primaryIngredients: ["lentils", "tomatoes"],
    })).toContain("culinary_shape:not_a_dish");
  });

  it.each([
    ["surprise", "surprise", "general_snack", "savory"],
    ["food", "salty", "general_snack", "savory"],
    ["food", "light", "general_snack", "savory"],
    ["food", "hearty", "general_snack", "savory"],
    ["dessert", "sweet", "dessert", "sweet"],
    ["dessert", "light", "dessert", "sweet"],
    ["surprise", "salty", "general_snack", "savory"],
    ["food", "sweet", "general_snack", "sweet"],
  ] as const)(
    "Craving Type %s and Feel %s independently guide broad Snack concepts",
    async (type, feel, role, polarity) => {
      let prompt = "";
      const item = concept(`Tomato Lentil ${type} ${feel}`, "stew", role, polarity);
      const result = await generateOneTouchDirections({
        menuShape: "craving", occasion: "snack", targetCount: 1,
        cravingType: type, cravingFeel: feel, history: [], validate: () => [],
        generate: async (request) => {
          prompt = JSON.stringify(request);
          return { concepts: [item] };
        },
      });
      expect(result.directions).toHaveLength(1);
      expect(result.directions[0].occasion).toBe("snack");
      expect(validateCravingConcept(result.directions[0], type, feel)).toEqual([]);
      expect(prompt).toContain("Snack describes the eating occasion");
      expect(prompt).toContain("Do not define appropriateness by a universal calorie range");
      if (feel !== "surprise") expect(prompt).toContain("light/hearty impose no calorie or portion target");
      if (type !== "surprise") expect(prompt).toContain(`Craving Type: ${type}`);
      if (feel !== "surprise") expect(prompt).toContain(`Craving Feel: ${feel}`);
    },
  );

  it("rejects contradictory Type or Feel metadata without conflating Sweet and Dessert", () => {
    const base = { ...concept("Savory Tacos", "taco"), occasion: "snack" } as OneTouchDirection;
    expect(validateCravingConcept(base, "dessert", "surprise")).toContain("craving_type:dessert");
    expect(validateCravingConcept(base, "food", "sweet")).toContain("craving_feel:sweet");
    expect(validateCravingConcept({
      ...base, foodIdentity: { foodRole: "general_snack", polarity: "sweet", formatFamily: "general_snack" },
    }, "food", "sweet")).toEqual([]);
    expect(validateCravingConcept({
      ...base, foodIdentity: { foodRole: "dessert", polarity: "savory", formatFamily: "cheesecake" },
    }, "surprise", "salty")).toEqual([]);
  });
});