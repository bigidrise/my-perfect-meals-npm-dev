import { sql } from "drizzle-orm";
import {
  STARTUP_MIGRATION_LOCK_TIMEOUT_MS,
  STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS,
} from "../../bootstrap/runBoundedStartupMigration";

type MigrationDatabase = {
  transaction: <T>(callback: (transaction: MigrationDatabase) => Promise<T>) => Promise<T>;
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

export async function runNutritionPrioritiesMigration(database: MigrationDatabase) {
  await database.transaction(async (transaction) => {
    await transaction.execute(sql.raw(`SET LOCAL lock_timeout = '${STARTUP_MIGRATION_LOCK_TIMEOUT_MS}ms'`));
    await transaction.execute(sql.raw(`SET LOCAL statement_timeout = '${STARTUP_MIGRATION_STATEMENT_TIMEOUT_MS}ms'`));
    await transaction.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS food_inclusion_priorities jsonb`);
    await transaction.execute(sql`ALTER TABLE household_profiles ADD COLUMN IF NOT EXISTS food_inclusion_priorities jsonb`);
    await transaction.execute(sql`ALTER TABLE child_profiles ADD COLUMN IF NOT EXISTS food_inclusion_priorities jsonb`);
  });
}