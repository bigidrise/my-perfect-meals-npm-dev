import fs from "fs";

const source = fs.readFileSync("server/routes.ts", "utf8");

function routeRegistration(method: string, path: string): string {
  const prefix = `app.${method}("${path}"`;
  const line = source.split("\n").find((candidate) => candidate.includes(prefix));
  if (!line) throw new Error(`Missing route registration: ${method.toUpperCase()} ${path}`);
  return line;
}

function sourceBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Unable to isolate source block: ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
}

describe("U5 production-effective selector isolation", () => {
  it("retires raw user creation instead of accepting caller-selected roles", () => {
    const block = sourceBetween(
      'app.post("/api/users"',
      'app.get("/api/users/:id"',
    );
    expect(block).toContain("LEGACY_USER_CREATION_RETIRED");
    expect(block).not.toContain("insertUserSchema.parse");
  });

  it("authenticates and actor-scopes meal-plan reads", () => {
    expect(routeRegistration("get", "/api/meal-plans/:userId")).toContain("requireAuth");
    const block = sourceBetween(
      'app.get("/api/meal-plans/:userId"',
      '// POST /api/meal-plans route moved',
    );
    expect(block).toContain("if (req.params.userId !== authUserId)");
    expect(block).toContain("eq(mealPlans.userId, authUserId)");
  });

  it("owner-scopes meal-plan mutation and blocks ownership reassignment", () => {
    expect(routeRegistration("patch", "/api/meal-plans/:id")).toContain("requireAuth");
    const block = sourceBetween(
      'app.patch("/api/meal-plans/:id"',
      "// Meal log routes",
    );
    expect(block).toContain("userId: _ignoredUserId");
    expect(block).toContain("eq(mealPlans.id, req.params.id)");
    expect(block).toContain("eq(mealPlans.userId, authUserId)");
  });

  it("authenticates all reminder operations and checks the path actor", () => {
    const routes = [
      ["post", "/api/users/:userId/reminders"],
      ["get", "/api/users/:userId/reminders"],
      ["delete", "/api/users/:userId/reminders/:reminderId"],
      ["patch", "/api/users/:userId/reminders/:reminderId"],
    ];

    for (const [method, path] of routes) {
      expect(routeRegistration(method, path)).toContain("requireAuth");
    }

    const block = sourceBetween(
      "// Meal Reminder API Routes",
      "// Debug endpoint to list all scheduled reminders",
    );
    expect(block.match(/if \((?:req\.params\.userId|userId) !== authUserId\)/g)).toHaveLength(4);
    expect(block).toContain("userId: authUserId");
    expect(block.match(/storage\.getMealReminders\(authUserId\)/g)).toHaveLength(3);
  });

  it("authenticates and actor-scopes meal preference reads and writes", () => {
    expect(routeRegistration("get", "/api/user-meal-prefs/:userId")).toContain("requireAuth");
    expect(routeRegistration("put", "/api/user-meal-prefs/:userId")).toContain("requireAuth");

    const block = sourceBetween(
      "// User Meal Preferences API endpoints",
      "// ── Canonical active-protocol state",
    );
    expect(block.match(/if \(userId !== authUserId\)/g)).toHaveLength(2);
    expect(block).toContain("eq(userMealPrefs.userId, authUserId)");
    expect(block).toContain("userId: authUserId");
  });

  it("self-binds user-specific nutrition generators and child progress", () => {
    const routes = [
      ["post", "/api/wmc2/:userId/regenerate"],
      ["post", "/api/weekly-meal-plan/:userId/regenerate"],
      ["post", "/api/users/:userId/meal-plan/generate"],
      ["post", "/api/users/:userId/testosterone-meal-plan"],
      ["get", "/api/kids/veggie-explorer/:userId/progress"],
    ];
    for (const [method, path] of routes) {
      expect(routeRegistration(method, path)).toContain("requireAuth");
    }

    const wmc = sourceBetween(
      'app.post("/api/wmc2/:userId/regenerate"',
      'app.post("/api/ai/generate-meal-plan"',
    );
    expect(wmc).toContain("req.params.userId !== authUserId");
    expect(wmc).toContain("wmc2Regenerate(authUserId");

    const weekly = sourceBetween(
      'app.post("/api/weekly-meal-plan/:userId/regenerate"',
      "// User routes",
    );
    expect(weekly).toContain("req.params.userId !== authUserId");
    expect(weekly).toContain("eq(users.id, userId)");

    const generator = sourceBetween(
      'app.post("/api/users/:userId/meal-plan/generate"',
      "// Meal Planning Feature Routes",
    );
    expect(generator).toContain("req.params.userId !== authUserId");
    expect(generator).toContain("userId = authUserId");

    const testosterone = sourceBetween(
      'app.post("/api/users/:userId/testosterone-meal-plan"',
      "// Pregnancy meal plan generation",
    );
    expect(testosterone).toContain("req.params.userId !== authUserId");

    const veggie = sourceBetween(
      'app.get("/api/kids/veggie-explorer/:userId/progress"',
      "// Meal Logging API Routes",
    );
    expect(veggie).toContain("userId !== authUserId");
    expect(veggie).toContain("eq(kidsVeggieExplorer.userId, authUserId)");
  });

  it("restricts clinical protocol writes to active same-org physicians", () => {
    for (const path of [
      "/api/pro/thyroid-type/:userId",
      "/api/pro/hormone-optimization/:userId",
    ]) {
      expect(routeRegistration("put", path)).toContain("requireAuth");
    }
    const block = sourceBetween(
      "// PUT /api/pro/thyroid-type/:userId",
      "// PATCH /api/user/thyroid-type",
    );
    expect(block.match(/professionalRole !== "physician"/g)).toHaveLength(2);
    expect(block.match(/verifyPhysicianClientAccess\(physicianId, clientUserId\)/g)).toHaveLength(2);
    expect(block.match(/handleOrgIsolationError\(error, res\)/g)).toHaveLength(2);
  });

  it("binds recipe actions to the actor and restricts reminder diagnostics to admins", () => {
    expect(routeRegistration("post", "/api/recipes/:id/save")).toContain("requireAuth");
    expect(routeRegistration("post", "/api/recipes/:id/add-to-week")).toContain("requireAuth");
    expect(routeRegistration("get", "/api/debug/reminders")).toContain("requireAuth");

    const recipeBlock = sourceBetween(
      "// Recipe action routes",
      "// Send current weekly plan to macros",
    );
    expect(recipeBlock.match(/AuthenticatedRequest\)\.authUser\.id/g)).toHaveLength(2);
    expect(recipeBlock).not.toContain("00000000-0000-0000-0000-000000000001");

    expect(routeRegistration("get", "/api/debug/reminders")).toContain("requireAuth");
    expect(source).toContain("authUser.isAdmin");
  });
});