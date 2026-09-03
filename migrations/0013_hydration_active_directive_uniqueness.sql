-- A subject may never have more than one active Hydration directive.
-- Existing conflicts intentionally make this migration fail for manual review.

CREATE UNIQUE INDEX IF NOT EXISTS hydration_clinician_directives_one_active_subject_uniq
  ON hydration_clinician_directives (subject_user_id)
  WHERE status = 'active';