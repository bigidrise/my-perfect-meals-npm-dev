import { assertFoodPreferenceSchema } from "../assertFoodPreferenceSchema";

function guardDb(overrides: Record<string, boolean> = {}) {
  return {
    execute: jest.fn(async () => ({
      rows: [{
        user_foods_i_enjoy: true,
        household_foods_i_enjoy: true,
        user_menu_preferences: true,
        household_menu_preferences: true,
        ...overrides,
      }],
    })),
  };
}

describe("assertFoodPreferenceSchema", () => {
  test("compatible preference schema passes read-only", async () => {
    const database = guardDb();
    await expect(assertFoodPreferenceSchema(database)).resolves.toBeUndefined();
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  test("missing household preference column fails closed", async () => {
    const database = guardDb({ household_menu_preferences: false });
    await expect(assertFoodPreferenceSchema(database)).rejects.toThrow(
      "STARTUP GUARD: Food preference schema is incomplete",
    );
  });
});