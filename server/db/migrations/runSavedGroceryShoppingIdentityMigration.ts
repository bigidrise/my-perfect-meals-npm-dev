import { sql } from "drizzle-orm";
import { db } from "../../db";

type MigrationDatabase = {
  execute: (query: any) => Promise<any>;
};

/**
 * Adds stable Saved Grocery identity to shopping-list rows.
 *
 * Existing rows are backfilled only when a user's saved product has the exact
 * normalized display name. New writes always persist product_key directly.
 */
export async function runSavedGroceryShoppingIdentityMigration(
  database: MigrationDatabase = db,
): Promise<void> {
  await database.execute(sql`
    ALTER TABLE shopping_list_items
    ADD COLUMN IF NOT EXISTS product_key text
  `);

  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS shopping_list_user_product_key_idx
    ON shopping_list_items (user_id, product_key)
  `);

  await database.execute(sql`
    UPDATE shopping_list_items AS list_item
    SET product_key = saved_item.product_key
    FROM user_saved_grocery_items AS saved_item
    WHERE list_item.user_id = saved_item.user_id
      AND list_item.product_key IS NULL
      AND lower(regexp_replace(trim(list_item.name), '\s+', ' ', 'g')) =
          lower(regexp_replace(trim(concat_ws(' ', saved_item.brand, saved_item.product_name)), '\s+', ' ', 'g'))
  `);
}