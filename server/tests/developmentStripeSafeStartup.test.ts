import fs from "node:fs";
import ts from "typescript";

afterEach(() => jest.resetModules());

describe("free-pilot safe Development startup", () => {
  it("initializes suppression and checks the port before importing any application dependencies", async () => {
    const { runDevelopmentStartup } = require("../bootstrap/developmentStartup");
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    const order: string[] = [];
    const databaseWrite = jest.fn();
    await runDevelopmentStartup({
      env: { NODE_ENV: "development", DEVELOPMENT_SAFE_RESTART: "true", VITE_IS_PRODUCTION_PROJECT: "true" },
      checkPort: async (port: number) => { expect(port).toBe(5000); order.push("port"); },
      loadApplication: async () => {
        order.push("import");
        if (startupMaintenanceEnabled({ NODE_ENV: "development" })) databaseWrite();
      },
    });
    expect(order).toEqual(["port", "import"]);
    expect(databaseWrite).not.toHaveBeenCalled();
  });
  it.each([
    { NODE_ENV: "development", DEVELOPMENT_SAFE_RESTART: "ambiguous" },
    { NODE_ENV: "production", DEVELOPMENT_SAFE_RESTART: "true" },
    { NODE_ENV: "development", DEVELOPMENT_SAFE_RESTART: "true", REPLIT_DEPLOYMENT: "1" },
  ])("refuses ambiguous or Production bootstrap before imports: %j", async env => {
    const { runDevelopmentStartup } = require("../bootstrap/developmentStartup");
    const loadApplication = jest.fn();
    await expect(runDevelopmentStartup({ env, loadApplication, checkPort: jest.fn() })).rejects.toThrow();
    expect(loadApplication).not.toHaveBeenCalled();
  });
  it("does not import the app or launch writers if the port is occupied", async () => {
    const { runDevelopmentStartup } = require("../bootstrap/developmentStartup");
    const loadApplication = jest.fn();
    await expect(runDevelopmentStartup({
      env: { NODE_ENV: "development", DEVELOPMENT_SAFE_RESTART: "true" },
      checkPort: async () => { throw new Error("occupied fixture"); },
      loadApplication,
    })).rejects.toThrow("occupied fixture");
    expect(loadApplication).not.toHaveBeenCalled();
  });
  it("leaves Production maintenance enabled", () => {
    const { startupMaintenanceEnabled } = require("../bootstrap/developmentStartupMaintenance");
    expect(startupMaintenanceEnabled({ NODE_ENV: "production", DEVELOPMENT_SAFE_RESTART: "true" })).toBe(true);
  });
  it("guards all module-scope deferred launch blocks; only read-only warmup and startup/retry remain outside", () => {
    const source = ts.createSourceFile("index.ts", fs.readFileSync("server/index.ts", "utf8"), ts.ScriptTarget.Latest);
    const unguarded: string[] = [];
    for (const statement of source.statements) {
      if (ts.isIfStatement(statement) && statement.expression.getText(source).includes("startupMaintenanceEnabled")) continue;
      if (ts.isFunctionDeclaration(statement)) continue; // inspected boot function separately
      function inspect(node: ts.Node) {
        if (ts.isCallExpression(node) && ["setTimeout", "setInterval"].includes(node.expression.getText(source))) {
          const text = node.getText(source);
          if (!text.includes("warmupService.start()")) unguarded.push(text.slice(0, 80));
        }
        ts.forEachChild(node, inspect);
      }
      inspect(statement);
    }
    expect(unguarded).toEqual([]);
    const bootstrap = fs.readFileSync("server/devBootstrap.ts", "utf8");
    expect(bootstrap).toContain('loadApplication: () => import("./index")');
    expect(bootstrap).not.toMatch(/import\s+.*from\s+["']\.\/(?:index|db|routes|services)/);
    const tablet = fs.readFileSync("server/routes/proTabletRoutes.ts", "utf8");
    expect(tablet).toContain("if (startupMaintenanceEnabled()) startVoiceJobWorker()");
  });
});
