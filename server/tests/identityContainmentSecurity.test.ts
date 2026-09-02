import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("urgent identity containment", () => {
  const dessert = read("server/routes/dessert-creator.ts");
  const beverage = read("server/routes/beverage-creator.ts");
  const pairings = read("server/routes/chef-pairings.ts");
  const routes = read("server/routes.ts");
  const prod = read("server/prod.ts");
  const dev = read("server/index.ts");
  const uploads = read("server/replit_integrations/object_storage/routes.ts");
  const pregnancyCoach = read("server/routes/pregnancyCoach.ts");
  const fridge = read("server/routes/fridgeRescue.ts");
  const mealImages = read("server/routes/mealImages.ts");
  const safetyProfile = read("server/services/safetyProfileService.ts");
  const beverageClient = read("client/src/pages/BeverageCreator.tsx");
  const athleteBeverageClient = read("client/src/pages/AthleteBeverageCreator.tsx");

  it("protects Dessert Creator at every active mount", () => {
    expect(dev).toContain(
      'app.use("/api/meals/dessert-creator", requireAuth, requireActiveAccess, dessertCreatorRouter)',
    );
    expect(routes).toContain(
      'app.use("/api/meals/dessert-creator", requireAuth, requireProAccess, dessertCreatorRouterShared)',
    );
    expect(prod).not.toMatch(
      /app\.use\("\/api\/meals\/dessert-creator",\s*dessertCreatorRouter\)/,
    );
  });

  it("binds Dessert personalization to authenticated identity only", () => {
    expect(dessert).toContain("const userId = getAuthUserId(req)");
    expect(dessert).not.toMatch(/\buserId,\s*\n\s*safetyMode/);
    expect(dessert).not.toContain("userId: userId ??");
  });

  it("protects Beverage Creator at every active mount", () => {
    expect(dev).toContain(
      'app.use("/api/meals/beverage-creator", requireAuth, requireActiveAccess, beverageCreatorRouter)',
    );
    expect(routes).toContain(
      'app.use("/api/meals/beverage-creator", requireAuth, requireProAccess, beverageCreatorRouterShared)',
    );
    expect(prod).not.toMatch(
      /app\.use\("\/api\/meals\/beverage-creator",\s*beverageCreatorRouter\)/,
    );
  });

  it("binds Beverage personalization to authenticated identity only", () => {
    expect(beverage).toContain("const userId = getAuthUserId(req)");
    expect(beverage).not.toMatch(/\buserId:\s*_bodyUserId/);
    expect(beverage).not.toContain("userId: userId ??");
    expect(beverageClient).not.toMatch(/\buserId:\s*userId/);
    expect(athleteBeverageClient).not.toMatch(/\buserId:\s*userId/);
  });

  it("binds Chef Pairings personalization to authenticated identity only", () => {
    expect(pairings).toContain("const userId = getAuthUserId(req)");
    expect(pairings).not.toMatch(/\buserId,\s*\n\s*safetyMode/);
    expect(dev).toContain(
      'app.use("/api/ai/chef-pairings", requireAuth, requireActiveAccess, chefPairingsRouter)',
    );
    expect(routes).toContain(
      'app.use("/api/ai/chef-pairings", requireAuth, requireProAccess, chefPairingsRouterShared)',
    );
  });

  it("retires the legacy Pregnancy endpoint before identity lookup or generation", () => {
    const start = routes.indexOf(
      'app.post("/api/users/:userId/pregnancy-meal-plan"',
    );
    const nextRoute = routes.indexOf(
      'app.post("/api/holiday-family-recipe"',
      start,
    );
    const handler = routes.slice(start, nextRoute);

    expect(handler).toContain("res.status(410)");
    expect(handler).toContain('code: "ENDPOINT_RETIRED"');
    expect(handler).not.toContain("req.params.userId");
    expect(handler).not.toContain("db.select");
    expect(handler).not.toContain("generatePregnancyMealPlan");
  });

  it("keeps active Pregnancy Coach identity session-bound", () => {
    expect(pregnancyCoach).toContain(
      "return req.authUser?.id || (req.session as any)?.userId || req.user?.id",
    );
    expect(routes).toContain(
      'app.use("/api/pregnancy", requireAuth, requireClinicalAccess, pregnancyCoachRouter)',
    );
  });

  it("requires authentication before issuing upload URLs", () => {
    expect(uploads).toContain(
      'app.post("/api/uploads/request-url", requireAuth, async (req, res) =>',
    );
    expect(uploads).toContain('app.get("/objects/:objectPath(*)"');
  });

  it("preserves authenticated Fridge Rescue and meal-image boundaries", () => {
    expect(fridge).toContain(
      "router.post('/fridge-rescue/generate', requireAuth, requireActiveAccess",
    );
    expect(mealImages).toContain(
      "mealImagesRouter.post('/meal-images/generate', requireAuth",
    );
    expect(mealImages).toContain(
      "mealImagesRouter.post('/meal-images/recover', requireAuth",
    );
  });

  it("does not log identity or health details on repaired route paths", () => {
    expect(pairings).not.toMatch(/Blocked for user/);
    expect(dessert).not.toMatch(/Blocked dessert for user/);
    expect(dessert).not.toMatch(/Loaded palate preferences: flavor=/);
    expect(dessert).not.toMatch(/Sweetener allowlist: preferred=/);
    expect(dessert).not.toMatch(/Request params:/);
    expect(dessert).not.toMatch(/Profile loaded —/);
    expect(dessert).not.toMatch(/User medical profile loaded/);
    expect(beverage).not.toMatch(/Blocked beverage for user/);
    expect(beverage).not.toMatch(/Request params:/);
    expect(beverage).not.toMatch(/Nutrition context: diet=/);
    expect(beverage).not.toMatch(/Profile loaded —/);
    expect(beverage).not.toMatch(/User medical profile loaded/);
    expect(beverage).not.toMatch(/Protocol violation .*failedScan\.message/);
    expect(safetyProfile).not.toMatch(/Authenticated override used for user/);
    expect(safetyProfile).not.toMatch(/allergen: \$\{tokenData\.allergen\}/);
    expect(safetyProfile).not.toMatch(/User \$\{userId\}/);
    expect(pregnancyCoach).not.toMatch(/Setup saved for user/);
    expect(pregnancyCoach).not.toMatch(/symptoms=\$\{/);
  });
});