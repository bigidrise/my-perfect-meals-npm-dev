import type { NormalizedMenuItem } from "@shared/awayFromHome";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import { isStructuredMenuItemCompatible } from "../services/away-from-home/generateMenuItemRecommendations";

const item = (overrides: Partial<NormalizedMenuItem> = {}): NormalizedMenuItem => ({
  id: "test_item",
  brandSlug: "test",
  name: "Test Plate",
  category: "entree",
  calories: 400,
  proteinGrams: 25,
  carbohydrateGrams: 30,
  fatGrams: 12,
  ...overrides,
});

const envelope = (
  overrides: Partial<UserProtocolEnvelope>,
): UserProtocolEnvelope => ({
  allergies: [],
  dietaryIdentity: [],
  ...overrides,
} as UserProtocolEnvelope);

describe("verified restaurant structured precedence", () => {
  it("rejects a model-selectable item that declares an active allergen", () => {
    expect(isStructuredMenuItemCompatible(
      item({ allergens: ["tree nuts"], isVegan: true }),
      envelope({ allergies: ["tree nuts"] }),
    )).toBe(false);
  });

  it("rejects an item without an affirmative vegan menu flag", () => {
    expect(isStructuredMenuItemCompatible(
      item({ isVegetarian: true, isVegan: false }),
      envelope({ dietaryIdentity: ["vegan"] }),
    )).toBe(false);
  });
});