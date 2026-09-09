import fs from "fs";
import path from "path";

describe("Snack Creator dietary transformation contract", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "server/services/unifiedMealPipeline.ts"),
    "utf8",
  );
  const snackCreator = source.slice(
    source.indexOf("TASK: Transform this craving into a HEALTHY snack"),
    source.indexOf("SNACK_MAX_REGENERATION_ATTEMPTS"),
  );

  it("preserves named food identity while transforming incompatible ingredients", () => {
    expect(snackCreator).toContain(
      "transform incompatible ingredients instead of changing it into a generic snack",
    );
    expect(snackCreator).toContain(
      "Every ingredient, description, and instruction must comply",
    );
  });

  it("does not seed the generator with animal dairy examples", () => {
    expect(snackCreator).not.toContain("Greek yogurt");
    expect(snackCreator).not.toContain("cottage cheese");
    expect(snackCreator).toContain("coconut yogurt");
  });
});