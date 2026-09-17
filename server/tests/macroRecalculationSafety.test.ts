import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("macro recalculation safety contract", () => {
  const calculator = fs.readFileSync(
    path.join(root, "client/src/pages/MacroCalculator.tsx"),
    "utf8",
  );
  const computeRoute = fs.readFileSync(
    path.join(root, "server/routes/macroCalculatorRoutes.ts"),
    "utf8",
  );
  const dailyLimits = fs.readFileSync(
    path.join(root, "client/src/lib/dailyLimits.ts"),
    "utf8",
  );
  const saveRoute = fs.readFileSync(
    path.join(root, "server/routes/manualMacros.ts"),
    "utf8",
  );

  it("requires two explicit yes-or-no confirmations when any saved macro configuration exists", () => {
    expect(calculator).toContain("Recalculate Your Macros?");
    expect(calculator).toContain("Replace Your Current Macro Targets?");
    expect(calculator).toContain("No, Keep My Settings");
    expect(calculator).toContain("Yes, Continue");
    expect(calculator).toContain("Yes, Recalculate");
    expect(calculator).toContain("requestMacroRecalculation");
    expect(calculator).toContain(
      "hasExistingSettings || hasExistingMacroTargets",
    );
    expect(calculator).toContain("if (hasSavedMacroConfiguration)");
  });

  it("does not persist merely computed targets", () => {
    expect(computeRoute).not.toContain("daily_nutrition_prescriptions");
    expect(computeRoute).not.toContain("Prescription persist");
    expect(saveRoute).toContain("if (selfSavePrescriptionDate)");
    expect(saveRoute).toContain("INSERT INTO daily_nutrition_prescriptions");
  });

  it("keeps authenticated local targets unchanged until the server save succeeds", () => {
    const requestIndex = dailyLimits.indexOf("await apiRequest(`/api/users/${userId}/macro-targets`");
    const localWriteIndex = dailyLimits.indexOf(
      "localStorage.setItem(key, JSON.stringify(targets));",
      requestIndex,
    );
    expect(requestIndex).toBeGreaterThan(-1);
    expect(localWriteIndex).toBeGreaterThan(requestIndex);
  });

  it("lets first-time users enter recalculation without confirmations", () => {
    expect(calculator).toContain("resetGuidedFlow();");
    expect(calculator).toMatch(
      /if \(hasSavedMacroConfiguration\)[\s\S]*?return;[\s\S]*?resetGuidedFlow\(\);/,
    );
  });
});