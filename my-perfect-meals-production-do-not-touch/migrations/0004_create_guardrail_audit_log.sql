
-- Up
CREATE TABLE IF NOT EXISTS guardrail_audit_log (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down
DROP TABLE IF EXISTS guardrail_audit_log;
