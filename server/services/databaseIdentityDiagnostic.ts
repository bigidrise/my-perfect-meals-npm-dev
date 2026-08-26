import crypto from "crypto";

export interface DatabaseIdentityQueryRow {
  databaseName: string | null;
  databaseOid: string | null;
  schemaName: string | null;
  serverVersionNum: string | null;
  serverAddress: string | null;
  serverPort: string | number | null;
}

export interface DatabaseIdentityDiagnostic {
  environment: "development" | "production";
  databaseName: string;
  schema: string;
  postgresVersionMajor: number | null;
  fingerprint: string;
}

function safeValue(value: string | number | null | undefined): string {
  return value == null || value === "" ? "unknown" : String(value);
}

function postgresMajorVersion(serverVersionNum: string | null | undefined): number | null {
  const version = Number(serverVersionNum);
  if (!Number.isFinite(version) || version <= 0) return null;
  return Math.floor(version / 10_000);
}

export function getRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): "development" | "production" {
  return env.NODE_ENV === "production" || Boolean(env.REPLIT_DEPLOYMENT)
    ? "production"
    : "development";
}

export function createDatabaseIdentityDiagnostic(
  row: DatabaseIdentityQueryRow,
  environment: "development" | "production",
): DatabaseIdentityDiagnostic {
  const databaseName = safeValue(row.databaseName);
  const databaseOid = safeValue(row.databaseOid);
  const schema = safeValue(row.schemaName);
  const serverVersionNum = safeValue(row.serverVersionNum);
  const serverAddress = safeValue(row.serverAddress);
  const serverPort = safeValue(row.serverPort);

  // Keep connection-specific inputs inside the one-way digest. Never return or
  // log the server address, port, database OID, or raw server version.
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      [
        "mpm-database-identity-v1",
        databaseName,
        databaseOid,
        schema,
        serverVersionNum,
        serverAddress,
        serverPort,
      ].join("\u001f"),
    )
    .digest("hex");

  return {
    environment,
    databaseName,
    schema,
    postgresVersionMajor: postgresMajorVersion(row.serverVersionNum),
    fingerprint,
  };
}