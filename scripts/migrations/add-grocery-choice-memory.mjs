import pg from "pg";

// Explicit, bounded, additive command only. Never run automatically at startup.
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("This approved migration is Development-command only.");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '3s'");
  await client.query("SET LOCAL statement_timeout = '10s'");
  // The established app uses shared external Neon. Do not create a replacement DB.
  const { rows } = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS has_users, to_regclass('public.user_saved_grocery_items') IS NOT NULL AS has_library");
  if (!rows[0]?.has_users || !rows[0]?.has_library) throw new Error("Expected application schema not found");
  await client.query(`CREATE TABLE IF NOT EXISTS public.user_grocery_choice_memory (
    user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ingredient_key varchar(64) NOT NULL,
    query text NOT NULL,
    shown_names jsonb NOT NULL DEFAULT '[]'::jsonb,
    preferred_name text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS user_grocery_choice_memory_owner_ingredient
    ON public.user_grocery_choice_memory(user_id, ingredient_key)`);
  await client.query("COMMIT");
  console.log("Approved grocery-choice memory table and account/ingredient index are ready; no customer records changed.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Grocery-choice migration failed; transaction rolled back.", { code: error?.code ?? "migration_error" });
  process.exitCode = 1;
} finally {
  await client.end();
}
