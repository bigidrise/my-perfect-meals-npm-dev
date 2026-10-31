import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";

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
