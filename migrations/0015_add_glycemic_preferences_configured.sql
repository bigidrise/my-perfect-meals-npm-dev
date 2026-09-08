ALTER TABLE "user_glycemic_settings"
  ADD COLUMN IF NOT EXISTS "glycemic_preferences_configured" boolean NOT NULL DEFAULT false;