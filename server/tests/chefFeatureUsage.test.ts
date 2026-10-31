import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";

const oldEnvironment = process.env.NODE_ENV;
afterAll(() => { process.env.NODE_ENV = oldEnvironment; });

test("Development provides reviewed controls, not a canned Craving Creator tutorial", () => {
  process.env.NODE_ENV = "development";
  const usage = getDevelopmentPlatformKnowledge()!.featureUsage;
  expect(usage.craving_creator?.descriptionInput).toContain("voice input");
  expect(usage.craving_creator?.controls).toEqual(expect.arrayContaining([
    expect.stringContaining("Servings selector: 1 through 10"),
    expect.stringContaining("Cooking method is optional"),
    expect.stringContaining("Craving Category is optional"),
    expect.stringContaining("Custom Dietary Restrictions"),
  ]));
  expect(usage.craving_creator?.notes.join(" ")).toContain("Never recommend bypassing");
  expect(usage.dessert_creator?.controls.join(" ")).toContain("not how much one person eats");
  expect(usage.create_a_dish?.generationAction).toContain("Create My Dish");
  expect(usage.fridge_rescue?.notes.join(" ")).toContain("no approved ingredient-prefill");
  expect(usage.beverage_creator?.notes.join(" ")).toContain("do not reuse Hydration");
  expect(usage.athlete_beverage_creator?.generationAction).toContain("Create My Drink");
  expect(usage).not.toHaveProperty("clinical_builder");
});

test("Production does not receive Development interface knowledge", () => {
  process.env.NODE_ENV = "production";
  expect(getDevelopmentPlatformKnowledge()).toBeUndefined();
});

test("platform help describes verified nested controls without extending navigation authority", () => {
  process.env.NODE_ENV = "development";
  const help = getDevelopmentPlatformKnowledge()!.platformHelp;
  expect(help.shopping.route).toBe("/shopping-list-v2");
  expect(help.shopping.controls.join(" ")).toContain("Product Scan");
  expect(help.shopping.access).toContain("grocery_coach");
  expect(help.recipeMaker.entryPoint).toContain("dashboard");
  expect(help.recipeMaker.controls.join(" ")).toContain("Choose Photo");
  expect(help.recipeMaker.controls.join(" ")).toContain("Camera");
  expect(help.recipeMaker.route).toBeNull();
  expect(help.sources.entryPoint).toContain("Sources & Medical Information");
  expect(help.sources.limits.join(" ")).toContain("not proof");
  expect(help.sources.route).toBeNull();
  expect(help.tutorialsAndGuides.entryPoint).toContain("upper action-control area");
  expect(help.tutorialsAndGuides.controls.join(" ")).toContain("does not render a Guide button");
  expect(help.copilot.entryPoint).toContain("lower-right");
  expect(help.copilot.controls.join(" ")).toContain("Autoplay");
  expect(Object.keys(COACH_DESTINATIONS)).toHaveLength(17);
  for (const id of ["shopping_list", "grocery_coach", "product_scan", "recipe_maker", "sources", "tutorials", "learn", "copilot"]) {
    expect(COACH_DESTINATIONS).not.toHaveProperty(id);
  }
});
