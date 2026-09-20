import { assertSavedGroceryShoppingIdentitySchema } from "../assertSavedGroceryShoppingIdentitySchema";

function guardDb(overrides: Record<string, boolean> = {}) {
  return {
    execute: jest.fn(async () => ({
      rows: [{
        product_key_column: true,
        product_key_index: true,
        ...overrides,
      }],
    })),
  };
}

describe("assertSavedGroceryShoppingIdentitySchema", () => {
  test("compatible schema passes with one read-only query", async () => {
    const database = guardDb();
    await expect(
      assertSavedGroceryShoppingIdentitySchema(database),
    ).resolves.toBeUndefined();
    expect(database.execute).toHaveBeenCalledTimes(1);
  });

  test("missing product identity index fails closed", async () => {
    const database = guardDb({ product_key_index: false });
    await expect(
      assertSavedGroceryShoppingIdentitySchema(database),
    ).rejects.toThrow(
      "STARTUP GUARD: Saved Grocery shopping identity schema is incomplete",
    );
  });
});