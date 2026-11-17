import type { NormalizedMenuItem } from "@shared/awayFromHome";
const mockCuisineCreate = jest.fn();
jest.mock("openai", () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({
  chat: { completions: { create: mockCuisineCreate } },
})) }));
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";
import { isStructuredMenuItemCompatible, generateMenuItemRecommendations } from "../services/away-from-home/generateMenuItemRecommendations";

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

describe("verified-menu explicit cuisine fidelity", () => {
  const oldEnvironment = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = "development"; mockCuisineCreate.mockReset(); });
  afterAll(() => { process.env.NODE_ENV = oldEnvironment; });
  async function choose(name: string, cuisine: string | undefined) {
    mockCuisineCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      recommendations: [{ itemId: "test_item", cuisine, reason: "Synthetic fixture selection" }],
    }) } }] });
    return generateMenuItemRecommendations({
      restaurantName: "Synthetic Chinese Kitchen",
      restaurantIdentity: { displayName: "Synthetic Chinese Kitchen", cuisineType: "Chinese" } as any,
      restaurantInfo: { name: "Synthetic Chinese Kitchen" },
      menuItems: [item({ name })], menuSource: "internal_canonical", menuLastVerifiedAt: "2026-11-16",
      cuisineContext: { saved: "chinese", explicit: "chinese", observed: "chinese", displayLanguage: "zh", note: null },
    });
  }
  it("retains an exact provider item with matching structured cuisine", async () => {
    const results = await choose("Steamed ginger chicken", "Chinese");
    expect(results).toHaveLength(1);
    expect(results[0].meal.name).toBe("Steamed ginger chicken");
    expect((results[0] as any).cuisine).toBe("Chinese");
    expect(JSON.stringify(mockCuisineCreate.mock.calls[0][0])).toContain("display language (zh)");
  });
  it.each([
    ["Hamburger", "American"],
    ["Cheeseburger", "Chinese"],
    ["Steamed ginger chicken", undefined],
  ])("rejects adversarial menu selection %s labeled %s", async (name, cuisine) => {
    expect(await choose(name!, cuisine)).toEqual([]);
  });
  it("never accepts an invented item ID even when its cuisine is declared Chinese", async () => {
    mockCuisineCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
      recommendations: [{ itemId: "invented_item", cuisine: "Chinese", reason: "Not on menu" }],
    }) } }] });
    const results = await generateMenuItemRecommendations({
      restaurantName: "Synthetic Chinese Kitchen",
      restaurantIdentity: { displayName: "Synthetic Chinese Kitchen", cuisineType: "Chinese" } as any,
      restaurantInfo: { name: "Synthetic Chinese Kitchen" }, menuItems: [item()],
      menuSource: "internal_canonical", menuLastVerifiedAt: "2026-11-16",
      cuisineContext: { saved: null, explicit: "chinese", observed: "chinese", displayLanguage: "en", note: null },
    });
    expect(results).toEqual([]);
  });
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