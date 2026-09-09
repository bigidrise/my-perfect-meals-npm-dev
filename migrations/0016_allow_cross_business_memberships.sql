-- Membership uniqueness belongs to the organization/user pair. Professionals
-- may remain active staff in one organization while owning another.
DROP INDEX IF EXISTS idx_business_members_one_active_per_user;

-- Preserve duplicate protection inside the same organization.
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_members_active
  ON business_members (business_id, user_id)
  WHERE status = 'active';