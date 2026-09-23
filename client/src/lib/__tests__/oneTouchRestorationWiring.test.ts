import fs from "node:fs";
import path from "node:path";

describe("One-Touch Creator restored-card display gates", () => {
  it.each([
    ["Create a Dish", "client/src/pages/lifestyle/CreateDishPage.tsx", "visibleMeals"],
    ["Craving Creator", "client/src/pages/craving-creator.tsx", "generatedMeals"],
  ])("%s hides cached options and picked cards until the current authority is checked", (_name, file, cards) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).toContain("restoreOneTouchBatch(");
    expect(source).toContain("cachedOneTouchNamesForMeal(");
    expect(source).toContain("if (!restored) discard()");
    expect(source).toContain("!unverifiedOneTouchOptions && !isPlatingMeal && mealOptions.length > 0");
    expect(source).toContain(`!unverifiedOneTouchOptions && ${cards}.length > 0`);
    expect(source).toContain("clearOneTouchBatch(");
  });
});