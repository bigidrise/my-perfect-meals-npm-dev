import fs from "fs";
import path from "path";

describe("Fridge Rescue results heading", () => {
  test("uses the localized actual result count and never exposes resultsTitle", () => {
    const page = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/fridge-rescue.tsx"),
      "utf8",
    );
    expect(page).toContain('t("resultsCount", { count: meals.length })');
    expect(page).not.toContain('t("resultsTitle")');
  });
});