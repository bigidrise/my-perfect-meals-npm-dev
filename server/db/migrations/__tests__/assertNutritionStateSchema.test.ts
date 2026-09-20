import { assertNutritionStateSchema } from "../assertNutritionStateSchema";

function guardDb(overrides: Record<string, boolean> = {}) {
  return {
    execute: jest.fn(async () => ({
      rows: [{
        prescriptions_table: true,
        meals_per_day_column: true,
        starch_meals_column: true,
        starch_strategy_column: true,
        board_reference_column: true,
        board_reference_unique_index: true,
        ...overrides,
      }],
    })),
  };
}

describe("assertNutritionStateSchema", () => {
  test("compatible nutrition schema passes with one read-only query", async () => {
    const database = guardDb();
    await expect(assertNutritionStateSchema(database)).resolves.toBeUndefined();
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  test("missing nutrition uniqueness prerequisite fails closed", async () => {
    const database = guardDb({ board_reference_unique_index: false });
    await expect(assertNutritionStateSchema(database)).rejects.toThrow(
      "STARTUP GUARD: Nutrition State schema is incomplete",
    );
  });
});