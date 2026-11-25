import { mealVerificationFailure } from "../services/mealVerificationFailure";
import { readFileSync } from "node:fs";

describe("Builder verification failure transport", () => {
  it.each(["INGREDIENT_SANITY_RETRY_EXHAUSTED", "NUTRITION_PLAUSIBILITY_RETRY_EXHAUSTED"])(
    "preserves %s and application status without sensitive exception text",
    code => {
      const result = mealVerificationFailure(Object.assign(new Error("secret profile and prompt"), {
        code, status: 422, stack: "private stack", profile: { secret: true },
      }));
      expect(result).toMatchObject({ success: false, source: "error", code, status: 422 });
      expect(result.error).toContain("No meal was added");
      expect(JSON.stringify(result)).not.toMatch(/secret|private|profile|prompt/);
    },
  );
  it("does not expose arbitrary error codes or statuses", () => {
    expect(mealVerificationFailure({ code: "PRIVATE_USER_DETAIL", status: 401 }))
      .toMatchObject({ code: "RECIPE_VERIFICATION_FAILED", status: 500 });
    expect(mealVerificationFailure(null).success).toBe(false);
  });
  it("keeps the existing HTTP transport contract and wires the sanitized pipeline result", () => {
    const route = readFileSync("server/routes.ts", "utf8");
    expect(route).toContain("res.json(result);");
    const pipeline = readFileSync("server/services/unifiedMealPipeline.ts", "utf8");
    expect(pipeline).toContain("return mealVerificationFailure(error, preferredLanguage);");
  });
  it("keeps GLP-1 exhaustion separate from ingredient measurement and hides private violations", () => {
    const error = { code: "glp1_compliance_retry_exhausted", violations: ["private profile"], message: "private prompt" };
    const result = mealVerificationFailure(error);
    expect(result).toMatchObject({ code: error.code, status: 422, failureReason: "glp1_requirements" });
    expect(result.error).toContain("current GLP-1 requirements");
    expect(JSON.stringify(result)).not.toMatch(/private|prompt|profile/);
    expect(mealVerificationFailure({ code: "INGREDIENT_SANITY_RETRY_EXHAUSTED" }).failureReason).toBe("ingredient_measurement");
    expect(mealVerificationFailure(error, "es-MX").error).toContain("No se agregó ninguna comida");
    expect(mealVerificationFailure({ code: "INGREDIENT_SANITY_RETRY_EXHAUSTED" }, "es").error).toContain("cantidades");
  });
});
