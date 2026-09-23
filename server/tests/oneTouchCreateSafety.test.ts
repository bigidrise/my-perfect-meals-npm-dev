import fs from "node:fs";
import path from "node:path";
jest.mock("../services/oneTouch/menuRecipeCompletion", () => ({ completeMenuRecipe: jest.fn() }));
import { ONE_TOUCH_CREATE_ENABLED, isCreatorMenuEnabled } from "../routes/oneTouchCreate";

describe("Menu-owned completion safety gate", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "server/routes/oneTouchCreate.ts"),
    "utf8",
  );

  it("opens in Development and requires explicit Production enablement", () => {
    expect(ONE_TOUCH_CREATE_ENABLED).toBe(isCreatorMenuEnabled());
    expect(isCreatorMenuEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production", CREATOR_MENU_ENABLED: "false" })).toBe(false);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production", CREATOR_MENU_ENABLED: "true" })).toBe(true);
    expect(isCreatorMenuEnabled({ NODE_ENV: undefined, CREATOR_MENU_ENABLED: "true" })).toBe(false);
    expect(source).toContain("dietOverride");
    expect(source).toContain("ONE_TOUCH_NOT_AVAILABLE");
    expect(source).toContain("status(503)");
  });

  it("uses separate client and server opt-ins and no customer-facing One-Touch label", () => {
    const clientGate = fs.readFileSync(
      path.join(process.cwd(), "client/src/lib/oneTouchAvailability.ts"), "utf8",
    );
    const dish = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/lifestyle/CreateDishPage.tsx"), "utf8",
    );
    const craving = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/craving-creator.tsx"), "utf8",
    );
    const modal = fs.readFileSync(
      path.join(process.cwd(), "client/src/components/one-touch/OneTouchCreateModal.tsx"), "utf8",
    );
    expect(clientGate).toContain('import.meta.env.VITE_CREATOR_MENU_ENABLED === "true"');
    expect(clientGate).toContain("import.meta.env.DEV");
    expect(dish).toContain("✨ Create a Dish Menu");
    expect(craving).toContain("✨ Craving Menu");
    expect(modal).toContain('creator === "create_a_dish" ? "Create a Dish Menu" : "Craving Menu"');
    expect(`${dish}\n${craving}\n${modal}`).not.toContain("One-Touch Create");
    expect(source).not.toContain('error: "One-Touch');
    expect(dish).toContain("if (!ONE_TOUCH_CREATE_ENABLED)");
    expect(craving).toContain("if (!ONE_TOUCH_CREATE_ENABLED)");
  });

  it("calls only the isolated one-recipe service, never the manual Creator route or adapter", () => {
    expect(source).toContain("completeMenuRecipe({");
    expect(source).toContain("clinicalMealSlot: \"lunch\"");
    expect(source).toContain('creator === "craving_creator" ? "snack" : "lunch"');
    expect(source).toContain("requirement_evidence_unsupported");
    expect(source).toContain("ONE_TOUCH_REQUIREMENT_UNAVAILABLE");
    expect(source).not.toContain("invokeCanonical");
    expect(source).not.toContain("generateCravingMealOptions");
    expect(source).not.toContain("/api/meals/craving-creator");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
  });
});