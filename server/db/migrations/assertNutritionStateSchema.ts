import { sql } from "drizzle-orm";

type GuardDatabase = {
  execute: (query: any) => Promise<any>;
};

export async function assertNutritionStateSchema(
  database: GuardDatabase,
): Promise<void> {
  const result = await database.execute(sql`
    SELECT
      to_regclass('public.daily_nutrition_prescriptions') IS NOT NULL AS prescriptions_table,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_nutrition_prescriptions'
          AND column_name = 'meals_per_day'
      ) AS meals_per_day_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_nutrition_prescriptions'
          AND column_name = 'starch_meals_per_day'
      ) AS starch_meals_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_nutrition_prescriptions'
          AND column_name = 'starch_distribution_strategy'
      ) AS starch_strategy_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'macro_logs'
          AND column_name = 'board_item_reference'
      ) AS board_reference_column,
      EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = 'public'
          AND tbl.relname = 'macro_logs'
          AND idx.relname = 'macro_logs_board_item_ref_uniq'
          AND i.indisunique
          AND i.indnkeyatts = 1
          AND (
            SELECT array_agg(a.attname ORDER BY keys.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ordinality)
            JOIN pg_attribute a
              ON a.attrelid = i.indrelid
             AND a.attnum = keys.attnum
            WHERE keys.ordinality <= i.indnkeyatts
          ) = ARRAY['board_item_reference']::name[]
          AND pg_get_expr(i.indpred, i.indrelid) = '(board_item_reference IS NOT NULL)'
      ) AS board_reference_unique_index
  `);

  const row = ((result as any).rows ?? result)?.[0];
  const required = [
    "prescriptions_table",
    "meals_per_day_column",
    "starch_meals_column",
    "starch_strategy_column",
    "board_reference_column",
    "board_reference_unique_index",
  ] as const;
  const missing = required.filter((key) => row?.[key] !== true);

  if (missing.length > 0) {
    throw new Error(
      `🚨 STARTUP GUARD: Nutrition State schema is incomplete (${missing.join(", ")}); refusing production readiness`,
    );
  }

  console.log("✅ [guard] Nutrition State schema confirmed present");
}