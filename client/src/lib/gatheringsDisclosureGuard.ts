import {
  assertRecipeDraft, CLINICAL_RECIPE_WITHHELD, SAFE_RECIPE_FAILURE,
} from "@shared/recipeDraftSafety";

/** Fresh responses AND old local caches must pass before reaching card fields.
 * Valid recipes and the existing clinical-withholding state stay unchanged.
 * Rejected data is replaced, not spread into another cache/display object. */
export function guardGatheringsCards<T>(courses: T[], fallbackServings = 6): T[] {
  if (!Array.isArray(courses)) return [];
  return courses.map((course, index) => {
    const raw = course as any;
    // This is the fixed server-owned clinical state, not a generated recipe.
    if (raw?._fallback === true && raw.description === CLINICAL_RECIPE_WITHHELD &&
      Array.isArray(raw.ingredients) && raw.ingredients.length === 0 &&
      Array.isArray(raw.instructions) && raw.instructions.length === 0 &&
      ["appetizer", "main", "side", "dessert"].includes(raw.courseType) &&
      raw.name === `${raw.courseType[0].toUpperCase()}${raw.courseType.slice(1)} Course`) return course;
    try {
      assertRecipeDraft(raw);
      return course;
    } catch {
      const kind = ["appetizer", "main", "side", "dessert"].includes(raw?.courseType) ? raw.courseType : "main";
      const label = kind === "side" ? "Side Dish" : `${kind[0].toUpperCase()}${kind.slice(1)}`;
      const servings = Number.isInteger(raw?.servings) && raw.servings > 0 && raw.servings <= 50
        ? raw.servings : fallbackServings;
      return {
        id: `rejected-gatherings-course-${index}`, name: `${label} Course`,
        description: SAFE_RECIPE_FAILURE, ingredients: [], instructions: [SAFE_RECIPE_FAILURE],
        courseType: kind, courseLabel: label, servings, servingSize: `${servings} servings`,
        medicalBadges: [], flags: [], assignedDish: null, isFamilySpecialty: false,
        _fallback: true,
      } as T;
    }
  });
}
