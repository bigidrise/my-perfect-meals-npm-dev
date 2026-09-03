/**
 * Phase 5 — Clinical Labs schema migration
 * Adds 7 new columns to the clinical_labs table.
 *
 * Run with: npx tsx scripts/migrate-clinical-labs-phase5.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

const migrations = [
  // Thyroid subtype — T4→T3 conversion marker
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS reverse_t3 NUMERIC(6,2)`,
  // Sex hormones / Menopause panel
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS estradiol NUMERIC(7,2)`,
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS progesterone NUMERIC(6,3)`,
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS shbg NUMERIC(6,1)`,
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS lh NUMERIC(7,2)`,
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS fsh NUMERIC(7,2)`,
  `ALTER TABLE clinical_labs ADD COLUMN IF NOT EXISTS dhea_s NUMERIC(7,2)`,
];

(async () => {
  console.log("[Phase 5 migration] Applying clinical_labs column additions…");
  let ok = 0;
  let failed = 0;
  for (const stmt of migrations) {
    try {
      await db.execute(sql.raw(stmt));
      const col = stmt.match(/ADD COLUMN IF NOT EXISTS (\S+)/)?.[1] ?? "?";
      console.log(`  ✓ ${col}`);
      ok++;
    } catch (e: any) {
      console.error(`  ✗ ${stmt.slice(0, 80)}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  }
  console.log(`\n[Phase 5 migration] Done — ${ok} applied, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})();
