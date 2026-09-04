import fs from "fs";

const phone = fs.readFileSync("server/routes/phone.ts", "utf8");
const archive = fs.readFileSync("server/routes/mealPlanArchive.routes.ts", "utf8");
const founders = fs.readFileSync("server/routes/foundersRoutes.ts", "utf8");
const directRoutes = fs.readFileSync("server/routes.ts", "utf8");

describe("U5 mounted-router isolation invariants", () => {
  it("guards every phone and SMS-consent operation before handler work", () => {
    expect(phone).toContain('router.use("/users/:userId", requireAuth');
    expect(phone).toContain("req.params.userId !== authUserId");
    expect(phone.match(/AuthenticatedRequest\)\.authUser\.id/g)).toHaveLength(5);
  });

  it("uses authenticated archive identity and owner-scopes opaque IDs", () => {
    expect(archive.match(/router\.(?:get|post|delete)\([^,\n]+, requireAuth/g)).toHaveLength(5);
    expect(archive).not.toContain("test-user-123");
    expect(archive.match(/AuthenticatedRequest\)\.authUser\.id/g)).toHaveLength(5);
    expect(archive.match(/eq\(aiMealPlanArchive\.userId, userId\)/g)).toHaveLength(3);
    expect(archive).toContain("eq(aiMealPlanArchive.userId, (req as AuthenticatedRequest).authUser.id)");
  });

  it("secures every production-direct archive POST before the mounted router", () => {
    const registrations = directRoutes
      .split("\n")
      .filter((line) => line.includes('app.post("/api/meal-plan-archive"'));
    expect(registrations).toHaveLength(2);
    for (const registration of registrations) {
      expect(registration).toContain("requireAuth");
    }

    const directArchiveBlocks = directRoutes.match(
      /app\.post\("\/api\/meal-plan-archive"[\s\S]*?res\.status\(201\)\.json\(newPlan\);/g,
    );
    expect(directArchiveBlocks).toHaveLength(2);
    for (const block of directArchiveBlocks ?? []) {
      expect(block).toContain("(req as AuthenticatedRequest).authUser.id");
      expect(block).not.toContain("test-user-123");
    }
  });

  it("keeps public testimonials readable while actor-binding all consent and testimonial writes", () => {
    expect(founders).toContain('router.get("/", async');
    expect(founders).toContain('router.post("/consent", requireAuth');
    expect(founders).toContain('router.post("/", requireAuth');
    expect(founders).toContain('router.get("/consent/:userId", requireAuth');
    expect(founders.match(/Forbidden/g)).toHaveLength(3);
    expect(founders.match(/userId: authUserId/g)).toHaveLength(2);
  });
});