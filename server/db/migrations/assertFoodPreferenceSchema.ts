import { sql } from "drizzle-orm";

type GuardDatabase = {
  execute: (query: any) => Promise<any>;
};

export async function assertFoodPreferenceSchema(
  database: GuardDatabase,
): Promise<void> {
  const result = await database.execute(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'foods_i_enjoy'
      ) AS user_foods_i_enjoy,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'household_profiles'
          AND column_name = 'foods_i_enjoy'
      ) AS household_foods_i_enjoy,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'my_perfect_menu_preferences'
      ) AS user_menu_preferences,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'household_profiles'
          AND column_name = 'my_perfect_menu_preferences'
      ) AS household_menu_preferences
  `);

  const row = ((result as any).rows ?? result)?.[0];
  if (
    row?.user_foods_i_enjoy !== true ||
    row?.household_foods_i_enjoy !== true ||
    row?.user_menu_preferences !== true ||
    row?.household_menu_preferences !== true
  ) {
    throw new Error(
      "🚨 STARTUP GUARD: Food preference schema is incomplete; refusing production readiness",
    );
  }

  console.log("✅ [guard] Food preference schema confirmed present");
}