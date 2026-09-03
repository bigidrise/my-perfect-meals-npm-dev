import { db } from "../server/db";

async function migrate() {
  console.log("[Migrate] Creating user_affiliate_accounts table...");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_affiliate_accounts (
      id                        SERIAL PRIMARY KEY,
      user_id                   TEXT NOT NULL UNIQUE,
      affiliate_track           TEXT NOT NULL,
      required_phases           TEXT NOT NULL,
      phase_1_completed_at      TIMESTAMPTZ,
      phase_2_completed_at      TIMESTAMPTZ,
      rewardful_affiliate_id    TEXT,
      rewardful_state           TEXT,
      rewardful_referral_url    TEXT,
      rewardful_referral_token  TEXT,
      rewardful_campaign_id     TEXT,
      activated_at              TIMESTAMPTZ,
      welcome_email_sent_at     TIMESTAMPTZ,
      provider_verified_snapshot BOOLEAN DEFAULT FALSE,
      white_label_partner       TEXT,
      enterprise_partner        TEXT,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("[Migrate] ✅ user_affiliate_accounts table ready.");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("[Migrate] ❌ Failed:", e);
  process.exit(1);
});
