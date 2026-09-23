import {
  emptyOneTouchHistory,
  intentTypeForCreatorRequest,
  oneTouchCuisineSchema,
  oneTouchEatingStyleSchema,
  oneTouchRequestSchema,
} from "../../shared/oneTouch";
import { generateOneTouchDirections } from "../services/oneTouch/directions";

const candidate = (title: string, form: string) => ({
  title,
  description: `${title} with varied ingredients.`,
  primaryIngredients: ["lentils", "tomatoes", "herbs"],
  primaryProtein: "lentils",
  produceItems: ["tomatoes"],
  cuisine: "Mediterranean",
  dietaryEvidence: [],
  preparationMethod: "roasted",
  signature: `${title}|roasted|lentils`,
  culinaryIdentity: {
    dishForm: form,
    preparationStyle: "roasted",
    temperature: "hot" as const,
    primaryProteinBase: "lentils",
    majorStarchBase: null,
    flavorFamily: title,
    cuisineEvidence: "Mediterranean",
    definingComponents: ["lentils", "tomatoes"],
  },
});

describe("One-Touch server foundation", () => {
  it("discards malformed advisory evidence and repairs temperature without bypassing direction safety", async () => {
    const concepts = [
      candidate("Roasted Lentil Skillet", "skillet"),
      candidate("Lentil Stuffed Peppers", "stuffed pepper"),
      candidate("Lentil Herb Wrap", "wrap"),
    ].map((concept) => ({
      ...concept,
      dietaryEvidence: "a model claim, not verified evidence",
      culinaryIdentity: { ...concept.culinaryIdentity, temperature: "ambient" },
    }));
    const validate = jest.fn(() => []);
    const result = await generateOneTouchDirections({
      occasion: "lunch",
      history: [],
      generate: async () => ({ concepts }),
      validate,
    });
    expect(result.directions).toHaveLength(3);
    expect(validate).toHaveBeenCalledTimes(3);
    expect(result.directions.every((direction) => direction.dietaryEvidence.length === 0)).toBe(true);
    expect(result.directions.every((direction) => direction.culinaryIdentity.temperature !== "ambient")).toBe(true);
  });

  it("accepts only meal-level browser controls", () => {
    expect(oneTouchRequestSchema.safeParse({
      creator: "craving_creator",
      servings: 4,
      cuisine: { mode: "surprise" },
      eatingStyle: { mode: "profile" },
    }).success).toBe(true);
    expect(oneTouchRequestSchema.safeParse({
      creator: "craving_creator",
      servings: 4,
      cuisine: { mode: "profile" },
      eatingStyle: { mode: "profile" },
      subjectUserId: "attacker-controlled",
      allergies: ["shrimp"],
    }).success).toBe(false);
    expect(oneTouchCuisineSchema.safeParse({ mode: "explicit", value: "Chinese" }).success).toBe(true);
    expect(oneTouchEatingStyleSchema.safeParse({ mode: "explicit", value: "Vegan" }).success).toBe(true);
    const craving = {
      creator: "craving_creator", servings: 2,
      cuisine: { mode: "profile" }, eatingStyle: { mode: "profile" },
      cravingType: "food", cravingFeel: "sweet",
    };
    expect(oneTouchRequestSchema.safeParse(craving).success).toBe(true);
    expect(oneTouchRequestSchema.safeParse({ ...craving, cravingType: "dessert", cravingFeel: "light" }).success).toBe(true);
    expect(oneTouchRequestSchema.safeParse({ ...craving, creator: "create_a_dish" }).success).toBe(false);
    expect(oneTouchRequestSchema.safeParse({ ...craving, cravingFeel: "clinical" }).success).toBe(false);
  });

  it("keeps manual and delegated intent types distinct", () => {
    expect(intentTypeForCreatorRequest(false)).toBe("explicit_craving");
    expect(intentTypeForCreatorRequest(true)).toBe("one_touch_delegated");
  });

  it("keeps One-Touch history separate from MPM history", () => {
    expect(emptyOneTouchHistory()).toEqual({ version: 1, create_a_dish: [], craving_creator: [] });
  });

  it("retains valid siblings and requests only missing positions", async () => {
    const requests: number[] = [];
    const result = await generateOneTouchDirections({
      occasion: "lunch",
      history: [],
      generate: async ({ requestedCount }) => {
        requests.push(requestedCount);
        return { concepts: requests.length === 1
          ? [candidate("Roasted Lentil Skillet", "skillet"), candidate("Invalid", "skillet")]
          : [candidate("Lentil Stuffed Peppers", "stuffed pepper"), candidate("Lentil Herb Wrap", "wrap")] };
      },
      validate: (direction) => direction.title === "Invalid" ? ["allergy:shrimp"] : [],
    });
    expect(result.directions).toHaveLength(3);
    expect(requests).toEqual([3, 2]);
  });

  it("bounds completion and never returns a partial set", async () => {
    const requests: number[] = [];
    await expect(generateOneTouchDirections({
      occasion: "dinner",
      history: [],
      generate: async ({ requestedCount }) => {
        requests.push(requestedCount);
        return { concepts: [candidate("Repeated Dinner", "skillet")] };
      },
      validate: () => ["forbidden_ingredient:shrimp"],
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED", attemptsCompleted: 3 });
    expect(requests).toHaveLength(3);
  });
});