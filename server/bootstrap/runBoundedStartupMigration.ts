import type { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export const STARTUP_MIGRATION_LOCK_TIMEOUT_MS = 5_000;
export const STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS = 30_000;

type MigrationDatabase = {
  execute: (query: any) => Promise<any>;
};

type MigrationLogger = Pick<typeof console, "info" | "error">;

function failureKind(error: unknown): string {
  const code = typeof error === "object" && error !== null
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if (code === "55P03") return "lock_timeout";
  if (code === "57014") return "statement_timeout";
  return "migration_failure";
}

/**
 * Runs readiness-critical startup DDL on one dedicated connection.
 * PostgreSQL, not an application Promise timer, enforces the safety boundary.
 */
export async function runBoundedStartupMigration(options: {
  pool: Pool;
  migrationName: string;
  run: (database: MigrationDatabase) => Promise<void>;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  logger?: MigrationLogger;
}): Promise<void> {
  const {
    pool,
    migrationName,
    run,
    lockTimeoutMs = STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
    statementTimeoutMs = STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS,
    logger = console,
  } = options;
  const startedAt = Date.now();
  const client = await pool.connect();
  let operationError: unknown;

  logger.info("[startup-migration] started", {
    migrationName,
    lockTimeoutMs,
    statementTimeoutMs,
  });

  try {
    await client.query(`SET lock_timeout = '${lockTimeoutMs}ms'`);
    await client.query(`SET statement_timeout = '${statementTimeoutMs}ms'`);
    await run(drizzle(client) as MigrationDatabase);
    logger.info("[startup-migration] completed", {
      migrationName,
      elapsedMs: Date.now() - startedAt,
      lockTimeoutMs,
      statementTimeoutMs,
    });
  } catch (error) {
    operationError = error;
    logger.error("[startup-migration] failed", {
      migrationName,
      elapsedMs: Date.now() - startedAt,
      lockTimeoutMs,
      statementTimeoutMs,
      failureKind: failureKind(error),
      postgresCode:
        typeof error === "object" && error !== null
          ? String((error as { code?: unknown }).code ?? "unknown")
          : "unknown",
    });
    throw error;
  } finally {
    try {
      await client.query("RESET lock_timeout");
      await client.query("RESET statement_timeout");
      client.release();
    } catch (resetError) {
      client.release(
        resetError instanceof Error
          ? resetError
          : new Error("Failed to reset startup migration connection"),
      );
      if (!operationError) throw resetError;
    }
  }
}