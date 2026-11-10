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
  getaway: undefined,
  gatherings: undefined,
  beginning: undefined,
  restaurantAssistant: undefined,
  findMeals: undefined,
  buffet: undefined,
  pets: undefined,
  dogs: undefined,
  cats: undefined,
  createDish: "https://youtube.com/shorts/OxdqoAYQpsA?feature=share",
  cravingCreator: "https://youtube.com/shorts/C3kZCNC1tq8?feature=share",
  sushiCreator: "https://youtube.com/shorts/bfIZsTFD_jc?feature=share",
  dessertCreator: "https://youtube.com/shorts/hsvqjCK_6rA?feature=share",
  beverageCreator: "https://youtube.com/shorts/JLqrxVdS2kI?feature=share",
  athleteBeverageCreator: "https://youtube.com/shorts/JLqrxVdS2kI?feature=share",
  spiritsBeerWinePairings: "https://youtube.com/shorts/dF7jpiph7_E",
  wineListTranslator: "https://youtube.com/shorts/7DToPay8jEg",
  reduceDrinking: "https://youtube.com/shorts/ttk0Mb6mcN8?feature=share",
  fridgeRescue: "https://youtube.com/shorts/hctXRUOuCW4?feature=share",
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
