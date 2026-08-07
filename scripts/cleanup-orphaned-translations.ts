/**
 * One-time cleanup: remove meal_translations rows whose saved_meal_id no longer
 * exists in saved_meals (orphaned by prior deletions that didn't clean up).
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-translations.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[cleanup] Scanning for orphaned meal_translations rows…");

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS orphan_count
    FROM meal_translations mt
    WHERE NOT EXISTS (
      SELECT 1 FROM saved_meals sm WHERE sm.id = mt.saved_meal_id
    )
  `);

  const orphanCount = Number((countResult.rows?.[0] as any)?.orphan_count ?? 0);
  console.log(`[cleanup] Found ${orphanCount} orphaned translation row(s).`);

  if (orphanCount === 0) {
    console.log("[cleanup] Nothing to do. Exiting.");
    process.exit(0);
  }

  const deleteResult = await db.execute(sql`
    DELETE FROM meal_translations
    WHERE NOT EXISTS (
      SELECT 1 FROM saved_meals sm WHERE sm.id = meal_translations.saved_meal_id
    )
  `);

  const deleted = (deleteResult as any).rowCount ?? orphanCount;
  console.log(`[cleanup] Deleted ${deleted} orphaned translation row(s). Done.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[cleanup] Fatal error:", err);
  process.exit(1);
});
