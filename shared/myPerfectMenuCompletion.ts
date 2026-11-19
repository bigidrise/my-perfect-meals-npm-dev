import type { MyPerfectMenuCategory } from "./myPerfectMenuCategory";

type MenuDestinationSlot = "breakfast" | "lunch" | "dinner" | "meal4" | "meal5" | "meal6" | "snacks";
export type MenuCompletionMealType = Exclude<MenuDestinationSlot, "snacks"> | "snack";

/** Destination owns placement; the selected occasion owns the recipe. */
export function menuCompletionMealType(
  selectedOccasion: string,
  destinationSlot: MenuDestinationSlot,
  preserveSelectedOccasion: boolean,
): MenuCompletionMealType {
  if (preserveSelectedOccasion &&
      (["breakfast", "lunch", "dinner", "snack"] satisfies MyPerfectMenuCategory[]).includes(selectedOccasion as MyPerfectMenuCategory)) {
    return selectedOccasion as MyPerfectMenuCategory;
  }
  return destinationSlot === "snacks" ? "snack" : destinationSlot;
}
