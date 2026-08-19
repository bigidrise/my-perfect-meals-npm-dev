import {
  fromMealCardMeal,
  getMealCardSlot,
  toMealCardMeal,
  type PickerMealCardData,
} from "../pickerMealCardAdapter";
import type { Meal } from "@/types/meal";

const originalPickerMeal: PickerMealCardData = {
  id: "picker-original",
  name: "Original pasta",
  description: "Original recipe",
  imageUrl: "/original.jpg",
  ingredients: [{ name: "Pasta", amount: "2 cups" }],
  instructions: ["Boil pasta."],
  calories: 400,
  protein: 18,
  carbs: 72,
  fats: 8,
  labels: ["vegetarian"],
  badges: ["balanced"],
};

describe("pickerMealCardAdapter", () => {
  test("maps meal labels to valid MealCard slots", () => {
    expect(getMealCardSlot("Breakfast")).toBe("breakfast");
    expect(getMealCardSlot("Dinner")).toBe("dinner");
    expect(getMealCardSlot("Meal")).toBe("snacks");
  });

  test("converts picker data to the canonical MealCard shape", () => {
    expect(toMealCardMeal(originalPickerMeal)).toMatchObject({
      id: "picker-original",
      title: "Original pasta",
      ingredients: [{ item: "Pasta", amount: "2 cups" }],
      nutrition: { calories: 400, protein: 18, carbs: 72, fat: 8 },
    });
  });

  test("keeps the full refined recipe for the caller's picker action", () => {
    const refinedMeal: Meal = {
      id: "picker-refined",
      title: "Refined lentil pasta",
      description: "A higher-protein version",
      imageUrl: "/refined.jpg",
      ingredients: [
        { item: "Lentil pasta", quantity: "2", unit: "cups" },
        { name: "Spinach", amount: "2 handfuls" },
        "Lemon zest",
      ],
      instructions: [
        { text: "Boil the lentil pasta." },
        "Fold in spinach.",
      ],
      nutrition: { calories: 430, protein: 29, carbs: 66, fat: 10 },
      badges: ["high-protein"],
    };

    expect(fromMealCardMeal(refinedMeal, originalPickerMeal)).toEqual({
      ...originalPickerMeal,
      id: "picker-refined",
      name: "Refined lentil pasta",
      description: "A higher-protein version",
      imageUrl: "/refined.jpg",
      ingredients: [
        { name: "Lentil pasta", amount: "2" },
        { name: "Spinach", amount: "2 handfuls" },
        { name: "Lemon zest", amount: "" },
      ],
      instructions: ["Boil the lentil pasta.", "Fold in spinach."],
      calories: 430,
      protein: 29,
      carbs: 66,
      fats: 10,
      badges: ["high-protein"],
    });
  });
});