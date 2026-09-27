jest.mock("../db", () => ({ db: {} }));

import {
  enforceSafetyProfileSync,
  validateGeneratedMeal,
  type SafetyProfile,
} from "../services/safetyProfileService";
import {
  buildAllergenAdaptPromptBlock, getRequestedDishExemptTerms,
  scanMealsForAllergenViolations,
} from "../services/allergyGuardrails";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";

const shellfishProfile: SafetyProfile = {
  userId: "test",
  allergies: ["shellfish"],
  dietaryRestrictions: [],
  healthConditions: [],
  avoidIngredients: [],
};

const intent = (requestedDish: string, explicitIngredients: string[] = []) => ({
  kind: "food_intent" as const, requestedDish, explicitIngredients,
});

describe("one intent-versus-recipe safety boundary", () => {
  test.each([
    "gumbo",
    "chicken gumbo",
    "beef and cauliflower stir-fry",
    "Thai chicken curry",
    "roasted chicken with a Cajun cooking method",
  ])("%s is not itself evidence of shellfish", (dish) => {
    expect(enforceSafetyProfileSync(shellfishProfile, intent(dish)).result).toBe("SAFE");
  });

  test("an explicit allergen in a dish request is still blocked", () => {
    const check = enforceSafetyProfileSync(shellfishProfile, intent("shrimp gumbo"));
    expect(check.result).toBe("BLOCKED");
    expect(check.blockedTerms).toContain("shrimp");
  });

  test("structured explicit ingredients remain authoritative", () => {
    expect(enforceSafetyProfileSync(shellfishProfile, intent("gumbo", ["shrimp stock"])).result).toBe("BLOCKED");
    expect(enforceSafetyProfileSync(shellfishProfile, intent("", ["beef", "cauliflower"])).result).toBe("SAFE");
    // A purchased/compound gumbo base is an unverified ingredient; unlike a
    // requested dish title it cannot be assumed free of shellfish.
    expect(enforceSafetyProfileSync(shellfishProfile, intent("chicken soup", ["gumbo base"])).result).toBe("BLOCKED");
  });

  test("generation receives a hard allergen exclusion without forbidding its dish identity", () => {
    const prompt = buildAllergenAdaptPromptBlock(["shellfish"], "gumbo");
    expect(prompt).toContain("PROHIBITED ALLERGEN — SHELLFISH");
    expect(prompt).toContain("stocks, broths, pastes, sauces");
    expect(prompt).toContain('requested dish is "gumbo"');
    expect(prompt).not.toMatch(/PROHIBITED ALLERGEN[^\n]*gumbo/i);
  });

  test("a real shellfish ingredient fails the finished-recipe check; a recognizable safe dish passes", () => {
    const safe = {
      name: "Chicken Gumbo",
      description: "A hearty Cajun stew",
      ingredients: [{ name: "chicken" }, { name: "okra" }, { name: "onion" }],
      instructions: ["Simmer the chicken with the vegetables."],
    };
    expect(validateGeneratedMeal(safe, shellfishProfile).result).toBe("SAFE");
    expect(validateDishIdentity("gumbo", safe).passed).toBe(true);
    expect(validateGeneratedMeal({
      ...safe,
      ingredients: [...safe.ingredients, { name: "shrimp" }, { name: "shellfish stock" }],
    }, shellfishProfile).result).toBe("BLOCKED");
  });

  test("known derivatives and other allergies remain hard conflicts", () => {
    const profile = { ...shellfishProfile, allergies: ["shellfish", "dairy"] };
    expect(enforceSafetyProfileSync(profile, intent("gumbo", ["whey"])).blockedCategories).toContain("dairy");
    expect(validateGeneratedMeal({
      name: "Gumbo",
      ingredients: [{ name: "chicken" }, { name: "shrimp paste" }],
    }, profile).result).toBe("BLOCKED");
  });

  test("a negative allergy statement is not an added ingredient, but later affirmative use is", () => {
    const safe = {
      name: "Shellfish-free Gumbo",
      description: "Gumbo without shrimp.",
      ingredients: [{ name: "chicken" }, { name: "okra" }],
      instructions: ["Do not add shellfish stock."],
    };
    expect(validateGeneratedMeal(safe, shellfishProfile).result).toBe("SAFE");
    expect(validateGeneratedMeal({
      ...safe, instructions: ["Do not add shellfish stock. Add shrimp paste."],
    }, shellfishProfile).result).toBe("BLOCKED");
    const exemptTerms = new Set(getRequestedDishExemptTerms("gumbo", ["shellfish"]));
    expect(scanMealsForAllergenViolations([safe], ["shellfish"], exemptTerms).safe).toHaveLength(1);
    expect(scanMealsForAllergenViolations([{
      ...safe, ingredients: [...safe.ingredients, { name: "shrimp paste" }],
    }], ["shellfish"], exemptTerms).unsafe).toHaveLength(1);
  });
});