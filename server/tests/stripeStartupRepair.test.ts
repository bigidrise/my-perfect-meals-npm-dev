import fs from "node:fs";
import path from "node:path";
import { awaitSingleBootMigration } from "../bootstrap/awaitSingleBootMigration";
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