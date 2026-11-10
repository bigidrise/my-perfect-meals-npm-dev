/**
 * Explicit feature-to-video map for the YouTube Academy tutorial rollout.
 * An undefined URL means the founder has not supplied a feature-specific link;
 * pages using that key intentionally render no tutorial button.
 */
export const TUTORIAL_VIDEO_REGISTRY = {
  productScan: "https://youtu.be/rETGqf0h9Cc",
  savedGroceries: "https://youtu.be/rETGqf0h9Cc",
  dashboard: "https://youtu.be/HPfCDO8eDGM",
  macroCalculator: "https://youtu.be/2ZfQmrA9mps",
  trainingGeneral: "https://youtu.be/4EEJC_yFVjQ",
  trainingDiabetic: "https://youtu.be/4EEJC_yFVjQ",
  trainingGlp1: "https://youtu.be/4EEJC_yFVjQ",
  trainingAntiInflammatory: "https://youtu.be/4EEJC_yFVjQ",
  performanceHub: "https://youtu.be/4EEJC_yFVjQ",
  pregnancy: undefined,
  getaway: "https://youtu.be/0CkEgYxX38E",
  gatherings: "https://youtu.be/gGOUC_DdE94",
  beginning: undefined,
  restaurantAssistant: "https://youtu.be/IlQsUk4rdIA",
  findMeals: "https://youtu.be/DenB8FxzGng",
  buffet: "https://youtu.be/rC4rsgpV4-I",
  pets: undefined,
  dogs: undefined,
  cats: undefined,
  createDish: "https://youtu.be/04IyPhqMryQ",
  cravingCreator: "https://youtu.be/BkxI1-hwXPo",
  sushiCreator: "https://youtu.be/SPte8aXHfS0",
  dessertCreator: "https://youtu.be/wbj7QY7D3C4",
  beverageCreator: "https://youtu.be/VaVfvcDqXzc",
  athleteBeverageCreator: "https://youtu.be/GfEH1ydfkic",
  spiritsBeerWinePairings: "https://youtube.com/shorts/dF7jpiph7_E",
  wineListTranslator: "https://youtube.com/shorts/7DToPay8jEg",
  reduceDrinking: "https://youtube.com/shorts/ttk0Mb6mcN8?feature=share",
  fridgeRescue: "https://youtu.be/fYaz_JYnNB8",
  generalNutritionBuilder: "https://youtu.be/UjNvo0hvUas",
  antiInflammatoryBuilder: "https://youtu.be/UjNvo0hvUas",
  diabeticBuilder: "https://youtu.be/UjNvo0hvUas",
  diabeticHub: "https://youtu.be/fp_9nVeXasc",
  glp1Builder: "https://youtu.be/UjNvo0hvUas",
  glp1Hub: "https://youtu.be/OaflYvlOI0A",
  performanceBuilder: "https://youtu.be/4EEJC_yFVjQ",
} as const;

export type TutorialFeature = keyof typeof TUTORIAL_VIDEO_REGISTRY;

export function getTutorialVideo(feature: TutorialFeature): string | undefined {
  return TUTORIAL_VIDEO_REGISTRY[feature];
}

export function isTutorialAvailable(feature: TutorialFeature): boolean {
  return Boolean(getTutorialVideo(feature));
}
