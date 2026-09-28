import type { MyPerfectMenuConcept } from "../../shared/myPerfectMenu";
import { completedSnackMatchesConcept, matchesSnackType } from "../services/myPerfectMenu/snackIdentity";

const dessert = {
  id: "dessert-idea",
  ideaType: "snack",
  snackType: "dessert",
  title: "Walnut Brownies",
  foodIdentity: { foodRole: "dessert", polarity: "sweet", formatFamily: "brownie" },
} as MyPerfectMenuConcept;

const food = {
  ...dessert,
  id: "food-idea",
  snackType: "food",
  title: "Chicken Wrap",
  foodIdentity: { foodRole: "general_snack", polarity: "savory", formatFamily: "general_snack" },
} as MyPerfectMenuConcept;

describe("My Perfect Menu explicit snack identity", () => {
  it("rejects a mislabeled concept before it can be saved or selected", () => {
    expect(matchesSnackType(dessert.foodIdentity, "dessert")).toBe(true);
    expect(matchesSnackType(dessert.foodIdentity, "food")).toBe(false);
    expect(matchesSnackType(food.foodIdentity, "food")).toBe(true);
    expect(matchesSnackType(undefined, "food")).toBe(false);
  });

  it("retains recognizable dessert and food recipes", () => {
    expect(completedSnackMatchesConcept(dessert, { name: "Walnut Brownies with Cocoa" })).toBe(true);
    expect(completedSnackMatchesConcept(food, { name: "Grilled Chicken Wrap" })).toBe(true);
  });

  it("blocks dessert-to-food, food-to-dessert and dessert-family swaps", () => {
    expect(completedSnackMatchesConcept(dessert, { name: "Walnut Salad" })).toBe(false);
    expect(completedSnackMatchesConcept(dessert, { name: "Walnut Pudding" })).toBe(false);
    expect(completedSnackMatchesConcept(dessert, { name: "Walnut Brownie Salad" })).toBe(false);
    expect(completedSnackMatchesConcept(food, { name: "Chicken Brownie Wrap" })).toBe(false);
  });
});