-- Foods I Enjoy Phase 1. Explicit preferences are separate from legacy
-- liked_foods; this migration intentionally does not copy existing values.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS foods_i_enjoy jsonb;

ALTER TABLE household_profiles
  ADD COLUMN IF NOT EXISTS foods_i_enjoy jsonb;