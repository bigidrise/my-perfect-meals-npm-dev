import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_records (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        partner_name TEXT,
        partner_types TEXT[] DEFAULT '{}',
        promo_code TEXT,
        customer_discount INTEGER,
        commission_rate INTEGER,
        commission_months INTEGER,
        stripe_promotion_code_id TEXT,
        rewardful_affiliate_id TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        accepted_at TIMESTAMPTZ,
        rewardful_created_at TIMESTAMPTZ,
        promo_code_assigned_at TIMESTAMPTZ,
        org_activated_at TIMESTAMPTZ,
        managed_payouts_at TIMESTAMPTZ,
        marketing_kit_ready_at TIMESTAMPTZ,
        campaign_active_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
    console.log("[migrate-partner-records] partner_records table ready");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate-partner-records] FAILED:", err);
  process.exit(1);
});
