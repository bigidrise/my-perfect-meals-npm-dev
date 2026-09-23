import fs from "node:fs";
import path from "node:path";
import { ONE_TOUCH_CREATE_ENABLED, invokeCanonical } from "../routes/oneTouchCreate";

describe("One-Touch canonical-handler safety gate", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "server/routes/oneTouchCreate.ts"),
    "utf8",
  );

  it("remains fail-closed when Create Dish diet override cannot be preserved", () => {
    expect(ONE_TOUCH_CREATE_ENABLED).toBe(false);
    expect(source).toContain("dietOverride");
    expect(source).toContain("ONE_TOUCH_NOT_AVAILABLE");
    expect(source).toContain("status(503)");
  });

  it("proves the direct canonical capture seam itself", async () => {
    let called = false;
    const result = await invokeCanonical(async (_req, res) => {
      called = true;
      res.status(200).json({ meals: [{ name: "validated" }] });
    }, { body: {} } as any, { servings: 1 });
    expect(called).toBe(true);
    expect(result).toEqual({ status: 200, body: { meals: [{ name: "validated" }] } });
  });

  it("fails closed when canonical resolves without JSON", async () => {
    await expect(invokeCanonical(async () => undefined, { body: {} } as any, {}))
      .rejects.toThrow("ONE_TOUCH_CANONICAL_NO_JSON");
  });

  it("does not invent output or self-call over HTTP", () => {
    expect(source).not.toContain("generateCravingMealOptions");
    expect(source).not.toContain("scanGeneratedOutput");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("axios");
  });
});