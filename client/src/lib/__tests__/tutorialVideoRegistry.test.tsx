import { renderToStaticMarkup } from "react-dom/server";
import { HowThisWorksLink } from "@/components/ui/HowThisWorksLink";
import {
  getTutorialVideo,
  isTutorialAvailable,
  TUTORIAL_VIDEO_REGISTRY,
} from "@/lib/tutorialVideoRegistry";

describe("tutorial video registry", () => {
  test("preserves exact existing feature links, including shared videos", () => {
    expect(TUTORIAL_VIDEO_REGISTRY).toEqual({
      myPerfectMenu: "https://youtu.be/Lwaubw-c6XQ",
      smartGroceryList: "https://youtu.be/OwmJonmf2YU",
      recipeMaker: "https://youtu.be/HSY4DogCNFg",
      savedMeals: "https://youtu.be/MpOvTN1sDsE",
      dailyJournal: "https://youtu.be/y4e0HZuwQDc",
      groceryStoreCoach: "https://youtu.be/xmpOGkUiXzg",
      biometrics: "https://youtu.be/R2cgIAgqqd8",
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
    });
    expect(getTutorialVideo("athleteBeverageCreator")).toBe("https://youtu.be/GfEH1ydfkic");
    expect(getTutorialVideo("athleteBeverageCreator")).not.toBe(getTutorialVideo("beverageCreator"));
    expect(getTutorialVideo("performanceBuilder")).toBe("https://youtu.be/4EEJC_yFVjQ");
    expect(getTutorialVideo("performanceHub")).toBe(getTutorialVideo("trainingGeneral"));
  });

  test("keeps all links awaiting founder URLs unavailable", () => {
    const pendingFeatures = [
      "pregnancy",
      "beginning",
      "pets", "dogs", "cats",
    ] as const;

    for (const feature of pendingFeatures) {
      expect(TUTORIAL_VIDEO_REGISTRY[feature]).toBeUndefined();
      expect(isTutorialAvailable(feature)).toBe(false);
      expect(renderToStaticMarkup(<HowThisWorksLink featureKey={feature} />)).toBe("");
    }
  });

  test("renders a configured feature button without using the legacy default", () => {
    const markup = renderToStaticMarkup(
      <HowThisWorksLink featureKey="createDish" label="How It Works" />,
    );
    expect(markup).toContain("How It Works");
    expect(markup).toContain("Watch tutorial: How It Works");
    expect(markup).toContain('aria-label="Watch tutorial: How It Works"');
    expect(markup).toContain("min-h-[44px]");
    expect(markup).toContain("bg-emerald-600");
  });

  test("retains legacy default behavior for unkeyed builders", () => {
    const markup = renderToStaticMarkup(<HowThisWorksLink />);
    expect(markup).toContain("Builder Tutorial");
  });
});
