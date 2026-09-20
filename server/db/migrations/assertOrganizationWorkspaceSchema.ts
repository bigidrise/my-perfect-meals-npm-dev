import { sql } from "drizzle-orm";

type GuardDatabase = {
  execute: (query: any) => Promise<any>;
};

export async function assertOrganizationWorkspaceSchema(
  database: GuardDatabase,
): Promise<void> {
  const result = await database.execute(sql`
    SELECT
      to_regclass('public.organizations') IS NOT NULL AS organizations_table,
      to_regclass('public.organization_locations') IS NOT NULL AS locations_table,
      to_regclass('public.organization_memberships') IS NOT NULL AS organization_memberships_table,
      to_regclass('public.location_memberships') IS NOT NULL AS location_memberships_table,
      to_regclass('public.user_workspace_selections') IS NOT NULL AS workspace_selections_table,
      (
        SELECT count(*) = 8 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organization_locations'
          AND column_name IN ('id', 'organization_id', 'name', 'status', 'is_default', 'source_business_id', 'created_at', 'updated_at')
      ) AS location_columns,
      (
        SELECT count(*) = 8 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organization_memberships'
          AND column_name IN ('id', 'organization_id', 'user_id', 'role', 'relationship_type', 'status', 'created_at', 'updated_at')
      ) AS organization_membership_columns,
      (
        SELECT count(*) = 8 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'location_memberships'
          AND column_name IN ('id', 'location_id', 'user_id', 'role', 'relationship_type', 'status', 'created_at', 'updated_at')
      ) AS location_membership_columns,
      (
        SELECT count(*) = 4 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_workspace_selections'
          AND column_name IN ('user_id', 'organization_id', 'location_id', 'updated_at')
      ) AS workspace_selection_columns,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
          AND column_name = 'source_business_id'
      ) AS organization_source_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_members'
          AND column_name = 'location_id'
      ) AS business_member_location_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_members'
          AND column_name = 'relationship_type'
      ) AS business_member_relationship_column,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_invitations'
          AND column_name = 'location_id'
      ) AS invitation_location_column,
      (
        EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'idx_organizations_source_business'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%ON public.organizations USING btree (source_business_id)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'organization_locations_source_business_uniq'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%ON public.organization_locations USING btree (source_business_id)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'organization_locations_one_default_uniq'
            AND indexdef ILIKE 'CREATE UNIQUE INDEX%ON public.organization_locations USING btree (organization_id)%WHERE (is_default = true)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'organization_memberships_user_status_idx'
            AND indexdef NOT ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef ILIKE '%ON public.organization_memberships USING btree (user_id, status)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'location_memberships_user_status_idx'
            AND indexdef NOT ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef ILIKE '%ON public.location_memberships USING btree (user_id, status)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'business_members_location_status_idx'
            AND indexdef NOT ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef ILIKE '%ON public.business_members USING btree (location_id, status)'
        )
        AND EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = 'public'
            AND indexname = 'business_invitations_location_status_type_idx'
            AND indexdef NOT ILIKE 'CREATE UNIQUE INDEX%'
            AND indexdef ILIKE '%ON public.business_invitations USING btree (location_id, status, invitation_type)'
        )
      ) AS authorization_indexes,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_organizations_source_business'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      ) AS organization_source_unique_index,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'organization_locations_source_business_uniq'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      ) AS location_source_unique_index,
      EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'organization_locations_one_default_uniq'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
          AND indexdef ILIKE '%WHERE (is_default = true)%'
      ) AS one_default_location_index,
      (
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.organization_memberships'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE 'UNIQUE (organization_id, user_id)%'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.location_memberships'::regclass
            AND contype = 'u'
            AND pg_get_constraintdef(oid) ILIKE 'UNIQUE (location_id, user_id)%'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_memberships'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_memberships'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.location_memberships'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (location_id) REFERENCES organization_locations(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.location_memberships'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_workspace_selections'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_workspace_selections'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_workspace_selections'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (location_id) REFERENCES organization_locations(id) ON DELETE CASCADE'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.business_members'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (location_id) REFERENCES organization_locations(id) ON DELETE RESTRICT'
        )
        AND EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'public.business_invitations'::regclass
            AND pg_get_constraintdef(oid) ILIKE 'FOREIGN KEY (location_id) REFERENCES organization_locations(id) ON DELETE RESTRICT'
        )
      ) AS authorization_constraints
  `);

  const row = ((result as any).rows ?? result)?.[0];
  const required = [
    "organizations_table",
    "locations_table",
    "organization_memberships_table",
    "location_memberships_table",
    "workspace_selections_table",
    "location_columns",
    "organization_membership_columns",
    "location_membership_columns",
    "workspace_selection_columns",
    "organization_source_column",
    "business_member_location_column",
    "business_member_relationship_column",
    "invitation_location_column",
    "authorization_indexes",
    "organization_source_unique_index",
    "location_source_unique_index",
    "one_default_location_index",
    "authorization_constraints",
  ] as const;
  const missing = required.filter((key) => row?.[key] !== true);

  if (missing.length > 0) {
    throw new Error(
      `🚨 STARTUP GUARD: Organization workspace schema is incomplete (${missing.join(", ")}); refusing production readiness`,
    );
  }

  console.log("✅ [guard] Organization workspace authorization schema confirmed present");
}