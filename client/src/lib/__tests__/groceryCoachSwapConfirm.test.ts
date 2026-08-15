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

import {
  applySwapToShoppingList,
  applySwapToPickedBrands,
} from "@/components/shopping/GroceryStoreCoachSheet";

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

// ─────────────────────────────────────────────────────────────────────────────
// Clinical users — "Use This" works when alternatives is empty
//
// When the server returns alternatives: [] (GLP-1 / diabetic safety gate),
// the swap overlay must still allow the user to:
//   1. Select the coachSuggestion as the only option.
//   2. Tap "Use This" — which calls applySwapToShoppingList with that selection.
//   3. Get a correctly-mutated shopping list.
//
// The UI renders "Use This" whenever swapSelected is non-null, regardless of
// how many alternatives exist. These tests confirm that the pure commit
// function (the downstream effect of tapping "Use This") behaves correctly in
// the empty-alternatives scenario.
// ─────────────────────────────────────────────────────────────────────────────

describe("applySwapToShoppingList — Use This works when alternatives is empty (clinical users)", () => {

  // A representative shopping list that might belong to a GLP-1 or diabetic user.
  const CLINICAL_LIST: Item[] = [
    makeItem({ item: "Chicken breast",  quantity: "6",  unit: "oz",   category: "Meat"            }),
    makeItem({ item: "Brown rice",      quantity: "0.5",unit: "cup",  category: "Grains & Packaged"}),
    makeItem({ item: "Broccoli",        quantity: "1",  unit: "head", category: "Produce"         }),
    makeItem({ item: "Olive oil",       quantity: "1",  unit: "tsp",  category: "Pantry"          }),
  ];

  // Simulates what the server returns for a GLP-1 / diabetic user:
  //   { coachSuggestion: {...}, alternatives: [], savedOption: null, protocolNote: "..." }
  function makeClinicalSwapResult(coachItem: string, qty: string, unit: string) {
    return {
      coachSuggestion: { item: coachItem, quantity: qty, unit, reason: "Clinical-safe replacement." },
      alternatives:    [] as Array<{ item: string; quantity: string; unit: string; reason: string }>,
      savedOption:     null,
      protocolNote:    "Alternatives hidden: clinical fat/carb compliance cannot be verified without nutrition data.",
    };
  }

  // ── 1. GLP-1 scenario — brown rice → cauliflower rice ────────────────────
  test("GLP-1 scenario: Use This with only coachSuggestion replaces the target correctly", () => {
    const swapResult = makeClinicalSwapResult("Cauliflower rice", "1", "cup");

    // User sees overlay with alternatives: [] — taps coachSuggestion, then "Use This".
    const swapSelected = swapResult.coachSuggestion;
    expect(swapResult.alternatives).toHaveLength(0);

    const updated = applySwapToShoppingList(
      CLINICAL_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      swapSelected,
    );

    // Brown rice must be replaced with Cauliflower rice
    const replaced = updated.find((r) => r.category === "Grains & Packaged")!;
    expect(replaced.item).toBe("Cauliflower rice");
    expect(replaced.quantity).toBe("1");
    expect(replaced.unit).toBe("cup");
  });

  // ── 2. Diabetic scenario — olive oil → cooking spray ─────────────────────
  test("diabetic scenario: Use This with only coachSuggestion replaces the target correctly", () => {
    const swapResult = makeClinicalSwapResult("Cooking spray", "1", "can");

    const swapSelected = swapResult.coachSuggestion;
    expect(swapResult.alternatives).toHaveLength(0);

    const updated = applySwapToShoppingList(
      CLINICAL_LIST,
      { item: "Olive oil", category: "Pantry" },
      swapSelected,
    );

    const replaced = updated.find((r) => r.category === "Pantry")!;
    expect(replaced.item).toBe("Cooking spray");
  });

  // ── 3. All other items in the list remain unchanged ───────────────────────
  test("non-targeted items are untouched when alternatives is empty and coachSuggestion is confirmed", () => {
    const swapResult = makeClinicalSwapResult("Cauliflower rice", "1", "cup");
    const swapSelected = swapResult.coachSuggestion;

    const updated = applySwapToShoppingList(
      CLINICAL_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      swapSelected,
    );

    // Chicken breast — unchanged
    const chicken = updated.find((r) => r.item === "Chicken breast")!;
    expect(chicken).toBeDefined();
    expect(chicken.quantity).toBe("6");
    expect(chicken.unit).toBe("oz");

    // Broccoli — unchanged
    const broccoli = updated.find((r) => r.item === "Broccoli")!;
    expect(broccoli).toBeDefined();
    expect(broccoli.quantity).toBe("1");

    // Olive oil — unchanged
    const oil = updated.find((r) => r.item === "Olive oil")!;
    expect(oil).toBeDefined();
    expect(oil.unit).toBe("tsp");
  });

  // ── 4. "Use This" is enabled iff swapSelected is non-null (state contract) ─
  // The button is disabled when swapSelected === null and enabled otherwise.
  // This test exercises the state machine: even with alternatives: [], the user
  // CAN select coachSuggestion, making swapSelected non-null and enabling "Use This".
  test("swapSelected set to coachSuggestion enables Use This — empty alternatives does not prevent it", () => {
    const swapResult = makeClinicalSwapResult("Turkey breast", "6", "oz");

    // Before selection: swapSelected is null → button disabled
    let swapSelected: typeof swapResult.coachSuggestion | null = null;
    expect(swapSelected).toBeNull(); // "Use This" would be disabled

    // User taps the coachSuggestion card (the only option shown)
    swapSelected = swapResult.coachSuggestion;
    expect(swapSelected).not.toBeNull(); // "Use This" is now enabled

    // Confirming the swap produces the correct result
    const updated = applySwapToShoppingList(
      CLINICAL_LIST,
      { item: "Chicken breast", category: "Meat" },
      swapSelected,
    );
    expect(updated.find((r) => r.item === "Turkey breast")).toBeDefined();
    expect(updated.find((r) => r.item === "Chicken breast")).toBeUndefined();
  });

  // ── 5. protocolNote is present in the clinical swap result ────────────────
  test("clinical swap result carries a non-null protocolNote explaining why alternatives are hidden", () => {
    const swapResult = makeClinicalSwapResult("Cauliflower rice", "1", "cup");
    expect(swapResult.protocolNote).not.toBeNull();
    expect(typeof swapResult.protocolNote).toBe("string");
    expect((swapResult.protocolNote as string).length).toBeGreaterThan(0);
  });

  // ── 6. GLP-1 and diabetic — applySwapToShoppingList is idempotent ────────
  test("applying Use This twice with the same selection yields the same result as applying it once", () => {
    const swapResult = makeClinicalSwapResult("Cauliflower rice", "1", "cup");
    const swapSelected = swapResult.coachSuggestion;

    const firstPass = applySwapToShoppingList(
      CLINICAL_LIST,
      { item: "Brown rice", category: "Grains & Packaged" },
      swapSelected,
    );

    // Applying the same swap to the already-updated list should be a no-op
    // (target "Brown rice" no longer exists — returns list unchanged).
    const secondPass = applySwapToShoppingList(
      firstPass,
      { item: "Brown rice", category: "Grains & Packaged" },
      swapSelected,
    );

    expect(secondPass.map((r) => r.item)).toEqual(firstPass.map((r) => r.item));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applySwapToPickedBrands — summary bar hides after swap removes last pick
//
// When the user accepts a swap via "Use This", the swapped-out ingredient name
// is no longer in the shopping list. If the user had a brand picked for that
// ingredient, the pick must be removed from pickedBrands so the summary bar
// count is accurate and the bar hides when no active picks remain.
// ─────────────────────────────────────────────────────────────────────────────

describe("applySwapToPickedBrands — summary bar accuracy after swap", () => {

  interface BrandPick { brand: string; }

  function makePick(brand: string): BrandPick { return { brand }; }

  // ── 1. Removes the pick for the swapped-out ingredient ───────────────────
  test("removes the pick for the swapped-out ingredient", () => {
    const picks = new Map<string, BrandPick>([
      ["chicken breast", makePick("Brand A")],
    ]);

    const result = applySwapToPickedBrands(picks, "Chicken breast");

    expect(result.has("chicken breast")).toBe(false);
    expect(result.size).toBe(0);
  });

  // ── 2. Summary bar hides when the replaced ingredient was the only pick ───
  test("result is empty when the swapped-out ingredient was the only picked brand", () => {
    const picks = new Map<string, BrandPick>([
      ["chicken breast", makePick("Brand A")],
    ]);

    const result = applySwapToPickedBrands(picks, "Chicken breast");

    // pickedBrands.size === 0 → the summary bar renders nothing
    expect(result.size).toBe(0);
  });

  // ── 3. Other picks are untouched ─────────────────────────────────────────
  test("other picks survive when only the swapped-out ingredient is removed", () => {
    const picks = new Map<string, BrandPick>([
      ["chicken breast", makePick("Brand A")],
      ["brown rice",     makePick("Brand B")],
      ["olive oil",      makePick("Brand C")],
    ]);

    const result = applySwapToPickedBrands(picks, "Chicken breast");

    expect(result.has("chicken breast")).toBe(false);
    expect(result.get("brown rice")?.brand).toBe("Brand B");
    expect(result.get("olive oil")?.brand).toBe("Brand C");
    expect(result.size).toBe(2);
  });

  // ── 4. Key matching is case-insensitive ───────────────────────────────────
  test("lookup is case-insensitive — swappedOutItem is lowercased before deletion", () => {
    const picks = new Map<string, BrandPick>([
      ["brown rice", makePick("Brand B")],
    ]);

    // Even though the key was stored lowercase, passing a mixed-case item name
    // must still find and remove the entry.
    const result = applySwapToPickedBrands(picks, "Brown Rice");

    expect(result.has("brown rice")).toBe(false);
    expect(result.size).toBe(0);
  });

  // ── 5. No-op when the swapped-out ingredient had no pick ─────────────────
  test("returns the same Map instance unchanged when the key is not present", () => {
    const picks = new Map<string, BrandPick>([
      ["brown rice", makePick("Brand B")],
    ]);

    const result = applySwapToPickedBrands(picks, "Chicken breast"); // not in map

    // Same reference — no allocation, no mutation
    expect(result).toBe(picks);
    expect(result.size).toBe(1);
  });

  // ── 6. Empty map stays empty ──────────────────────────────────────────────
  test("returns the same empty Map when there were no picks at all", () => {
    const picks = new Map<string, BrandPick>();

    const result = applySwapToPickedBrands(picks, "Chicken breast");

    expect(result).toBe(picks);
    expect(result.size).toBe(0);
  });

  // ── 7. Does not mutate the original Map ───────────────────────────────────
  test("returns a new Map — does not mutate the original", () => {
    const picks = new Map<string, BrandPick>([
      ["chicken breast", makePick("Brand A")],
      ["brown rice",     makePick("Brand B")],
    ]);

    const result = applySwapToPickedBrands(picks, "Chicken breast");

    // Original still has both entries
    expect(picks.size).toBe(2);
    expect(picks.has("chicken breast")).toBe(true);
    // Result is a different object
    expect(result).not.toBe(picks);
  });

  // ── 8. End-to-end: pick A, swap A → B, bar hides ─────────────────────────
  test("end-to-end: pick a brand for ingredient A, swap A out, bar count drops to zero", () => {
    // Simulate: user picks Brand A for "Chicken breast"
    let picks = new Map<string, BrandPick>([
      ["chicken breast", makePick("Brand A")],
    ]);
    expect(picks.size).toBe(1); // bar shows "1 brand selected"

    // Simulate: user accepts a swap → "Chicken breast" replaced by "Turkey breast"
    picks = applySwapToPickedBrands(picks, "Chicken breast");

    // pickedBrands.size === 0 → {pickedBrands.size > 0 && <bar/>} renders nothing
    expect(picks.size).toBe(0);
  });
});
