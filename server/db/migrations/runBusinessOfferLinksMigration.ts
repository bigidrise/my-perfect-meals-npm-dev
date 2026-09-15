import { sql } from "drizzle-orm";

type MigrationDatabase = { execute: (query: any) => Promise<any> };

export async function runBusinessOfferLinksMigration(database: MigrationDatabase): Promise<void> {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_offer_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE CASCADE,
      affiliate_account_id integer NOT NULL REFERENCES user_affiliate_accounts(id) ON DELETE RESTRICT,
      rewardful_affiliate_id text NOT NULL,
      rewardful_referral_token text NOT NULL,
      name text NOT NULL,
      trial_days integer NOT NULL CHECK (trial_days IN (7, 14, 30)),
      offer_type text NOT NULL DEFAULT 'business_offer' CHECK (offer_type = 'business_offer'),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      public_token uuid NOT NULL DEFAULT gen_random_uuid(),
      starts_at timestamptz,
      expires_at timestamptz,
      max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
      created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      revoked_at timestamptz,
      revoked_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
      revoke_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS business_offer_links_public_token_uq
      ON business_offer_links(public_token)
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS business_offer_links_org_location_duration_uq
      ON business_offer_links(organization_id, location_id, trial_days)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_offer_links_org_status_idx
      ON business_offer_links(organization_id, status)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_offer_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id uuid NOT NULL REFERENCES business_offer_links(id) ON DELETE RESTRICT,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      location_id uuid NOT NULL REFERENCES organization_locations(id) ON DELETE RESTRICT,
      affiliate_account_id integer NOT NULL REFERENCES user_affiliate_accounts(id) ON DELETE RESTRICT,
      rewardful_affiliate_id text NOT NULL,
      rewardful_referral_token text NOT NULL,
      granted_duration_days integer NOT NULL CHECK (granted_duration_days IN (7, 14, 30)),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
      provenance text NOT NULL DEFAULT 'business_offer',
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      redeemed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_offer_entitlements_user_offer_uq UNIQUE (user_id, offer_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_offer_entitlements_user_active_idx
      ON business_offer_entitlements(user_id, ends_at)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_offer_entitlements_org_idx
      ON business_offer_entitlements(organization_id, redeemed_at)
  `);
  console.log("✅ Business Offer Links migration complete");
}