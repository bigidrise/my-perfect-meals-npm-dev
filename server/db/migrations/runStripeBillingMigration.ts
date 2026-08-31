import { sql } from "drizzle-orm";

export async function runStripeBillingMigration(database: {
  execute: (query: any) => Promise<any>;
}): Promise<void> {
  await database.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS stripe_last_event_created_at timestamptz,
      ADD COLUMN IF NOT EXISTS stripe_last_event_rank integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_last_event_id varchar(255),
      ADD COLUMN IF NOT EXISTS stripe_entitlement_source varchar(32),
      ADD COLUMN IF NOT EXISTS stripe_reconciled_at timestamptz
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS stripe_billing_events (
      event_id varchar(255) PRIMARY KEY,
      event_type varchar(120) NOT NULL,
      event_created_at timestamptz NOT NULL,
      customer_id varchar(255),
      subscription_id varchar(255),
      user_id varchar(255),
      source varchar(32) NOT NULL,
      status varchar(32) NOT NULL DEFAULT 'processing',
      attempts integer NOT NULL DEFAULT 1,
      error_message text,
      processed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS stripe_billing_events_subscription_idx
      ON stripe_billing_events(subscription_id, event_created_at DESC)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS stripe_billing_events_status_idx
      ON stripe_billing_events(status, updated_at)
  `);
}
