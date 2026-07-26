
-- GLP-1 Daily Tolerance Snapshot Table — Phase 1
--
-- Replaces the 12 tolerance columns that were briefly added to glp1_profile.
-- Daily tolerance is time-series data: each day's resolved state must be
-- preserved for trend analysis, provider dashboards, and audit history.
-- Storing it on glp1_profile would erase yesterday's record every morning.
--
-- Schema governance:
--   user_id + tolerance_date is a UNIQUE pair — one resolved snapshot per user
--   per day. Re-resolving the same day (e.g. after a later check-in) upserts
--   the existing row rather than creating a duplicate.
--
--   rules_applied   — IDs of approved rules that influenced this record
--   rules_withheld  — IDs of pending_review rules that were blocked (fail-closed)
--   rules_evaluated — union of applied + withheld (full audit trail)
--   nutrition_adaptations — meal/food directive strings for generators
--   safety_escalations    — provider-contact directives (separate from nutrition)
--   resolver_version      — semantic version of resolveDailyMedicationTolerance.ts
--   resolved_at     — when this snapshot was produced (server clock)
--
-- Down (rollback):
--   DROP TABLE IF EXISTS glp1_daily_tolerance;

-- Up
CREATE TABLE IF NOT EXISTS glp1_daily_tolerance (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  tolerance_date        DATE NOT NULL,
  nausea_level          TEXT NOT NULL DEFAULT 'none',
  has_vomiting          BOOLEAN NOT NULL DEFAULT FALSE,
  hydration_risk        TEXT NOT NULL DEFAULT 'none',
  has_reflux            BOOLEAN NOT NULL DEFAULT FALSE,
  has_diarrhea          BOOLEAN NOT NULL DEFAULT FALSE,
  has_constipation      BOOLEAN NOT NULL DEFAULT FALSE,
  appetite_level        TEXT NOT NULL DEFAULT 'normal',
  should_escalate       BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_reason     TEXT,
  water_ml_logged       INTEGER NOT NULL DEFAULT 0,
  rules_applied         TEXT[] NOT NULL DEFAULT '{}',
  rules_withheld        TEXT[] NOT NULL DEFAULT '{}',
  rules_evaluated       TEXT[] NOT NULL DEFAULT '{}',
  nutrition_adaptations TEXT[] NOT NULL DEFAULT '{}',
  safety_escalations    TEXT[] NOT NULL DEFAULT '{}',
  resolver_version      TEXT NOT NULL DEFAULT '1.0',
  resolved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tolerance_date)
);

CREATE INDEX IF NOT EXISTS glp1_daily_tolerance_user_date
  ON glp1_daily_tolerance(user_id, tolerance_date DESC);
