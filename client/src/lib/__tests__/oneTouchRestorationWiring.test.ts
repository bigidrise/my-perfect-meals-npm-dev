import fs from "node:fs";
import path from "node:path";

describe("Legacy finished-card display gates stay separate from restored concepts", () => {
  it.each([
    ["Create a Dish", "client/src/pages/lifestyle/CreateDishPage.tsx", "visibleMeals"],
    ["Craving Creator", "client/src/pages/craving-creator.tsx", "generatedMeals"],
  ])("%s hides cached options and picked cards until the current authority is checked", (_name, file, cards) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).toContain("restoreOneTouchBatch(");
    expect(source).toContain("cachedOneTouchNamesForMeal(");
    expect(source).toContain("if (!restored) discard()");
    expect(source).toContain("!conceptMenu.restoring && !unverifiedOneTouchOptions && !oneTouchBusy && !isPlatingMeal && conceptMenu.concepts.length === 0 && mealOptions.length > 0");
    expect(source).toContain(`!unverifiedOneTouchOptions && ${cards}.length > 0`);
    expect(source).toContain("clearOneTouchBatch(");
    expect(source).toContain('useCreatorConceptMenu("');
    expect(source).toContain("<CreatorConceptCards");
  });
});