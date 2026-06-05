-- Diabetic Meal Memory System — Phase 1
-- Adds glucose context columns to saved_meals for BGL-stamped favorites

ALTER TABLE saved_meals
  ADD COLUMN IF NOT EXISTS generated_bgl_mgdl integer,
  ADD COLUMN IF NOT EXISTS glucose_context varchar(24),
  ADD COLUMN IF NOT EXISTS protocol_type text,
  ADD COLUMN IF NOT EXISTS bgl_bucket varchar(16),
  ADD COLUMN IF NOT EXISTS saved_from_diabetic_builder boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS saved_meals_bgl_bucket_idx ON saved_meals (user_id, bgl_bucket)
  WHERE bgl_bucket IS NOT NULL;
