import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("duplicate scan entry visibility", () => {
  it("hides the dashboard MacroScan card without removing its wiring", () => {
    const source = read("client/src/pages/DashboardNew.tsx");
    expect(source).toMatch(/className="hidden mb-4"[\s\S]*?data-testid="card-photo-log"/);
    expect(source).toContain("<MacroScanModal");
    expect(source).toContain("handlePhotoLog");
  });

  it("hides Biometrics Ingredient Intelligence without removing its wiring", () => {
    const source = read("client/src/pages/my-biometrics.tsx");
    expect(source).toMatch(/className="hidden" aria-hidden="true"[\s\S]*?data-testid="button-ingredient-intelligence"/);
    expect(source).toContain("<IngredientIntelligenceSheet");
    expect(source).toContain("handleIngredientScan");
  });
});