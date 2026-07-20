/**
 * Migration: add classification_source column to macro_logs
 *
 * Values:
 *   'ingredient'  — macro values derived from ingredient-level data (most reliable)
 *   'user_input'  — user manually entered macros
 *   'unclassified' — source unknown (default for legacy rows)
 *
 * This column powers ledger reliability upgrades in C2 daily nutrition state.
 */
import { Pool } from "pg";

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE macro_logs
        ADD COLUMN IF NOT EXISTS classification_source VARCHAR(20)
          NOT NULL DEFAULT 'unclassified'
          CHECK (classification_source IN ('ingredient', 'user_input', 'unclassified'));
    `);
    console.log("✅ classification_source column added to macro_logs");

    // Backfill: if starchy_carbs > 0 or fibrous_carbs > 0, the data was ingredient-classified
    const { rowCount } = await client.query(`
      UPDATE macro_logs
        SET classification_source = 'ingredient'
      WHERE (starchy_carbs > 0 OR fibrous_carbs > 0)
        AND classification_source = 'unclassified';
    `);
    console.log(`✅ Backfilled ${rowCount} rows as 'ingredient' (had non-zero starchy/fibrous values)`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
