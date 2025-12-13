
-- Up
ALTER TABLE diabetes_profile
ADD COLUMN guardrails JSONB DEFAULT NULL;

-- Down (for rollback)
-- ALTER TABLE diabetes_profile DROP COLUMN guardrails;
