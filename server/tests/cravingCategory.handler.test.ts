import { readFileSync } from "node:fs";
import { CRAVING_CATEGORIES } from "../../shared/cravingCategories";
import { clientPayload, isolatedCravingHarness } from "./helpers/isolatedCravingHandler";

describe("saved active Craving handler — isolated, no DB/startup/model", () => {
  it.each(CRAVING_CATEGORIES)("delivers $label from the actual client payload to the registered handler", async category => {
    const h = isolatedCravingHarness();
    const response = await h.request(clientPayload({ cravingCategory: category.value }));
    expect(response.statusCode).toBe(422); // deliberately empty generator fixture
    expect(h.generate).toHaveBeenCalledTimes(1);
    expect(h.generate.mock.calls[0][0]).toContain(`OPTIONAL CRAVING CATEGORY: ${category.label}`);
    expect(h.generate.mock.calls[0][15]).toBe("chicken bowl"); // clean classification input
  });

  it("maps diet, cuisine and destination without discarding allergies", async () => {
    const h = isolatedCravingHarness();
    await h.request({
      ...clientPayload({ dietOverrideEnabled: true, dietOverrideValue: "dairy-free" }),
      cravingCategory: "sweet", targetMealType: "snacks",
    });
    expect(h.scope.mock.calls[0][0]).toMatchObject({
      actorUserId: "synthetic-user", subjectUserId: "synthetic-user",
      dietOverride: "dairy-free", cuisine: "Thai",
    });
    const args = h.generate.mock.calls[0];
    expect(args[1]).toBe("snack");
    expect(args[3]).toEqual(["dairy-free"]);
    expect(args[7]).toBe("Thai");
    expect(h.allergenPrompt).toHaveBeenCalledWith(["shellfish", "dairy"], "chicken bowl");
    expect(h.envelope.allergies).toEqual(["shellfish", "dairy"]);
    expect(h.envelope.dietaryIdentity).toEqual(["vegan"]);
    expect(h.safety.mock.calls[0][1]).toEqual({ kind: "food_intent", requestedDish: "chicken bowl" });
  });

  it.each(["dairy-free", "mediterranean"])("preserves the lower dropdown's unique %s choice", async diet => {
    const h = isolatedCravingHarness();
    await h.request(clientPayload({ dietOverrideEnabled: true, dietOverrideValue: diet }));
    expect(h.generate.mock.calls[0][3]).toEqual([diet]);
  });

  it("retains custom dietary restrictions when no explicit top diet is selected", async () => {
    const h = isolatedCravingHarness();
    const body = clientPayload({ dietaryRestrictions: "custom fixture restriction" });
    await h.request(body);
    expect(body.dietOverride).toBeUndefined();
    expect(h.scope.mock.calls[0][0].dietOverride).toBe("custom fixture restriction");
  });

  it("omitted and unsupported categories preserve identical existing generation arguments", async () => {
    const omitted = isolatedCravingHarness();
    const unsupported = isolatedCravingHarness();
    const empty = isolatedCravingHarness();
    await omitted.request(clientPayload());
    await unsupported.request({ ...clientPayload(), cravingCategory: "unsupported" });
    await empty.request({ ...clientPayload(), cravingCategory: "" });
    expect(omitted.generate.mock.calls[0]).toEqual(unsupported.generate.mock.calls[0]);
    expect(omitted.generate.mock.calls[0]).toEqual(empty.generate.mock.calls[0]);
    expect(omitted.generate.mock.calls[0][0]).not.toContain("OPTIONAL CRAVING CATEGORY");
    expect(omitted.generate.mock.calls[0][15]).toBeUndefined();
  });

  it.each([[1, "1 serving"], [3, "3 servings"], [100, "10 servings"], [0, "1 serving"]])(
    "maps serving selection %s through the existing formatter to %s", (servings, label) => {
      const h = isolatedCravingHarness();
      const payload = clientPayload({ servings });
      expect(payload.servings).toBe(servings);
      const result = h.format({ name: "fixture", ingredients: [{ quantity: 2 }] }, payload.servings);
      expect(result.meal.servingSize).toBe(label);
      expect(result.nutrition).toHaveBeenCalledWith(
        expect.objectContaining({ name: "fixture" }), parseInt(label),
      );
      expect(result.meal.ingredients[0].quantity).toBe(2 * parseInt(label));
    },
  );

  it("records the existing cooking-method gap instead of claiming generator support", async () => {
    const h = isolatedCravingHarness();
    await h.request(clientPayload({ cookMethod: "air-fryer" }));
    expect(clientPayload({ cookMethod: "air-fryer" }).cookMethod).toBe("air-fryer");
    expect(h.generate.mock.calls[0].flat().join(" ")).not.toContain("air-fryer");
    expect(h.scope.mock.calls[0][0]).not.toHaveProperty("cookMethod");
  });

  it("rejects missing actor authentication before any scope or generation work", async () => {
    const h = isolatedCravingHarness();
    expect((await h.request({ ...clientPayload(), userId: "forged-body-id" }, false)).statusCode).toBe(401);
    expect(h.scope).not.toHaveBeenCalled();
    expect(h.generate).not.toHaveBeenCalled();
  });

  it("honors allergy blocks even with category and diet overrides", async () => {
    const h = isolatedCravingHarness();
    h.safety.mockResolvedValue({ result: "BLOCKED", blockedTerms: ["shellfish"], message: "fixture block" } as any);
    const response = await h.request(clientPayload({
      cravingCategory: "seafood", dietOverrideEnabled: true, dietOverrideValue: "mediterranean",
    }));
    expect(response.statusCode).toBe(400);
    expect(response.body.safetyBlocked).toBe(true);
    expect(h.generate).not.toHaveBeenCalled();
  });

  it("fails closed on unresolved clinical context", async () => {
    const h = isolatedCravingHarness();
    h.context.status = "review_required";
    h.context.notices = ["synthetic unresolved clinical evidence"];
    const response = await h.request(clientPayload({ cravingCategory: "sweet" }));
    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe("HUMAN_FOOD_CONTEXT_UNRESOLVED");
    expect(h.generate).not.toHaveBeenCalled();
  });

  it("requires resolved GLP-1 targets when GLP-1 is active", async () => {
    const h = isolatedCravingHarness();
    h.glp.mockResolvedValue({ isActive: true, resolvedTargets: null, activationSources: [] } as any);
    const response = await h.request(clientPayload({ cravingCategory: "sweet" }));
    expect(response.statusCode).toBe(503);
    expect(h.generate).not.toHaveBeenCalled();
  });

  it("retains final protocol and clinical validation calls in the untouched handler source", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const handler = source.slice(source.indexOf("const cravingCreatorHandler"), source.indexOf('app.post("/api/meals/craving-creator"'));
    expect(handler).toContain("filterMealsByProtocol(_bglGatedOptions, _filterEnvelope");
    expect(handler).toContain("validateHumanFoodCandidate(");
    expect(handler).toContain("runFinalValidation(meal, validatedServings)");
    expect(handler).toContain("scanMealsForAllergenViolations(");
  });
});
