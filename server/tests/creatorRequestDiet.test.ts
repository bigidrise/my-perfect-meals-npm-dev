import fs from "node:fs";
import { resolveRequestDietOverride } from "../services/humanFoodContext/requestDiet";

describe("creator request diet resolution", () => {
  it("uses the builder-selected diet when there is no explicit hub override", () => {
    expect(resolveRequestDietOverride(null, "glp1")).toBe("glp1");
  });

  it("keeps an explicit hub override authoritative", () => {
    expect(resolveRequestDietOverride("vegan", "glp1")).toBe("vegan");
  });

  it("accepts one selected dietary preference without inventing a combined diet", () => {
    expect(resolveRequestDietOverride(null, ["vegetarian"])).toBe("vegetarian");
    expect(resolveRequestDietOverride(null, ["vegetarian", "low-sugar"])).toBeNull();
  });

  it("wires the canonical resolver into every universal creator route", () => {
    const unified = fs.readFileSync("server/routes.ts", "utf8");
    const dessert = fs.readFileSync("server/routes/dessert-creator.ts", "utf8");
    const beverage = fs.readFileSync("server/routes/beverage-creator.ts", "utf8");

    expect(unified).toContain("resolveRequestDietOverride(dietOverride, dietType)");
    expect(dessert).toContain("resolveRequestDietOverride(dietOverride, dietaryPreferences)");
    expect(beverage).toContain("resolveRequestDietOverride(dietOverride, dietaryPreferences)");
  });
});