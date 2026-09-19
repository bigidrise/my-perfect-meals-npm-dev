import { normalizeGeneratedMenuResponse } from "../services/myPerfectMenu/normalizeGeneratedConcepts";
import { foodIdentitySchema } from "../../shared/foodIdentity";

describe("My Perfect Menu generated response normalization", () => {
  it("removes irrelevant snack identity metadata from breakfast concepts", () => {
    const normalized = normalizeGeneratedMenuResponse({
      concepts: [{
        title: "Roasted Tomato Breakfast Toast",
        foodIdentity: {
          foodRole: "general_snack",
          polarity: "savory",
          formatFamily: "toast",
          preparationStyle: "roasted",
        },
      }],
    }, "breakfast") as { concepts: Array<Record<string, unknown>> };

    expect(normalized.concepts[0]).not.toHaveProperty("foodIdentity");
  });

  it("repairs open-world snack formats into the bounded snack identity contract", () => {
    const normalized = normalizeGeneratedMenuResponse({
      concepts: [{
        title: "Crunchy Black Bean Taco",
        description: "A savory taco with cabbage and salsa.",
        primaryIngredients: ["black beans", "corn tortilla", "cabbage", "salsa"],
        foodIdentity: {
          foodRole: "general_snack",
          polarity: "savory",
          formatFamily: "taco",
          preparationStyle: "assembled",
          texture: "crunchy",
        },
      }],
    }, "snack") as { concepts: Array<Record<string, unknown>> };

    expect(foodIdentitySchema.safeParse(normalized.concepts[0].foodIdentity).success).toBe(true);
    expect(normalized.concepts[0].foodIdentity).toEqual(expect.objectContaining({
      foodRole: "general_snack",
      polarity: "savory",
      formatFamily: "general_snack",
    }));
  });
});