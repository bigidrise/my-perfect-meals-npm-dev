import {
  createDatabaseIdentityDiagnostic,
  getRuntimeEnvironment,
  type DatabaseIdentityQueryRow,
} from "../services/databaseIdentityDiagnostic";
import fs from "fs";
import path from "path";

const baseRow: DatabaseIdentityQueryRow = {
  databaseName: "app",
  databaseOid: "12345",
  schemaName: "public",
  serverVersionNum: "160004",
  serverAddress: "10.0.0.1",
  serverPort: "5432",
};

describe("database identity diagnostic", () => {
  it("returns only the safe allowlisted payload", () => {
    const diagnostic = createDatabaseIdentityDiagnostic(baseRow, "development");

    expect(diagnostic).toEqual({
      environment: "development",
      databaseName: "app",
      schema: "public",
      postgresVersionMajor: 16,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(diagnostic)).not.toContain(baseRow.serverAddress);
    expect(JSON.stringify(diagnostic)).not.toContain(baseRow.databaseOid);
    expect(JSON.stringify(diagnostic)).not.toContain(baseRow.serverVersionNum);
  });

  it("is stable for one database identity and changes for another", () => {
    const first = createDatabaseIdentityDiagnostic(baseRow, "development");
    const same = createDatabaseIdentityDiagnostic({ ...baseRow }, "production");
    const different = createDatabaseIdentityDiagnostic(
      { ...baseRow, databaseOid: "67890" },
      "production",
    );

    expect(first.fingerprint).toBe(same.fingerprint);
    expect(first.fingerprint).not.toBe(different.fingerprint);
  });

  it("handles missing identity values without exposing them", () => {
    const diagnostic = createDatabaseIdentityDiagnostic(
      {
        databaseName: null,
        databaseOid: null,
        schemaName: null,
        serverVersionNum: null,
        serverAddress: null,
        serverPort: null,
      },
      "production",
    );

    expect(diagnostic.databaseName).toBe("unknown");
    expect(diagnostic.schema).toBe("unknown");
    expect(diagnostic.postgresVersionMajor).toBeNull();
    expect(diagnostic.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("classifies runtime environments without returning deployment secrets", () => {
    expect(getRuntimeEnvironment({ NODE_ENV: "development", REPLIT_DEPLOYMENT: "" })).toBe(
      "development",
    );
    expect(getRuntimeEnvironment({ NODE_ENV: "production", REPLIT_DEPLOYMENT: "" })).toBe(
      "production",
    );
    expect(getRuntimeEnvironment({ NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" })).toBe(
      "production",
    );
  });
});

describe("database identity diagnostic route parity", () => {
  it("keeps the endpoint in the shared admin router", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../routes/admin.ts"),
      "utf-8",
    );
    expect(source).toContain('router.get("/database-identity"');
    expect(source).toContain("requireAuth + requireAdmin");
  });

  it("keeps the shared admin router mounted in development and production", () => {
    const devSource = fs.readFileSync(
      path.resolve(__dirname, "../index.ts"),
      "utf-8",
    );
    const prodSource = fs.readFileSync(
      path.resolve(__dirname, "../prod.ts"),
      "utf-8",
    );

    expect(devSource).toContain('app.use("/api/admin", requireAuth, requireAdmin, adminRouter)');
    expect(prodSource).toContain('app.use("/api/admin", requireAuth, requireAdmin, adminRouter)');
  });
});