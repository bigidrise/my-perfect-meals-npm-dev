import fs from "fs";
import path from "path";

describe("thyroid generation exhausted-repair boundary", () => {
  it("rejects a known hard violation after retries rather than serving it", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../services/unifiedMealPipeline.ts"), "utf8");
    const thyroid = source.slice(source.indexOf("// ── Thyroid support post-gen scan"), source.indexOf("// ── Oncology hard-block post-gen scan"));
    expect(thyroid).toMatch(/if \(!thyroidValidation\.passed\)/);
    expect(thyroid).toMatch(/Could not resolve hard violations[\s\S]*return \{\s*success: false,\s*source: 'error'/);
    expect(thyroid).not.toMatch(/serving as-is/);
  });
});