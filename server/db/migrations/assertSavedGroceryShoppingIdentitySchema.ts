import { sql } from "drizzle-orm";

type GuardDatabase = {
  execute: (query: any) => Promise<any>;
};

export async function assertSavedGroceryShoppingIdentitySchema(
  database: GuardDatabase,
): Promise<void> {
  const result = await database.execute(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'shopping_list_items'
          AND column_name = 'product_key'
      ) AS product_key_column,
      EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND tbl.relname = 'shopping_list_items'
          AND idx.relname = 'shopping_list_user_product_key_idx'
          AND NOT i.indisunique
          AND i.indnkeyatts = 2
          AND (
            SELECT array_agg(a.attname ORDER BY keys.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ordinality)
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = keys.attnum
            WHERE keys.ordinality <= i.indnkeyatts
          ) = ARRAY['user_id', 'product_key']::name[]
      ) AS product_key_index
  `);

  const row = ((result as any).rows ?? result)?.[0];
  if (row?.product_key_column !== true || row?.product_key_index !== true) {
    throw new Error(
      "🚨 STARTUP GUARD: Saved Grocery shopping identity schema is incomplete; refusing production readiness",
    );
  }

  console.log("✅ [guard] Saved Grocery shopping identity schema confirmed present");
}