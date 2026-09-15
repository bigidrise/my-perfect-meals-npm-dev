import {
  enforceFridgeRescueCuisineCompliance,
  type CuisineMealCandidate,
  type FridgeRescueCuisineProvider,
} from "../services/fridgeRescueCuisineCompliance";
import {
  buildGuestEnvelope,
  filterMealsByProtocol,
} from "../services/protocolEnvelope";

function meal(name: string, ingredients = ["chicken", "rice"]): CuisineMealCandidate {
  return {
    name,
    description: `${name} description`,
    ingredients: ingredients.map((name) => ({ name })),
    instructions: "Cook thoroughly.",
    calories: 400,
    protein: 30,
    carbs: 35,
    fat: 12,
    starchyCarbs: 25,
    fibrousCarbs: 10,
    cookingTime: "25 minutes",
    difficulty: "Easy",
  };
}

function provider(
  compliantNames: Set<string>,
  repairedMeals: CuisineMealCandidate[] = [],
): FridgeRescueCuisineProvider {
  return {
    assess: jest.fn(async ({ meals }) =>
      meals.map((candidate, index) => ({
        index,
        compliant: compliantNames.has(candidate.name),
        reason: compliantNames.has(candidate.name) ? "matches cuisine" : "wrong cuisine",
      }))),
    repair: jest.fn(async () => repairedMeals),
  };
}

describe("Fridge Rescue cuisine compliance", () => {
  test("keeps all three cuisine-compliant Mexican results without repair", async () => {
    const meals = [meal("Pollo Asado Tacos"), meal("Pescado Veracruzano"), meal("Picadillo")];
    const validator = provider(new Set(meals.map((value) => value.name)));
    await expect(enforceFridgeRescueCuisineCompliance({
      meals, cuisine: "Mexican", fridgeItems: ["chicken", "fish", "beef", "rice"], strictMode: false,
    }, validator)).resolves.toEqual(meals);
    expect(validator.repair).not.toHaveBeenCalled();
  });

  test("repairs only an off-cuisine candidate and revalidates it", async () => {
    const meals = [meal("Pollo Asado Tacos"), meal("Beef and Green Bean Stir-Fry"), meal("Pescado Veracruzano")];
    const repaired = meal("Carne con Ejotes en Salsa Roja", ["beef", "green beans", "chile", "tomato"]);
    const validator = provider(new Set([meals[0].name, meals[2].name, repaired.name]), [repaired]);
    const result = await enforceFridgeRescueCuisineCompliance({
      meals, cuisine: "Mexican", fridgeItems: ["beef", "green beans"], strictMode: false,
    }, validator);
    expect(result.map((value) => value.name)).toEqual([
      "Pollo Asado Tacos", "Carne con Ejotes en Salsa Roja", "Pescado Veracruzano",
    ]);
    expect(validator.repair).toHaveBeenCalledWith(expect.objectContaining({
      cuisine: "Mexican", strictMode: false, failedMeals: [meals[1]],
    }));
  });

  test.each(["Greek", "Chinese"])("uses the requested %s cuisine generically", async (cuisine) => {
    const candidate = meal(`${cuisine} meal`);
    const validator = provider(new Set([candidate.name]));
    await enforceFridgeRescueCuisineCompliance({
      meals: [candidate], cuisine, fridgeItems: ["fish", "rice"], strictMode: false,
    }, validator);
    expect(validator.assess).toHaveBeenCalledWith(expect.objectContaining({ cuisine }));
  });

  test("passes restrictive ingredient control into repair without relaxing it", async () => {
    const bad = meal("Generic Bowl");
    const repaired = meal("Japanese Rice Bowl");
    const validator = provider(new Set([repaired.name]), [repaired]);
    await enforceFridgeRescueCuisineCompliance({
      meals: [bad], cuisine: "Japanese", fridgeItems: ["rice"], strictMode: true,
    }, validator);
    expect(validator.repair).toHaveBeenCalledWith(expect.objectContaining({
      strictMode: true, fridgeItems: ["rice"],
    }));
  });

  test("drops a repair that still fails cuisine validation", async () => {
    const bad = meal("Generic Vegan Bowl", ["tofu", "rice"]);
    const stillBad = meal("Another Generic Vegan Bowl", ["tofu", "rice"]);
    const validator = provider(new Set(), [stillBad]);
    await expect(enforceFridgeRescueCuisineCompliance({
      meals: [bad], cuisine: "Mexican", fridgeItems: ["tofu", "rice"], strictMode: false,
    }, validator)).resolves.toEqual([]);
  });

  test("a cuisine-compliant repair still cannot bypass allergy protection", async () => {
    const bad = meal("Generic Rice Plate", ["rice"]);
    const repaired = meal("Camarones a la Mexicana", ["shrimp", "rice", "chile"]);
    const validator = provider(new Set([repaired.name]), [repaired]);
    const cuisineValidated = await enforceFridgeRescueCuisineCompliance({
      meals: [bad],
      cuisine: "Mexican",
      fridgeItems: ["rice"],
      strictMode: false,
    }, validator);
    const envelope = { ...buildGuestEnvelope(), allergies: ["shellfish"] };
    expect(filterMealsByProtocol(cuisineValidated, envelope, {
      generatorName: "fridge_rescue",
    })).toEqual([]);
  });
});