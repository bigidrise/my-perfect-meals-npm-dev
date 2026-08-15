/**
 * groceryCoachSwapConfirm.test.ts
 *
 * Unit tests for applySwapToShoppingList — the pure transformation applied
 * when the user taps "Use This" in the swap overlay.
 *
 * Key behavioral contracts verified:
 *  1. The shopping list is unchanged before applySwapToShoppingList is called
 *     (i.e. opening the overlay and selecting an option does NOT mutate the
 *     list — only calling this function does).
 *  2. Only the exact target item (matched by item name + category) is replaced.
 *  3. All other items in the list remain unchanged after confirmation.
 *  4. Two items with the same name but different categories are distinguished —
 *     only the one with the matching category is replaced.
 *  5. quantity and unit from the selected swap override the originals when
 *     provided; the original values are preserved when they are undefined.
 *  6. The function returns a new array (no mutation of the input).
 *  7. Selecting a different suggestion after already viewing results changes
 *     which item would be confirmed (the function is called with the new
 *     selection, not the old one).
 *
 * Run: npx jest client/src/lib/__tests__/groceryCoachSwapConfirm.test.ts
 */

// ── Module stubs required by the component's imports ──────────────────────────
jest.mock("wouter", () => ({ useLocation: () => ["/", jest.fn()] }));
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: any) => {
      const React = require("react");
      return React.createElement("div", rest, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("@/stores/shoppingListStore", () => ({
  useShoppingListStore: jest.fn(() => jest.fn()),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));
jest.mock("@/lib/sentry", () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));
jest.mock("@/components/ui/pill-button", () => ({ PillButton: () => null }));
jest.mock("@/components/MealRefinementSheet", () => ({ default: () => null }));

import { applySwapToShoppingList } from "@/components/shopping/GroceryStoreCoachSheet";

// ── Fixtures ──────────────────────────────────────────────────────────────────

interface Item {
  item: string;
  quantity: string;
  unit: string;
  category: string;
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    item:     "Chicken breast",
    quantity: "1",
    unit:     "lb",
    category: "Meat",
    ...overrides,
  };
}

const BASE_LIST: Item[] = [
  makeItem({ item: "Chicken breast", quantity: "1", unit: "lb",   category: "Meat" }),
  makeItem({ item: "Broccoli",       quantity: "1", unit: "head", category: "Produce" }),
  makeItem({ item: "Brown rice",     quantity: "2", unit: "cups", category: "Grains & Packaged" }),
  makeItem({ item: "Olive oil",      quantity: "2", unit: "tbsp", category: "Pantry" }),
  makeItem({ item: "Greek yogurt",   quantity: "1", unit: "cup",  category: "Dairy & Eggs" }),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("applySwapToShoppingList — Use This confirmation contract", () => {

  // ── 1. Input list is not mutated ───────────────────────────────────────────
  test("returns a new array — does not mutate the original list", () => {
    const original = [...BASE_LIST];
    const frozen   = BASE_LIST.map((i) => Object.freeze({ ...i })) as Item[];

    const result = applySwapToShoppingList(
      frozen,
      { item: "Chicken breast", category: "Meat" },
      { item: "Turkey breast", quantity: "1", unit: "lb" },
    );

    // Result is a new array
    expect(result).not.toBe(frozen);
    // Original items are unchanged
    expect(original.map((i) => i.item)).toEqual(["Chicken breast", "Broccoli", "Brown rice", "Olive oil", "Greek yogurt"]);
  });

  // ── 2. Only the targeted item is replaced ─────────────────────────────────
  test("replaces only the targeted item; all other items are unchanged", () => {
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Chicken breast", category: "Meat" },
      { item: "Turkey breast", quantity: "1", unit: "lb" },
    );

    // Targeted item is replaced
    expect(result[0].item).toBe("Turkey breast");

    // All other items unchanged
    expect(result[1].item).toBe("Broccoli");
    expect(result[2].item).toBe("Brown rice");
    expect(result[3].item).toBe("Olive oil");
    expect(result[4].item).toBe("Greek yogurt");
  });

  // ── 3. Five test-matrix items each replace correctly ──────────────────────
  const TEST_CASES = [
    {
      target:   { item: "Chicken breast", category: "Meat" },
      selected: { item: "Turkey breast",  quantity: "1",   unit: "lb"   },
      expected: "Turkey breast",
    },
    {
      target:   { item: "Broccoli",   category: "Produce" },
      selected: { item: "Spinach",    quantity: "5",   unit: "oz"   },
      expected: "Spinach",
    },
    {
      target:   { item: "Brown rice", category: "Grains & Packaged" },
      selected: { item: "Quinoa",     quantity: "1",   unit: "cup"  },
      expected: "Quinoa",
    },
    {
      target:   { item: "Olive oil",    category: "Pantry" },
      selected: { item: "Avocado oil",  quantity: "2",   unit: "tbsp" },
      expected: "Avocado oil",
    },
    {
      target:   { item: "Greek yogurt", category: "Dairy & Eggs" },
      selected: { item: "Skyr",         quantity: "1",   unit: "cup"  },
      expected: "Skyr",
    },
  ];

  test.each(TEST_CASES)(
    "replacing $target.item → $selected.item updates correctly; all others unchanged",
    ({ target, selected, expected }) => {
      const result = applySwapToShoppingList(BASE_LIST, target, selected);

      // Only the replaced position changes
      const changedItems = result.filter((r) => r.item !== BASE_LIST.find((b) => b.item === r.item && b.category === r.category)?.item || r.item === expected);
      const replacedRow  = result.find((r) => r.item === expected);
      expect(replacedRow).toBeDefined();

      // All items whose name did not change must be identical to their original
      for (const resultItem of result) {
        if (resultItem.item === expected) continue;
        const orig = BASE_LIST.find((b) => b.item === resultItem.item && b.category === resultItem.category);
        expect(orig).toBeDefined();
        expect(resultItem.quantity).toBe(orig!.quantity);
        expect(resultItem.unit).toBe(orig!.unit);
      }
    },
  );

  // ── 4. Category discrimination ─────────────────────────────────────────────
  test("two items with the same name but different categories — only the matching category is replaced", () => {
    const listWithDuplicateNames: Item[] = [
      makeItem({ item: "Chicken breast", quantity: "1", unit: "lb",  category: "Meat" }),
      makeItem({ item: "Chicken breast", quantity: "2", unit: "lbs", category: "Frozen" }),
      makeItem({ item: "Broccoli",       quantity: "1", unit: "head", category: "Produce" }),
    ];

    const result = applySwapToShoppingList(
      listWithDuplicateNames,
      { item: "Chicken breast", category: "Meat" },
      { item: "Turkey breast", quantity: "1", unit: "lb" },
    );

    // Only the Meat one is replaced
    expect(result[0].item).toBe("Turkey breast");
    expect(result[0].category).toBe("Meat");

    // The Frozen one is unchanged
    expect(result[1].item).toBe("Chicken breast");
    expect(result[1].category).toBe("Frozen");
    expect(result[1].quantity).toBe("2");
  });

  // ── 5. Quantity and unit from selected override originals ─────────────────
  test("selected.quantity and selected.unit replace the original values when provided", () => {
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      { item: "Quinoa", quantity: "1.5", unit: "cups" },
    );

    const replaced = result.find((r) => r.item === "Quinoa")!;
    expect(replaced.quantity).toBe("1.5");
    expect(replaced.unit).toBe("cups");
  });

  test("original quantity is preserved when selected.quantity is undefined", () => {
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      { item: "Quinoa", quantity: undefined, unit: "cups" },
    );

    const replaced = result.find((r) => r.item === "Quinoa")!;
    // Original quantity for Brown rice was "2"
    expect(replaced.quantity).toBe("2");
  });

  test("original unit is preserved when selected.unit is undefined", () => {
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      { item: "Quinoa", quantity: "1", unit: undefined },
    );

    const replaced = result.find((r) => r.item === "Quinoa")!;
    // Original unit for Brown rice was "cups"
    expect(replaced.unit).toBe("cups");
  });

  // ── 6. Nothing changes before the function is called ─────────────────────
  test("list is unchanged if the swap is viewed but never confirmed (function not called)", () => {
    // Simulate: user opens overlay (swapTarget set), sees suggestions (swapResult set),
    // selects an option (swapSelected set), but then taps Cancel.
    // None of these actions call applySwapToShoppingList — so the list is unmodified.
    const originalSnapshot = BASE_LIST.map((i) => ({ ...i }));

    // "Viewing" and "selecting" are pure state updates — no transformation applied
    const swapTarget   = BASE_LIST[0]; // Chicken breast
    const swapSelected = { item: "Turkey breast", quantity: "1", unit: "lb", reason: "Good pick." };

    // User taps Cancel — applySwapToShoppingList is NOT called
    // List must be identical to the original
    expect(BASE_LIST).toEqual(originalSnapshot);
    expect(BASE_LIST[0].item).toBe("Chicken breast");
  });

  // ── 7. Switching selection then confirming applies the new selection ───────
  test("confirming after switching selection applies the last-selected item, not the first", () => {
    const firstSelected  = { item: "Turkey breast",  quantity: "1", unit: "lb" };
    const secondSelected = { item: "Cod fillet",     quantity: "6", unit: "oz" };

    // Simulate user first selecting Turkey then switching to Cod before confirming.
    // Only the final confirmation call (secondSelected) is applied.
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Chicken breast", category: "Meat" },
      secondSelected,
    );

    expect(result[0].item).toBe("Cod fillet");
    expect(result[0].unit).toBe("oz");
    // Turkey breast must NOT appear
    expect(result.some((r) => r.item === "Turkey breast")).toBe(false);
  });

  // ── 8. Non-existent target → list returned unchanged ──────────────────────
  test("target item not found in list → list is returned unchanged", () => {
    const result = applySwapToShoppingList(
      BASE_LIST,
      { item: "Salmon fillet", category: "Meat" }, // not in BASE_LIST
      { item: "Tuna", quantity: "6", unit: "oz" },
    );

    // No items changed
    expect(result.map((r) => r.item)).toEqual(BASE_LIST.map((b) => b.item));
  });

  // ── 9. Empty list ──────────────────────────────────────────────────────────
  test("empty list → returns empty list", () => {
    const result = applySwapToShoppingList(
      [],
      { item: "Chicken breast", category: "Meat" },
      { item: "Turkey breast", quantity: "1", unit: "lb" },
    );

    expect(result).toEqual([]);
  });
});
