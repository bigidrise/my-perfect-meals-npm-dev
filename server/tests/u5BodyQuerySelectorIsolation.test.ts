import fs from "fs";

const routes = fs.readFileSync("server/routes.ts", "utf8");
const mealPlan = fs.readFileSync("server/routes/mealPlan.ts", "utf8");
const alcohol = fs.readFileSync("server/routes/alcohol.ts", "utf8");
const timePresets = fs.readFileSync("server/routes/timePresets.ts", "utf8");
const onboarding = fs.readFileSync("server/routes/onboardingProgress.ts", "utf8");

describe("U5 body and query identity isolation invariants", () => {
  it("authenticates all glycemic settings routes and replaces selectors with actor identity", () => {
    for (const method of ["get", "post", "put"]) {
      expect(routes).toContain(`app.${method}("/api/glycemic-settings", requireAuth`);
    }
    const start = routes.indexOf("// Glycemic settings routes");
    const end = routes.indexOf("// Barcode API routes", start);
    const block = routes.slice(start, end);
    expect(block.match(/Forbidden/g)).toHaveLength(3);
    expect(block.match(/userId: authUserId/g)).toHaveLength(2);
    expect(block).toContain("getUserGlycemicSettings(authUserId)");
    expect(block).not.toContain('|| "1"');
  });

  it("authenticates the meal-plan router and owner-scopes all reads and mutations", () => {
    expect(mealPlan).toContain("r.use(requireAuth)");
    expect(mealPlan).not.toContain('|| "1"');
    expect(mealPlan.match(/const userId = actorId\(req\)/g)).toHaveLength(7);
    expect(mealPlan.match(/eq\(mealPlans\.userId, userId\)/g)).toHaveLength(7);
    expect(mealPlan).toContain("userId,");
  });

  it("uses actor identity for alcohol logs and owner-scopes deletion", () => {
    expect(alcohol.match(/router\.(?:get|post|delete)\([^,\n]+, requireAuth/g)).toHaveLength(3);
    expect(alcohol.match(/AuthenticatedRequest\)\.authUser\.id/g)).toHaveLength(3);
    expect(alcohol).toContain("e.id === id && e.userId === userId");
    expect(alcohol).not.toContain("req.query.userId");
  });

  it("uses actor identity for every time-preset operation and opaque resource predicate", () => {
    expect(timePresets.match(/router\.(?:get|post)\([^,\n]+, requireAuth/g)).toHaveLength(4);
    expect(timePresets.match(/const userId = actorId\(req\)/g)).toHaveLength(4);
    expect(timePresets).not.toContain("req.query.userId");
    expect(timePresets).not.toContain("const { userId");
    expect(timePresets).toContain("eq(userTimePresets.userId, userId)");
  });

  it("requires self-authentication only when anonymous onboarding supplies an account ID", () => {
    expect(onboarding).toContain('r.use("/onboarding", allowDeviceOrAuthenticatedSelf)');
    expect(onboarding).toContain("suppliedUserId !== authUserId");
    expect(onboarding).toContain("if (!suppliedUserId) return next()");
    expect(onboarding.match(/AuthenticatedRequest\)\.authUser\.id/g)).toHaveLength(6);
  });
});