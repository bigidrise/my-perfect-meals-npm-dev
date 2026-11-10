/**
 * Explicit feature-to-video map for the YouTube Academy tutorial rollout.
 * An undefined URL means the founder has not supplied a feature-specific link;
 * pages using that key intentionally render no tutorial button.
 */
export const TUTORIAL_VIDEO_REGISTRY = {
  trainingGeneral: undefined,
  trainingDiabetic: undefined,
  trainingGlp1: undefined,
  trainingAntiInflammatory: undefined,
  performanceHub: undefined,
  pregnancy: undefined,
  getaway: "https://youtu.be/0CkEgYxX38E",
  gatherings: "https://youtu.be/gGOUC_DdE94",
  beginning: undefined,
  restaurantAssistant: "https://youtu.be/IlQsUk4rdIA",
  findMeals: undefined,
  buffet: undefined,
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
  // Preserve the current shared/default Performance Builder tutorial until a
  // dedicated link is supplied by the founder.
  performanceBuilder: "https://youtube.com/shorts/g85Pkiywrpk?feature=share",
} as const;

export type TutorialFeature = keyof typeof TUTORIAL_VIDEO_REGISTRY;

export function getTutorialVideo(feature: TutorialFeature): string | undefined {
  return TUTORIAL_VIDEO_REGISTRY[feature];
}

export function isTutorialAvailable(feature: TutorialFeature): boolean {
  return Boolean(getTutorialVideo(feature));
}
