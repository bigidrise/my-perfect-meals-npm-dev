import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
describe("Creator Menu modal and progress remain separate from manual Creators", () => {
  it("shows two independent Craving-only controls and no extra Dish settings", () => {
    const modal = read("client/src/components/one-touch/OneTouchCreateModal.tsx");
    expect(modal).toContain('{creator === "craving_creator" && (');
    expect(modal).toContain('Craving Type');
    expect(modal).toContain('Craving Feel');
    expect(modal).toContain('<SelectItem value="food">Food</SelectItem>');
    expect(modal).toContain('<SelectItem value="dessert">Dessert</SelectItem>');
    expect(modal).toContain('<SelectItem value="light">Light</SelectItem>');
    expect(modal).toContain('<SelectItem value="hearty">Hearty</SelectItem>');
    expect(modal).not.toContain("Cooking Method");
    expect(modal).not.toContain("Household Profile");
  });
  it("both Menus display the shared progress treatment in the results area while busy", () => {
    const craving = read("client/src/pages/craving-creator.tsx");
    const dish = read("client/src/pages/lifestyle/CreateDishPage.tsx");
    expect(craving).toContain('aria-label="Creating your Craving Menu"');
    expect(craving).toContain('<MealGenerationProgress active context="snack" mode="options" />');
    expect(dish).toContain('aria-label="Creating your Dish Menu"');
    expect(dish).toContain('<MealGenerationProgress active context="create-dish" mode="options" />');
    expect(craving.indexOf('aria-label="Creating your Craving Menu"'))
      .toBeLessThan(craving.indexOf("<CreatorConceptCards"));
    expect(dish.indexOf('aria-label="Creating your Dish Menu"'))
      .toBeLessThan(dish.indexOf("<CreatorConceptCards"));
    expect(craving).toContain("conceptMenu.choose<MealData>(conceptId)");
    expect(dish).toContain("conceptMenu.choose<MealData>(conceptId)");
  });
});