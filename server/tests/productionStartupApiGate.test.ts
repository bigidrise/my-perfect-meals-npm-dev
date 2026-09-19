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
});