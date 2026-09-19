import { classifyFoodIdentity, protectedFoodIdentityLabel } from "../../shared/foodIdentity";

describe("shared food identity", () => {
  test.each([
    ["chocolate chip cookie", "cookie"],
    ["fudge brownie", "brownie"],
    ["strawberry cheesecake", "cheesecake"],
    ["vanilla ice cream", "frozen_dessert"],
    ["banana pudding", "pudding_custard"],
    ["apple turnover pastry", "pastry"],
  ])("recognizes protected dessert identity for %s", (input, formatFamily) => {
    const identity = classifyFoodIdentity(input);
    expect(identity.foodRole).toBe("dessert");
    expect(identity.polarity).toBe("sweet");
    expect(identity.formatFamily).toBe(formatFamily);
    expect(protectedFoodIdentityLabel(input)).not.toBeNull();
  });

  it("keeps savory snacks valid without forcing dessert", () => {
    expect(classifyFoodIdentity("chips and salsa")).toMatchObject({
      foodRole: "general_snack",
      polarity: "savory",
      formatFamily: "general_snack",
    });
    expect(protectedFoodIdentityLabel("chips and salsa")).toBeNull();
  });

  it("does not classify every sweet or fruit-based snack as dessert", () => {
    expect(classifyFoodIdentity("fresh berries with cinnamon")).toMatchObject({
      foodRole: "general_snack",
      polarity: "sweet",
      formatFamily: "general_sweet",
    });
  });
});