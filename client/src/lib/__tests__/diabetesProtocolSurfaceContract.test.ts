import fs from "fs";
import path from "path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("diabetes display and handoff coverage", () => {
  it.each([
    ["client/src/components/MealCard.tsx", "storedDiabeticMemory"],
    ["client/src/components/MealCardFull.tsx", "meal.diabeticMemory"],
    ["client/src/components/meal/GeneratedMealCard.tsx", "generatedMeal.diabeticMemory"],
    ["client/src/components/SavedMealRow.tsx", "d?.diabeticMemory"],
    ["client/src/pages/lifestyle/ChefsKitchenPage.tsx", "generatedMeal.diabeticMemory"],
    ["client/src/pages/craving-creator.tsx", "meal.diabeticMemory"],
    ["client/src/pages/lifestyle/CreateDishPage.tsx", "meal.diabeticMemory"],
  ])("%s delegates its persisted evidence to the one shared indicator", (file, memory) => {
    const contents = source(file);
    expect(contents).toContain('import DiabetesProtocolIndicator from "@/components/DiabetesProtocolIndicator"');
    expect(contents).toContain(`<DiabetesProtocolIndicator memory={${memory}}`);
    expect(contents).not.toMatch(/t\(["'](?:savedMeals\.)?diabetesProtocol["']\)/);
  });

  it.each([
    ["client/src/pages/lifestyle/ChefsKitchenPage.tsx", "diabeticMemory: meal.diabeticMemory"],
    ["client/src/components/studio-wizard/StudioWizard.tsx", "diabeticMemory: meal.diabeticMemory"],
    ["client/src/components/meal/GeneratedMealCard.tsx", "diabeticMemory: generatedMeal.diabeticMemory"],
    ["client/src/components/BuilderDayBoard.tsx", "diabeticMemory: m.diabeticMemory"],
  ])("%s carries the existing snapshot through its normalization/handoff", (file, projection) => {
    expect(source(file)).toContain(projection);
  });

  it("never reads current profile/glucose, browser storage, or builder state in the shared indicator", () => {
    const contents = source("client/src/components/DiabetesProtocolIndicator.tsx");
    expect(contents).not.toMatch(/useAuth|useQuery|localStorage|sessionStorage|builderType|bloodGlucose/);
    expect(contents).toContain("getPersistedDiabeticMemory(memory)");
  });

  it("keeps ungenerated Menu ideas separate from completed-meal provenance", () => {
    const contents = source("client/src/pages/MyPerfectMenu.tsx");
    expect(contents).not.toContain("DiabetesProtocolIndicator");
    expect(contents).toContain("...(meal.diabeticMemory ? { diabeticMemory: meal.diabeticMemory } : {})");
    expect(contents).toContain("diabeticMemory: payload.meal.diabeticMemory ?? meal.diabeticMemory");
  });
});