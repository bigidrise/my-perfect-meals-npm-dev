import { sql } from "drizzle-orm";
import {
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
  STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS,
} from "../../bootstrap/runBoundedStartupMigration";

/**
 * Development and production boot-safe schema addition. No data is rewritten:
 * legacy likedFoods remains the compatibility source until a user explicitly
 * saves Foods I Enjoy.
 */
type MigrationDatabase = {
  transaction: <T>(callback: (transaction: MigrationDatabase) => Promise<T>) => Promise<T>;
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export async function runFoodsIEnjoyMigration(database: MigrationDatabase) {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql.raw(`SET LOCAL lock_timeout = '${STARTUP_MIGRATION_LOCK_TIMEOUT_MS}ms'`));
    await transaction.execute(sql.raw(`SET LOCAL statement_timeout = '${STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS}ms'`));
    await transaction.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS foods_i_enjoy jsonb`);
    await transaction.execute(sql`ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS foods_i_enjoy jsonb`);
  });
}