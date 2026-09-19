ALTER TABLE users
  ADD COLUMN IF NOT EXISTS my_perfect_menu_preferences jsonb;

ALTER TABLE household_profiles
  ADD COLUMN IF NOT EXISTS my_perfect_menu_preferences jsonb;