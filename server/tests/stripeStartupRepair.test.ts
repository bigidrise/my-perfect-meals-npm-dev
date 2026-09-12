import fs from "node:fs";
import path from "node:path";
import { awaitSingleBootMigration } from "../bootstrap/awaitSingleBootMigration";
import {
  runBoundedStartupMigration,
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
  STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS,
} from "../bootstrap/runBoundedStartupMigration";
import { assertStripeBillingSchema } from "../db/migrations/assertStripeBillingSchema";
import {
  handleStripeMigrationFailure,
  STRIPE_OWNERSHIP_REVIEW_MESSAGE,
} from "../services/stripeMigrationReview";

function reviewedConflict(): Error {
  const postgresError = Object.assign(
    new Error(STRIPE_OWNERSHIP_REVIEW_MESSAGE),
    { code: "P0001" },
  );
  return Object.assign(new Error("Failed query: DO $$ ..."), {
    cause: postgresError,
  });
}

function queryText(query: any): string {
  return query?.queryChunks
    ?.map((chunk: any) =>
      typeof chunk === "string" ? chunk : chunk?.value ?? "",
    )
    .join("") ?? String(query);
}

const allStripeColumns = [
  ["users", "stripe_last_event_created_at"],
  ["users", "stripe_last_event_rank"],
  ["users", "stripe_last_event_id"],
  ["users", "stripe_entitlement_source"],
  ["users", "stripe_reconciled_at"],
  ...[
    "event_id",
    "event_type",
    "event_created_at",
    "customer_id",
    "subscription_id",
    "user_id",
    "source",
    "status",
    "attempts",
    "error_message",
    "processed_at",
    "created_at",
    "updated_at",
  ].map((column) => ["stripe_billing_events", column]),
  ...[
    "identity_type",
    "identity_value",
    "owner_user_id",
    "business_id",
    "created_at",
    "updated_at",
  ].map((column) => ["stripe_identity_owners", column]),
  ...[
    "stripe_checkout_reservation_id",
    "stripe_checkout_session_id",
    "stripe_checkout_seat_count",
    "stripe_last_event_created_at",
    "stripe_last_event_rank",
    "stripe_last_event_id",
  ].map((column) => ["businesses", column]),
].map(([table_name, column_name]) => ({ table_name, column_name }));

const allStripeIndexes = [
  "stripe_identity_owners_owner_idx",
  "stripe_billing_events_subscription_idx",
  "stripe_billing_events_status_idx",
  "users_stripe_customer_id_uniq",
  "users_stripe_subscription_id_uniq",
  "businesses_stripe_customer_id_uniq",
  "businesses_stripe_subscription_id_uniq",
  "businesses_stripe_checkout_session_id_uniq",
].map((indexname) => ({ indexname }));

function fakeSchemaDb(options: { missingColumn?: string } = {}) {
  const statements: string[] = [];
  return {
    statements,
    execute: jest.fn(async (query: any) => {
      const raw = queryText(query);
      statements.push(raw);
      if (raw.includes("information_schema.columns")) {
        return {
          rows: allStripeColumns.filter(
            ({ column_name }) => column_name !== options.missingColumn,
          ),
        };
      }
      if (raw.includes("pg_indexes")) return { rows: allStripeIndexes };
      throw new Error(`Unexpected schema guard query: ${raw}`);
    }),
  };
}

describe("Production Stripe startup repair", () => {
  function fakePool(options: { executeError?: Error } = {}) {
    const queries: string[] = [];
    const client = {
      query: jest.fn(async (query: string) => {
        queries.push(query);
      }),
      release: jest.fn(),
    };
    const pool = {
      connect: jest.fn(async () => client),
    };
    const run = jest.fn(async () => {
      if (options.executeError) throw options.executeError;
    });
    return { pool, client, queries, run };
  }

  test("startup DDL receives finite PostgreSQL timeouts and resets its connection", async () => {
    const fixture = fakePool();
    await runBoundedStartupMigration({
      pool: fixture.pool as any,
      migrationName: "test-readiness",
      run: fixture.run,
      logger: { info: jest.fn(), error: jest.fn() },
    });

    expect(fixture.queries).toEqual([
      `SET lock_timeout = '${STARTUP_MIGRATION_LOCK_TIMEOUT_MS}ms'`,
      `SET statement_timeout = '${STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS}ms'`,
      "RESET lock_timeout",
      "RESET statement_timeout",
    ]);
    expect(fixture.run).toHaveBeenCalledTimes(1);
    expect(fixture.client.release).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["lock timeout", "55P03", "lock_timeout"],
    ["statement timeout", "57014", "statement_timeout"],
  ])("%s fails closed with sanitized logging", async (_label, code, failureKind) => {
    const databaseError = Object.assign(
      new Error("sensitive SQL text must not be logged"),
      { code },
    );
    const fixture = fakePool({ executeError: databaseError });
    const logger = { info: jest.fn(), error: jest.fn() };

    await expect(
      runBoundedStartupMigration({
        pool: fixture.pool as any,
        migrationName: "test-readiness",
        run: fixture.run,
        logger,
      }),
    ).rejects.toBe(databaseError);

    expect(fixture.run).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[startup-migration] failed",
      expect.objectContaining({
        migrationName: "test-readiness",
        failureKind,
        postgresCode: code,
      }),
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "sensitive SQL text",
    );
  });

  test("ordinary migration failures remain fatal", async () => {
    const databaseError = new Error("ordinary failure");
    const fixture = fakePool({ executeError: databaseError });
    await expect(
      runBoundedStartupMigration({
        pool: fixture.pool as any,
        migrationName: "test-readiness",
        run: fixture.run,
        logger: { info: jest.fn(), error: jest.fn() },
      }),
    ).rejects.toBe(databaseError);
  });

  test("repeated idempotent startup runs use fresh bounded connections", async () => {
    const first = fakePool();
    const second = fakePool();
    const logger = { info: jest.fn(), error: jest.fn() };

    await runBoundedStartupMigration({
      pool: first.pool as any,
      migrationName: "test-readiness",
      run: first.run,
      logger,
    });
    await runBoundedStartupMigration({
      pool: second.pool as any,
      migrationName: "test-readiness",
      run: second.run,
      logger,
    });

    expect(first.run).toHaveBeenCalledTimes(1);
    expect(second.run).toHaveBeenCalledTimes(1);
    expect(first.client.release).toHaveBeenCalledTimes(1);
    expect(second.client.release).toHaveBeenCalledTimes(1);
  });

  test("a timeout waits for the original migration and starts no second migration", async () => {
    let migrationStarts = 0;
    let finishMigration!: () => void;
    let completed = false;
    const migration = new Promise<void>((resolve) => {
      migrationStarts += 1;
      finishMigration = resolve;
    });

    const waiting = awaitSingleBootMigration(migration, 5, () => {});
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(migrationStarts).toBe(1);
    expect(completed).toBe(false);

    finishMigration();
    await waiting.then(() => {
      completed = true;
    });

    expect(migrationStarts).toBe(1);
    expect(completed).toBe(true);
  });

  test("prod startup contains one Stripe migration invocation and no sync duplicate", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/prod.ts"),
      "utf8",
    );
    expect(
      source.match(/runStripeBillingMigration\(database as any\)/g),
    ).toHaveLength(1);
    expect(source).not.toContain("runStripeBillingMigration(dbSyncMig");
    expect(source).not.toContain("const { db: dbSyncMig }");
    expect(source).toContain(
      "await awaitSingleBootMigration(schemaMigPromise, 6000",
    );
    expect(source).toContain("runBoundedStartupMigration({");
    expect(source).toContain('migrationName: "production-readiness-schema"');
    expect(source.indexOf("await awaitSingleBootMigration(schemaMigPromise, 6000"))
      .toBeLessThan(source.indexOf("isInitialized = true"));
  });

  test("the exact nested P0001 is nonfatal only after Stripe schema guard passes", async () => {
    const db = fakeSchemaDb();
    const warning = jest.fn();

    await expect(
      handleStripeMigrationFailure(
        reviewedConflict(),
        () => assertStripeBillingSchema(db as any),
        warning,
      ),
    ).resolves.toBeUndefined();

    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(
      "[ALERT] stripe_identity_ownership_review_required",
      expect.objectContaining({
        sqlState: "P0001",
        message: STRIPE_OWNERSHIP_REVIEW_MESSAGE,
        dataMutation: false,
      }),
    );
  });

  test("a different P0001 remains fatal", async () => {
    const other = Object.assign(new Error("Some other manual exception"), {
      code: "P0001",
    });
    const schemaGuard = jest.fn(async () => {});

    await expect(
      handleStripeMigrationFailure(other, schemaGuard),
    ).rejects.toBe(other);
    expect(schemaGuard).not.toHaveBeenCalled();
  });

  test("the reviewed P0001 remains fatal when Stripe schema is missing", async () => {
    const db = fakeSchemaDb({ missingColumn: "stripe_last_event_rank" });

    await expect(
      handleStripeMigrationFailure(
        reviewedConflict(),
        () => assertStripeBillingSchema(db as any),
      ),
    ).rejects.toThrow(
      "STARTUP GUARD: Stripe billing schema is incomplete",
    );
  });

  test("the reviewed exception path performs read-only schema inspection", async () => {
    const db = fakeSchemaDb();
    await handleStripeMigrationFailure(
      reviewedConflict(),
      () => assertStripeBillingSchema(db as any),
      () => {},
    );

    expect(db.statements).toHaveLength(2);
    for (const statement of db.statements) {
      expect(statement.trim()).toMatch(/^SELECT\b/i);
      expect(statement).not.toMatch(
        /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i,
      );
    }
  });
});