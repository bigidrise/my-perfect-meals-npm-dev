import { sql } from "drizzle-orm";

type MigrationDatabase = { execute: (query: any) => Promise<any> };

export async function runOrganizationWorkspaceMigration(
  database: MigrationDatabase,
): Promise<void> {
  await database.execute(sql`
    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS source_business_id uuid
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_source_business
      ON organizations(source_business_id)
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
      is_default boolean NOT NULL DEFAULT false,
      source_business_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS organization_locations_source_business_uniq
      ON organization_locations(source_business_id)
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS organization_locations_one_default_uniq
      ON organization_locations(organization_id)
      WHERE is_default = true
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organization_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'billing_admin', 'member')),
      status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, user_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organization_memberships_user_status_idx
      ON organization_memberships(user_id, status)
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS location_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member'
        CHECK (role IN ('owner', 'admin', 'coach', 'trainer', 'physician', 'nurse', 'staff', 'member')),
      status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (location_id, user_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS location_memberships_user_status_idx
      ON location_memberships(user_id, status)
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS user_workspace_selections (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE CASCADE,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // A missing canonical Organization is represented deterministically by the
  // legacy Business identity. The unique source link makes retries idempotent
  // and avoids name-based matching or duplicate Organizations.
  await database.execute(sql`
    INSERT INTO organizations (
      slug,
      name,
      active_status,
      organization_type,
      data_access_mode,
      feature_flags,
      source_business_id,
      created_at,
      updated_at
    )
    SELECT
      'business-' || b.id::text,
      b.name,
      CASE WHEN b.status = 'cancelled' THEN 'inactive' ELSE 'active' END,
      'enterprise',
      'standalone',
      '{}'::jsonb,
      b.id,
      now(),
      now()
    FROM businesses b
    WHERE b.organization_id IS NULL
    ON CONFLICT (source_business_id) DO NOTHING
  `);
  await database.execute(sql`
    UPDATE businesses b
       SET organization_id = o.id,
           updated_at = now()
      FROM organizations o
     WHERE b.organization_id IS NULL
       AND o.source_business_id = b.id
  `);

  await database.execute(sql`
    INSERT INTO organization_locations (
      organization_id,
      name,
      status,
      is_default,
      source_business_id,
      created_at,
      updated_at
    )
    SELECT
      b.organization_id,
      'Main Location',
      CASE WHEN b.status = 'cancelled' THEN 'inactive' ELSE 'active' END,
      true,
      b.id,
      now(),
      now()
    FROM businesses b
    WHERE b.organization_id IS NOT NULL
    ON CONFLICT (source_business_id) DO NOTHING
  `);

  await database.execute(sql`
    INSERT INTO organization_memberships (
      organization_id,
      user_id,
      role,
      status,
      created_at,
      updated_at
    )
    SELECT DISTINCT
      b.organization_id,
      bm.user_id,
      CASE
        WHEN bm.role = 'owner' THEN 'owner'
        WHEN bm.role = 'admin' THEN 'admin'
        ELSE 'member'
      END,
      CASE WHEN bm.status = 'active' THEN 'active' ELSE 'revoked' END,
      now(),
      now()
    FROM business_members bm
    JOIN businesses b ON b.id = bm.business_id
    JOIN users u ON u.id = bm.user_id
    WHERE b.organization_id IS NOT NULL
    ON CONFLICT (organization_id, user_id) DO UPDATE
      SET status = EXCLUDED.status,
          role = EXCLUDED.role,
          updated_at = now()
  `);

  await database.execute(sql`
    INSERT INTO location_memberships (
      location_id,
      user_id,
      role,
      status,
      created_at,
      updated_at
    )
    SELECT
      l.id,
      bm.user_id,
      CASE
        WHEN bm.role IN ('owner', 'admin', 'coach', 'trainer', 'physician', 'nurse', 'staff')
          THEN bm.role
        ELSE 'member'
      END,
      CASE WHEN bm.status = 'active' THEN 'active' ELSE 'revoked' END,
      now(),
      now()
    FROM business_members bm
    JOIN organization_locations l ON l.source_business_id = bm.business_id
    JOIN users u ON u.id = bm.user_id
    ON CONFLICT (location_id, user_id) DO UPDATE
      SET status = EXCLUDED.status,
          role = EXCLUDED.role,
          updated_at = now()
  `);
}