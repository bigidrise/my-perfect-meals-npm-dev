import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../lib/databaseTls";

describe("database TLS configuration", () => {
  it("requires certificate verification for Neon connections", () => {
    expect(
      getDatabaseTlsConfig("postgresql://user:password@ep-example.neon.tech/app"),
    ).toEqual({ rejectUnauthorized: true });
  });

  it("does not allow a Neon connection-string query to disable verification", () => {
    const connectionString =
      "postgresql://user:password@ep-example.neon.tech/app?sslmode=disable";
    const ssl = getDatabaseTlsConfig(connectionString);
    const pool = new Pool({ connectionString, ssl });

    expect(ssl).toEqual({ rejectUnauthorized: true });
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });

    return pool.end();
  });

  it.each(["prefer", "require", "verify-ca", "verify-full"])(
    "requires certificate verification when sslmode=%s",
    (sslMode) => {
      expect(
        getDatabaseTlsConfig(
          `postgresql://user:password@db.example.com/app?sslmode=${sslMode}`,
        ),
      ).toEqual({ rejectUnauthorized: true });
    },
  );

  it("preserves non-TLS behavior when the URL does not request TLS", () => {
    expect(
      getDatabaseTlsConfig("postgresql://user:password@localhost:5432/app"),
    ).toBeUndefined();
  });

  it("preserves required TLS for scripts while enabling certificate verification", () => {
    expect(
      getDatabaseTlsConfig(
        "postgresql://user:password@db.example.com:5432/app",
        { requireTls: true },
      ),
    ).toEqual({ rejectUnauthorized: true });
  });

  it("rejects malformed connection URLs without echoing credentials", () => {
    const malformed = "not-a-postgresql-url-with-secret-password";

    expect(() => getDatabaseTlsConfig(malformed)).toThrow(
      "DATABASE_URL must be a valid PostgreSQL connection URL",
    );
    try {
      getDatabaseTlsConfig(malformed);
    } catch (error) {
      expect(String(error)).not.toContain("secret-password");
    }
  });

  it("keeps explicit certificate-verification bypasses out of server and scripts", () => {
    const roots = [
      path.resolve(__dirname, ".."),
      path.resolve(__dirname, "../../scripts"),
    ];
    const insecurePattern = /rejectUnauthorized\s*:\s*false/;
    const offenders: string[] = [];

    function scan(directory: string): void {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          scan(entryPath);
        } else if (
          entry.name.endsWith(".ts") &&
          entryPath !== __filename &&
          insecurePattern.test(fs.readFileSync(entryPath, "utf8"))
        ) {
          offenders.push(path.relative(process.cwd(), entryPath));
        }
      }
    }

    roots.forEach(scan);
    expect(offenders).toEqual([]);
  });
});