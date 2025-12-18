
-- Up
CREATE TABLE IF NOT EXISTS glp1_profile (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  guardrails JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down (for rollback)
-- DROP TABLE glp1_profile;
