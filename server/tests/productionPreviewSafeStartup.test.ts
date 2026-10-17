import fs from "node:fs";
import ts from "typescript";

const previewEnvironment = {
  NODE_ENV: "production",
  REPLIT_DEV_DOMAIN: "fixture.replit.dev",
  PRODUCTION_PREVIEW_SAFE_START: "true",
  RUN_PRODUCTION_RELEASE_MIGRATIONS: "true",
  RUN_DEFERRED_RELEASE_MAINTENANCE: "true",
};

describe("isolated Production preview startup policy", () => {
  beforeEach(() => jest.resetModules());

  test("initializes suppression before the port probe and imports, despite inherited release switches", async () => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    const order: string[] = [];
    const effects = {
      migrations: jest.fn(), backfills: jest.fn(), seeding: jest.fn(),
      reminders: jest.fn(), voice: jest.fn(), purge: jest.fn(),
      recovery: jest.fn(), acknowledgements: jest.fn(), followups: jest.fn(),
      pruning: jest.fn(), deferredMaintenance: jest.fn(),
    };
    await runProductionPreviewStartup({
      env: previewEnvironment,
      checkPort: async (port: number) => {
        order.push("port");
        expect(port).toBe(5000);
        expect(startupMaintenanceEnabled(previewEnvironment)).toBe(false);
      },
      loadApplication: async () => {
        order.push("import");
        for (const effect of Object.values(effects)) {
          if (startupMaintenanceEnabled(previewEnvironment)) effect();
        }
      },
    });
    expect(order).toEqual(["port", "import"]);
    for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
  });

  test.each([
    { ...previewEnvironment, REPLIT_DEPLOYMENT: "1" },
    { ...previewEnvironment, REPLIT_DEPLOYMENT: "false" },
    { ...previewEnvironment, NODE_ENV: "development" },
    { ...previewEnvironment, REPLIT_DEV_DOMAIN: "" },
    { ...previewEnvironment, REPLIT_DEV_DOMAIN: "published.example.com" },
    { ...previewEnvironment, REPLIT_DEV_DOMAIN: "https://fixture.replit.dev" },
    { ...previewEnvironment, PRODUCTION_PREVIEW_SAFE_START: "yes" },
    { ...previewEnvironment, PRODUCTION_PREVIEW_SAFE_START: "false" },
    { ...previewEnvironment, PRODUCTION_PREVIEW_SAFE_START: "" },
  ])("refuses invalid or published diagnostic startup before any probe/import: %j", async env => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const loadApplication = jest.fn();
    const checkPort = jest.fn();
    await expect(runProductionPreviewStartup({ env, loadApplication, checkPort })).rejects.toThrow();
    expect(loadApplication).not.toHaveBeenCalled();
    expect(checkPort).not.toHaveBeenCalled();
  });

  test.each([
    "fixture..nested.replit.dev",
    "fixture.-nested.replit.dev",
    "fixture-.nested.replit.dev",
    ".fixture.replit.dev",
    "fixture.replit.dev.",
    "-fixture.replit.dev",
    "fixture-.replit.dev",
    "fixture_name.replit.dev",
    "fixturé.replit.dev",
    "fixture replit.dev",
    " fixture.replit.dev",
    "fixture.replit.dev\n",
    "fixture\n.nested.replit.dev",
    "fixture.replit.dev:5000",
    "fixture.replit.dev/path",
    "fixture.replit.dev.evil.example",
    "replit.dev",
    `${"a".repeat(64)}.replit.dev`,
    ["a".repeat(63), "b".repeat(63), "c".repeat(63), "d".repeat(51), "replit", "dev"].join("."),
  ])("rejects malformed or unpermitted preview hostname %j before any probe/import", async hostname => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const loadApplication = jest.fn();
    const checkPort = jest.fn();
    await expect(runProductionPreviewStartup({
      env: { ...previewEnvironment, REPLIT_DEV_DOMAIN: hostname }, loadApplication, checkPort,
    })).rejects.toThrow();
    expect(checkPort).not.toHaveBeenCalled();
    expect(loadApplication).not.toHaveBeenCalled();
  });

  test.each([
    "fixture.replit.dev",
    "fixture-123.replit.dev",
    "fixture.nested.replit.dev",
    "a.replit.dev",
    "1fixture.replit.dev",
    "FIXTURE.REPLIT.DEV",
    `${"a".repeat(63)}.replit.dev`,
    ["a".repeat(63), "b".repeat(63), "c".repeat(63), "d".repeat(50), "replit", "dev"].join("."),
  ])("accepts valid permitted preview hostname %j without changing suppression", async hostname => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    const env = { ...previewEnvironment, REPLIT_DEV_DOMAIN: hostname };
    const checkPort = jest.fn().mockResolvedValue(undefined);
    const loadApplication = jest.fn(async () => {
      expect(startupMaintenanceEnabled(env)).toBe(false);
    });
    await runProductionPreviewStartup({ env, checkPort, loadApplication });
    expect(checkPort).toHaveBeenCalledWith(5000);
    expect(loadApplication).toHaveBeenCalledTimes(1);
  });

  test.each(["0", "65536", "not-a-port"])("refuses invalid port %s before application imports", async PORT => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const loadApplication = jest.fn();
    const checkPort = jest.fn();
    await expect(runProductionPreviewStartup({
      env: { ...previewEnvironment, PORT }, loadApplication, checkPort,
    })).rejects.toThrow("Invalid Production preview PORT");
    expect(loadApplication).not.toHaveBeenCalled();
    expect(checkPort).not.toHaveBeenCalled();
  });

  test("honors the configured port and never imports the application when that port is occupied", async () => {
    const { runProductionPreviewStartup } = require("../bootstrap/productionPreviewStartup");
    const loadApplication = jest.fn();
    await expect(runProductionPreviewStartup({
      env: { ...previewEnvironment, PORT: "5090" },
      checkPort: async (port: number) => {
        expect(port).toBe(5090);
        throw new Error("occupied fixture");
      },
      loadApplication,
    })).rejects.toThrow("occupied fixture");
    expect(loadApplication).not.toHaveBeenCalled();
  });

  test("direct diagnostic imports cannot bypass pre-import initialization", () => {
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    expect(() => startupMaintenanceEnabled(previewEnvironment)).toThrow("prodPreviewBootstrap.ts");
  });

  test.each([undefined, "false", "true", "ambiguous"])("published startup retains normal workers with diagnostic switch %s", request => {
    const { resolveStartupMaintenanceMode, startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    const env = { ...previewEnvironment, REPLIT_DEPLOYMENT: "1", PRODUCTION_PREVIEW_SAFE_START: request };
    expect(resolveStartupMaintenanceMode(env)).toBe("normal");
    const worker = jest.fn();
    if (startupMaintenanceEnabled(env)) worker();
    expect(worker).toHaveBeenCalledTimes(1);
  });

  test("ordinary unpublished Production and existing Development behavior remain unchanged", () => {
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    expect(startupMaintenanceEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(startupMaintenanceEnabled({
      ...previewEnvironment, PRODUCTION_PREVIEW_SAFE_START: "false",
    })).toBe(true);
    expect(startupMaintenanceEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  test("a latched diagnostic mode cannot suppress a published runtime or silently cross workspace identity", () => {
    const {
      initializeProductionPreviewStartupMaintenance, startupMaintenanceEnabled,
    } = require("../bootstrap/developmentStartupMaintenance");
    initializeProductionPreviewStartupMaintenance(previewEnvironment);
    expect(startupMaintenanceEnabled({ ...previewEnvironment, REPLIT_DEPLOYMENT: "1" })).toBe(true);
    expect(() => startupMaintenanceEnabled({
      ...previewEnvironment, REPLIT_DEV_DOMAIN: "published.example.com",
    })).toThrow("runtime identity changed");
  });
});

describe("real Production startup launch-site contracts (no application imports)", () => {
  const productionText = fs.readFileSync("server/prod.ts", "utf8");
  const production = ts.createSourceFile("prod.ts", productionText, ts.ScriptTarget.Latest, true);
  const initializer = production.statements.find(
    statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "initializeApp",
  ) as ts.FunctionDeclaration;
  const tryStatement = initializer.body!.statements.find(ts.isTryStatement)!;
  const statements = tryStatement.tryBlock.statements;
  const maintenanceGate = statements.findIndex(statement =>
    ts.isIfStatement(statement) &&
    statement.expression.getText(production) === "!startupMaintenanceEnabled()" &&
    statement.thenStatement.getText(production).includes("return;"),
  );

  test("one early return dominates every background/deferred job, after authentication and readiness setup", () => {
    expect(maintenanceGate).toBeGreaterThan(0);
    const before = statements.slice(0, maintenanceGate).map(s => s.getText(production)).join("\n");
    const after = statements.slice(maintenanceGate + 1).map(s => s.getText(production)).join("\n");
    for (const retained of [
      "registerCsrfProtection(app)", "app.use(session(sessionConfig))",
      "await registerRoutes(app)", "await assertColumnsExist",
      "isInitialized = true", "settleInitialization()",
    ]) expect(before).toContain(retained);
    for (const suppressed of [
      "initDailyReminderCron()", "startReminderScheduler()", "startStudioVideoPurgeWorker()",
      "warmupService.start()", "RUN_DEFERRED_RELEASE_MAINTENANCE",
      "resumePendingMealImageRecoveries()", "startBugReportAcknowledgementWorker()",
      "initCoachFollowupCron()",
    ]) expect(after).toContain(suppressed);
  });

  test("all pre-ready timers and mutating SQL remain within explicit release-maintenance guards", () => {
    expect(productionText).toMatch(
      /const runReleaseMigrations\s*=\s*startupMaintenanceEnabled\(\)\s*&&\s*process\.env\.RUN_PRODUCTION_RELEASE_MIGRATIONS/,
    );
    const unguarded: string[] = [];
    function inspect(node: ts.Node, guarded: boolean) {
      if (ts.isIfStatement(node) && node.expression.getText(production) === "runReleaseMigrations") {
        inspect(node.thenStatement, true);
        if (node.elseStatement) inspect(node.elseStatement, guarded);
        return;
      }
      if (!guarded && ts.isCallExpression(node) &&
          ["setTimeout", "setInterval", "setImmediate", "runGrandfatherMigrations"].includes(node.expression.getText(production))) {
        unguarded.push(node.expression.getText(production));
      }
      if (!guarded && ts.isTaggedTemplateExpression(node) &&
          /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\b/.test(node.template.getText(production))) {
        unguarded.push("mutating SQL");
      }
      ts.forEachChild(node, child => inspect(child, guarded));
    }
    statements.slice(0, maintenanceGate).forEach(statement => inspect(statement, false));
    expect(unguarded).toEqual([]);
  });

  test("session pruning is suppressed without replacing the durable store or enabling schema creation", () => {
    expect(productionText).toContain("sessionConfig.store = new PgSession");
    expect(productionText).toContain("createTableIfMissing: false");
    expect(productionText).toContain("pruneSessionInterval: startupMaintenanceEnabled() ? 60 * 15 : false");
    expect(productionText).toContain('...sessionCookieSecurity("production")');
  });

  test("import-time workers and infrastructure timers use the same suppression policy", () => {
    const tablet = fs.readFileSync("server/routes/proTabletRoutes.ts", "utf8");
    expect(tablet).toContain("if (startupMaintenanceEnabled()) startVoiceJobWorker()");
    const database = fs.readFileSync("server/db.ts", "utf8");
    expect(database).toContain("if (startupMaintenanceEnabled()) setInterval");
    const notifications = fs.readFileSync("server/queue/notifyQueue.ts", "utf8");
    expect(notifications).toContain('redis && startupMaintenanceEnabled() ? new Queue');
    expect(notifications).toContain('redis && startupMaintenanceEnabled() ? new Worker');
  });

  test("the preview bootstrap has no static application/database/service imports", () => {
    const text = fs.readFileSync("server/prodPreviewBootstrap.ts", "utf8");
    expect(text).toContain('loadApplication: () => import("./prod")');
    expect(text).not.toMatch(/import\s+.*from\s+["']\.\/(?:prod["']|db|routes|services)/);
  });
});
