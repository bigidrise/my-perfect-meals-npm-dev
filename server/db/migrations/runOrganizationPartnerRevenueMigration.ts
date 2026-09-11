import { sql } from "drizzle-orm";

type MigrationDatabase = { execute: (query: any) => Promise<any> };

export async function runOrganizationPartnerRevenueMigration(
  database: MigrationDatabase,
): Promise<void> {
  await database.execute(sql`
    ALTER TABLE partner_records
      ADD COLUMN IF NOT EXISTS contact_email text
  `);
  await database.execute(sql`
    ALTER TABLE user_affiliate_accounts
      ADD COLUMN IF NOT EXISTS organization_id uuid
        REFERENCES organizations(id) ON DELETE CASCADE
  `);
  await database.execute(sql`
    ALTER TABLE partner_records
      ADD COLUMN IF NOT EXISTS organization_id uuid
        REFERENCES organizations(id) ON DELETE CASCADE
  `);
  await database.execute(sql`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE rel.relname = 'user_affiliate_accounts'
        AND con.contype = 'u'
      GROUP BY con.conname
      HAVING array_agg(att.attname ORDER BY att.attname)::text[] = ARRAY['user_id']::text[];
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE user_affiliate_accounts DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `);
  await database.execute(sql`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE rel.relname = 'partner_records'
        AND con.contype = 'u'
      GROUP BY con.conname
      HAVING array_agg(att.attname ORDER BY att.attname)::text[] = ARRAY['user_id']::text[];
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE partner_records DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_affiliate_accounts_organization_uq
      ON user_affiliate_accounts(organization_id)
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_affiliate_accounts_rewardful_affiliate_uq
      ON user_affiliate_accounts(rewardful_affiliate_id)
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS partner_records_organization_uq
      ON partner_records(organization_id)
  `);
  console.log("✅ Organization Partner & Revenue migration complete");
}