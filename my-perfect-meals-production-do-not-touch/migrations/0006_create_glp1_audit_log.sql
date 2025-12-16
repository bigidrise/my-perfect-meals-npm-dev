
-- Up
CREATE TABLE IF NOT EXISTS glp1_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  clinician_id TEXT,
  action TEXT NOT NULL,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Down
DROP TABLE IF EXISTS glp1_audit_log;
