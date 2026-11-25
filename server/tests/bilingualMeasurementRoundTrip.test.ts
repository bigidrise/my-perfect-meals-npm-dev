import { normalizeIngredients } from "../services/ingredientNormalizer";
import { validateGeneratedIngredientMeasurements } from "../services/calorieEstimator";

describe("Bilingual measurement round-trip integrity", () => {
  test.each([
    ["garlic", "1", "clove", "clove"],
    ["garlic", "2", "cloves", "cloves"],
    ["ajo", "1", "diente", "clove"],
    ["ajo", "2", "dientes", "cloves"],
    ["bell pepper", "1", "whole", "whole"],
    ["pimiento", "1", "entero", "whole"],
    ["pimientos", "2", "enteros", "whole"],
    ["large eggs", "2", "pieces", "pieces"],
    ["huevos grandes", "2", "piezas", "pieces"],
    ["claras de huevo medianas", "2", "unidades", "each"],
    ["yemas de huevo pequeñas", "2", "unidades", "each"],
  ])("preserves %s: %s %s", (name, amount, unit, expectedUnit) => {
    const raw = [{ name, amount, unit }];

    expect(validateGeneratedIngredientMeasurements(raw)).toBe(true);

    const normalized = normalizeIngredients(raw);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].amount).toBe(amount);
    expect(normalized[0].unit).toBe(expectedUnit);
    expect(validateGeneratedIngredientMeasurements(normalized)).toBe(true);
  });
});
