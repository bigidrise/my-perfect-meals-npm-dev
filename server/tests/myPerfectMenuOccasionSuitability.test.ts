jest.mock("../utils/openaiSafe", () => ({ chatJson: jest.fn() }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  developmentMenuOccasionEnabled, MENU_OCCASION_GUIDANCE,
  validateMenuOccasionBatch, type OccasionFood,
} from "../services/myPerfectMenu/occasionSuitability";
import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";
import { conceptCompletionFailure } from "../services/myPerfectMenu/candidateCompletion";
import { rejectionCategoryCounts } from "../services/myPerfectMenu/generationContract";
import type { MyPerfectMenuCategory } from "../../shared/myPerfectMenuCategory";

const assessment = (id: number, fit = "appropriate", identity = "preserved") => ({
  id, fit, identity, reason: "Assessed actual dish preparation and accompaniments.",
});
const food: OccasionFood = {
  title: "Spinach and Feta Egg Bake",
  description: "Eggs baked with spinach and feta.",
  primaryIngredients: ["eggs", "spinach", "feta"],
  cuisine: "American", preparationMethod: "baked",
};
const concept = (title: string, form: string, ingredients: string[]) => ({
  title, description: `A ${form} prepared with ${ingredients.join(", ")}.`,
  primaryIngredients: ingredients, primaryProtein: ingredients[0], produceItems: [],
  cuisine: "American", dietaryEvidence: [], preparationMethod: "pan cooked",
  signature: `${form}|${ingredients.join("|")}`,
  culinaryIdentity: {
    dishForm: form, preparationStyle: "pan cooked", temperature: "hot",
    primaryProteinBase: ingredients[0], majorStarchBase: null,
    flavorFamily: title, cuisineEvidence: "American", definingComponents: ingredients,
  },
});
const eggs = concept("Spinach Feta Egg Bake", "egg bake", ["eggs", "spinach", "feta"]);
const hash = concept("Turkey Sweet Potato Hash", "hash", ["turkey", "sweet potato", "herbs"]);
const salmon = concept("Breakfast Oven-Baked Salmon with Asparagus", "fillet with side", ["salmon", "asparagus", "lemon"]);
const pancakes = concept("Oat Banana Pancakes", "pancakes", ["oats", "banana", "milk"]);

describe("Development-only menu occasion suitability", () => {
  it.each([
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "test" }, false],
    [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" }, false],
    [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "0" }, false],
  ])("uses only the unpublished Development runtime %j", (env, enabled) => {
    expect(developmentMenuOccasionEnabled(env)).toBe(enabled);
  });

  it.each(["breakfast", "lunch", "dinner", "snack"] as MyPerfectMenuCategory[])(
    "independently reviews actual %s food evidence", async occasion => {
      const assess = jest.fn(async ({ system, user }) => {
        expect(system).toContain(MENU_OCCASION_GUIDANCE[occasion]);
        expect(system).toContain("A label or a story alone is not evidence");
        expect(system).toContain("Do not invent clinical rules");
        expect(JSON.parse(user).foods[0].primaryIngredients).toEqual(food.primaryIngredients);
        return { assessments: [assessment(0)] };
      });
      await expect(validateMenuOccasionBatch(occasion, [food], { assess })).resolves.toEqual([[]]);
      expect(assess).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "Japanese Salmon, Rice and Miso Breakfast",
    "Chicken Congee",
    "Mexican Chilaquiles",
    "Indian Idli with Sambar",
    "Spanish Potato Tortilla",
    "High-Protein Turkey and Sweet Potato Hash",
    "Carnivore Steak and Eggs",
    "Vegan Tofu Scramble",
  ])("does not impose an ingredient or Western-breakfast whitelist on %s", async title => {
    await expect(validateMenuOccasionBatch("breakfast", [{ ...food, title }], {
      assess: async () => ({ assessments: [assessment(0)] }),
    })).resolves.toEqual([[]]);
  });

  it("maps out-of-order assessments to the correct candidates", async () => {
    const result = await validateMenuOccasionBatch("breakfast", [salmon, eggs], {
      assess: async () => ({ assessments: [assessment(1), assessment(0, "inappropriate")] }),
    });
    expect(result[0][0]).toContain("occasion_fit:breakfast:inappropriate");
    expect(result[1]).toEqual([]);
  });

  it("keeps initial occasion fit separate from irrelevant recipe-identity metadata", async () => {
    const issues = await validateMenuOccasionBatch("dinner", [salmon], {
      assess: async () => ({ assessments: [assessment(0, "appropriate", "inappropriate")] }),
    });
    expect(issues).toEqual([[]]);
    await expect(validateMenuOccasionBatch("dinner", [salmon], {
      selectedIdea: salmon,
      assess: async () => ({ assessments: [assessment(0, "appropriate", "inappropriate")] }),
    })).rejects.toMatchObject({ code: "MY_PERFECT_MENU_OCCASION_CHECK_UNAVAILABLE" });
  });

  it.each([
    { assessments: [] },
    { assessments: [assessment(1)] },
    { assessments: [assessment(0), assessment(0)] },
    { assessments: [{ id: 0, fit: "yes", identity: "preserved", reason: "Approved" }] },
    { assessments: [{ id: 0, fit: "appropriate", identity: "preserved" }] },
  ])("fails closed for malformed, duplicate, or missing assessment evidence", async raw => {
    await expect(validateMenuOccasionBatch("breakfast", [food], {
      assess: async () => raw,
    })).rejects.toMatchObject({ status: 502, code: "MY_PERFECT_MENU_OCCASION_CHECK_UNAVAILABLE" });
  });

  it("does not silently accept provider failure", async () => {
    await expect(validateMenuOccasionBatch("breakfast", [food], {
      assess: async () => { throw new Error("provider unavailable"); },
    })).rejects.toMatchObject({ status: 502 });
  });

  it("does not call a provider when there are no eligible candidates", async () => {
    const assess = jest.fn();
    expect(await validateMenuOccasionBatch("dinner", [], { assess })).toEqual([]);
    expect(assess).not.toHaveBeenCalled();
  });

  it("rejects recipe identity drift even when the new dish fits the occasion", async () => {
    const issues = await validateMenuOccasionBatch("breakfast", [pancakes], {
      selectedIdea: eggs,
      assess: async ({ system, user }) => {
        expect(system).toContain("not its destination Meal 1–6 slot");
        expect(JSON.parse(user).selectedIdea.title).toBe(eggs.title);
        return { assessments: [assessment(0, "appropriate", "changed")] };
      },
    });
    expect(issues[0][0]).toContain("occasion_identity:changed");
  });

  it("retains valid breakfasts and replaces only the mislabeled dinner-style entrée", async () => {
    const generate = jest.fn(async ({ requestedCount, user }) => {
      if (generate.mock.calls.length === 1) return { concepts: [salmon, eggs, hash] };
      expect(requestedCount).toBe(1);
      expect(user).toContain("Do not fix a mismatch by just adding the meal-type name");
      expect(user).toContain(salmon.title);
      expect(user).toContain('"retainedCandidates"');
      return { concepts: [pancakes] };
    });
    const result = await generateCulinaryConcepts({
      occasion: "breakfast", subjectLabel: "synthetic person",
      userContext: ["Existing high-protein targets and clinical restrictions stay authoritative"],
      requiredCuisine: null, history: [], validate: () => [],
      extraInstructions: [MENU_OCCASION_GUIDANCE.breakfast],
      validateBatch: candidates => validateMenuOccasionBatch("breakfast", candidates, {
        assess: async () => ({
          assessments: candidates.map((candidate, id) =>
            assessment(id, candidate.title === salmon.title ? "inappropriate" : "appropriate")),
        }),
      }),
      generate,
    });
    expect(result.concepts.map(item => item.title)).toEqual(expect.arrayContaining([
      eggs.title, hash.title, pancakes.title,
    ]));
    expect(result.concepts).not.toEqual(expect.arrayContaining([expect.objectContaining({ title: salmon.title })]));
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("never allows culinary approval to override allergies, diet, or clinical rejections", async () => {
    const validateBatch = jest.fn(async (candidates) => candidates.map(() => []));
    const generate = jest.fn(async () => ({ concepts: [salmon, eggs, hash] }));
    await expect(generateCulinaryConcepts({
      occasion: "breakfast", subjectLabel: "synthetic clinical profile",
      userContext: ["Physician guidance unchanged"], requiredCuisine: null, history: [],
      validate: () => ["protocol:physician_restriction", "dietary:vegan", "allergen:milk"],
      validateBatch, generate,
    })).rejects.toMatchObject({ code: "CONCEPT_REPAIR_EXHAUSTED" });
    expect(validateBatch.mock.calls.every(([candidates]) => candidates.length === 0)).toBe(true);
  });

  it("reports occasion exhaustion as culinary failure, not a medical prohibition", () => {
    const counts = rejectionCategoryCounts(["occasion_fit:breakfast:inappropriate:entrée"]);
    expect(counts).toEqual({ occasion_suitability: 1 });
    expect(conceptCompletionFailure(counts, 0)).toMatchObject({
      code: "CONCEPT_OCCASION_COMPLETION_FAILED",
    });
  });

  it("requires recipe review before board addition while preserving destination freedom and snack checks", () => {
    const page = readFileSync(join(process.cwd(), "client/src/pages/MyPerfectMenu.tsx"), "utf8");
    const route = readFileSync(join(process.cwd(), "server/routes/myPerfectMenu.ts"), "utf8");
    expect(page.indexOf('validationPayload.occasionSuitabilityRequired ? "completedMeal"'))
      .toBeLessThan(page.indexOf("await addCompletedMeal(destination, finalMeal"));
    expect(page).toContain("mealSlot: destination.slot");
    expect(page).toContain("Original intended eating occasion: ${conceptToGenerate.ideaType}");
    expect(route).toContain("validateMenuOccasionBatch(concept.ideaType");
    expect(route).toContain("completedSnackMatchesConcept(concept, completed)");
    expect(route).toContain("developmentMenuOccasionEnabled() && parsed.data.completedMeal");
  });
});
