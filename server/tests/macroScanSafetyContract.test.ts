import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Macro Scan nutrition-evidence safety contract", () => {
  const client = fs.readFileSync(
    path.join(root, "client/src/components/MacroScanModal.tsx"),
    "utf8",
  );
  const route = fs.readFileSync(
    path.join(root, "server/routes/biometricsRoutes.ts"),
    "utf8",
  );

  it("makes the Nutrition Facts target unmistakable", () => {
    expect(client).toContain("Nutrition Label Scan");
    expect(client).toContain("Take a photo of the Nutrition Facts label — not the barcode.");
    expect(client).toContain("Scan Nutrition Facts");
    expect(client).toContain("✓ THIS");
    expect(client).toContain("✕ NOT THIS");
  });

  it("does not close as successful for barcode-only or unreadable results", () => {
    expect(client).toContain('if (result.status !== "success")');
    const rejection = client.indexOf('if (result.status !== "success")');
    const success = client.indexOf("onSuccess(result)", rejection);
    expect(rejection).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(rejection);
  });

  it("classifies insufficient image evidence and returns zero macros", () => {
    expect(route).toContain('"barcode_only"');
    expect(route).toContain('"nutrition_facts_unreadable"');
    expect(route).toContain("Never invent macro values");
    expect(route).toContain("calories: 0");
    expect(route).toContain("protein: 0");
    expect(route).toContain("detail: 'high'");
    expect(route).toContain("macroValues.every((value) => value === 0)");
  });

  it("never returns fabricated average macros when AI analysis fails", () => {
    expect(route).not.toContain("Estimated meal (AI unavailable - using average meal values)");
    expect(route).not.toContain("calories: 350");
    expect(route).toContain("return res.status(503).json");
  });

  it("resets image inputs so the same photo can be selected again", () => {
    expect(client.match(/e\.currentTarget\.value = "";/g)?.length).toBeGreaterThanOrEqual(4);
  });
});