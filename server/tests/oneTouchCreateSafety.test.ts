import fs from "node:fs";
import path from "node:path";
import { ONE_TOUCH_CREATE_ENABLED, invokeCanonical, isCreatorMenuEnabled } from "../routes/oneTouchCreate";
import { getOneTouchDiet } from "../services/oneTouch/internalRequest";

describe("One-Touch canonical-handler safety gate", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "server/routes/oneTouchCreate.ts"),
    "utf8",
  );

  it("opens in Development and requires explicit Production enablement", () => {
    expect(ONE_TOUCH_CREATE_ENABLED).toBe(isCreatorMenuEnabled());
    expect(isCreatorMenuEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production", CREATOR_MENU_ENABLED: "false" })).toBe(false);
    expect(isCreatorMenuEnabled({ NODE_ENV: "production", CREATOR_MENU_ENABLED: "true" })).toBe(true);
    expect(isCreatorMenuEnabled({ NODE_ENV: undefined, CREATOR_MENU_ENABLED: "true" })).toBe(false);
    expect(source).toContain("dietOverride");
    expect(source).toContain("ONE_TOUCH_NOT_AVAILABLE");
    expect(source).toContain("status(503)");
  });

  it("uses separate client and server opt-ins and no customer-facing One-Touch label", () => {
    const clientGate = fs.readFileSync(
      path.join(process.cwd(), "client/src/lib/oneTouchAvailability.ts"), "utf8",
    );
    const dish = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/lifestyle/CreateDishPage.tsx"), "utf8",
    );
    const craving = fs.readFileSync(
      path.join(process.cwd(), "client/src/pages/craving-creator.tsx"), "utf8",
    );
    const modal = fs.readFileSync(
      path.join(process.cwd(), "client/src/components/one-touch/OneTouchCreateModal.tsx"), "utf8",
    );
    expect(clientGate).toContain('import.meta.env.VITE_CREATOR_MENU_ENABLED === "true"');
    expect(clientGate).toContain("import.meta.env.DEV");
    expect(dish).toContain("✨ Create a Dish Menu");
    expect(craving).toContain("✨ Craving Menu");
    expect(modal).toContain('creator === "create_a_dish" ? "Create a Dish Menu" : "Craving Menu"');
    expect(`${dish}\n${craving}\n${modal}`).not.toContain("One-Touch Create");
    expect(source).not.toContain('error: "One-Touch');
    expect(dish).toContain("if (!ONE_TOUCH_CREATE_ENABLED)");
    expect(craving).toContain("if (!ONE_TOUCH_CREATE_ENABLED)");
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

  it("carries only a server-authorized dietary choice into a delegated invocation", async () => {
    let observed: string | null = null;
    const handler = async (req: any, res: any) => {
      observed = getOneTouchDiet(req);
      res.json({ meals: [] });
    };
    const original = { body: { dietOverride: "vegan" } } as any;
    expect(getOneTouchDiet(original)).toBeNull();
    await invokeCanonical(handler, original, { humanFoodCreator: "create_a_dish" }, "vegan");
    expect(observed).toBe("vegan");
    expect(getOneTouchDiet(original)).toBeNull();
    await invokeCanonical(handler, original, { humanFoodCreator: "create_a_dish", dietOverride: "vegan" });
    expect(observed).toBeNull();
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