// scripts/run_migration.js
const { Client } = require("pg");

// Read the connection string from env var set in the shell
const connectionString = process.env.PGURL;
if (!connectionString) {
  console.error("❌ Missing PGURL. In the shell, run: export PGURL=\"<your postgres URL>\"");
  process.exit(1);
}

(async () => {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // required for Railway public network
  });

  try {
    await client.connect();
    console.log("🔗 Connected to Postgres");

    const alterSql = `
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS daily_protein_target INTEGER,
        ADD COLUMN IF NOT EXISTS daily_carbs_target INTEGER,
        ADD COLUMN IF NOT EXISTS daily_fat_target INTEGER;
    `;
    await client.query(alterSql);
    console.log("✅ Migration applied");

    const verifySql = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('daily_protein_target','daily_carbs_target','daily_fat_target')
      ORDER BY column_name;
    `;
    const { rows } = await client.query(verifySql);
    console.log("🔎 Columns found:", rows.map(r => r.column_name));

  } catch (err) {
    console.error("💥 Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log("👋 Disconnected");
  }
})();
