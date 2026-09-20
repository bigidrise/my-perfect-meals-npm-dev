import fs from "fs";
import path from "path";

describe("production startup API readiness gate", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "server/prod.ts"),
    "utf8",
  );

  it("holds API requests before the server begins listening", () => {
    const gate = source.indexOf('app.use("/api", async (_req, res, next) =>');
    const listen = source.indexOf("const server = app.listen(");

    expect(gate).toBeGreaterThan(-1);
    expect(listen).toBeGreaterThan(gate);
    expect(source).toContain("initializationSettled");
  });

  it("returns a retryable service response instead of a startup 404", () => {
    expect(source).toContain('res.setHeader("Retry-After", "2")');
    expect(source).toContain('"SERVICE_STARTING"');
    expect(source).toContain("res.status(503).json");
  });

  it("releases waiting requests on both success and initialization failure", () => {
    const settleCalls = source.match(/settleInitialization\(\);/g) ?? [];

    expect(settleCalls).toHaveLength(2);
    expect(source.indexOf("isInitialized = true")).toBeLessThan(
      source.lastIndexOf("settleInitialization();"),
    );
  });

  it("keeps root and healthz unavailable until genuine readiness", () => {
    expect(source).toContain('app.get("/healthz", (_req, res) => {');
    expect(source).toContain('res.status(503).send("initialization failed")');
    expect(source).toContain('res.status(503).send("starting")');
    expect(source).toContain('res.status(200).send("ok")');
    expect(source).toContain('app.get("/", (_req, res, next) => {');
    expect(source).toContain('res.status(503).send("server starting")');
    expect(source.indexOf("isInitialized = true")).toBeLessThan(
      source.indexOf('console.log(`✅ [INIT] Server fully ready at:'),
    );
  });

  it("keeps release mutations opt-in and required guards before readiness", () => {
    const optIn = source.indexOf(
      'process.env.RUN_PRODUCTION_RELEASE_MIGRATIONS === "true"',
    );
    const criticalGuard = source.indexOf(
      "await assertColumnsExist(dbColGuardEarly, CRITICAL_COLUMNS)",
    );
    const authGuard = source.indexOf(
      "Required U3 authentication security schema is missing; refusing production readiness",
    );
    const ready = source.indexOf("isInitialized = true");

    expect(optIn).toBeGreaterThan(-1);
    expect(criticalGuard).toBeGreaterThan(optIn);
    expect(authGuard).toBeGreaterThan(optIn);
    expect(criticalGuard).toBeLessThan(ready);
    expect(authGuard).toBeLessThan(ready);
  });

  it("does not make deferred maintenance part of readiness", () => {
    const ready = source.indexOf("isInitialized = true");
    const backgroundServices = source.indexOf(
      "// Background services - AFTER full initialization (non-blocking)",
    );

    expect(backgroundServices).toBeGreaterThan(ready);
    expect(source).toContain(
      "// Explicit release work: schema mutations, indexes, backfills, and seeds.",
    );
    expect(source.indexOf(
      'if (process.env.RUN_DEFERRED_RELEASE_MAINTENANCE === "true")',
      ready,
    ))
      .toBeLessThan(
        source.indexOf(
          "// Explicit release work: schema mutations, indexes, backfills, and seeds.",
        ),
      );
  });

  it("instruments the Node preload before the OpenAI shim", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    );
    const deploymentConfig = fs.readFileSync(
      path.resolve(process.cwd(), ".replit"),
      "utf8",
    );
    const preload = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/startup-timing.mjs"),
      "utf8",
    );

    expect(packageJson.scripts.start).toContain(
      "--import=./scripts/startup-timing.mjs --import=openai/shims/node",
    );
    expect(deploymentConfig).toContain(
      "--import=./scripts/startup-timing.mjs --import=openai/shims/node",
    );
    expect(preload).toContain("[BOOT_TIMING] node-preload");
    expect(source).toContain("[BOOT_TIMING] application-entry");
  });
});