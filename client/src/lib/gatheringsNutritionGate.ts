/** Compile-time preview gate; no Production/published activation. */
export const gatheringsNutritionPilot = import.meta.env.DEV && !import.meta.env.PROD;
