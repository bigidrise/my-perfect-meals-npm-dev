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
    CREATE TABLE IF NOT EXISTS stripe_identity_owners (
      identity_type varchar(32) NOT NULL,
      identity_value varchar(255) NOT NULL,
      owner_user_id varchar(255) NOT NULL,
      business_id varchar(255),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (identity_type, identity_value)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS stripe_identity_owners_owner_idx
      ON stripe_identity_owners(owner_user_id, business_id)
  `);
  await database.execute(sql`
    INSERT INTO stripe_identity_owners(identity_type, identity_value, owner_user_id, business_id)
    SELECT 'customer', stripe_customer_id, owner_user_id, id::text
      FROM businesses
      WHERE stripe_customer_id IS NOT NULL
    ON CONFLICT (identity_type, identity_value) DO NOTHING
  `);
  await database.execute(sql`
    INSERT INTO stripe_identity_owners(identity_type, identity_value, owner_user_id, business_id)
    SELECT 'subscription', stripe_subscription_id, owner_user_id, id::text
      FROM businesses
      WHERE stripe_subscription_id IS NOT NULL
    ON CONFLICT (identity_type, identity_value) DO NOTHING
  `);
  await database.execute(sql`
    INSERT INTO stripe_identity_owners(identity_type, identity_value, owner_user_id)
    SELECT 'customer', stripe_customer_id, id
      FROM users
      WHERE stripe_customer_id IS NOT NULL
    ON CONFLICT (identity_type, identity_value) DO NOTHING
  `);
  await database.execute(sql`
    INSERT INTO stripe_identity_owners(identity_type, identity_value, owner_user_id)
    SELECT 'subscription', stripe_subscription_id, id
      FROM users
      WHERE stripe_subscription_id IS NOT NULL
    ON CONFLICT (identity_type, identity_value) DO NOTHING
  `);
  await database.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM users u
        JOIN stripe_identity_owners sio
          ON (
            (sio.identity_type = 'customer' AND sio.identity_value = u.stripe_customer_id)
            OR
            (sio.identity_type = 'subscription' AND sio.identity_value = u.stripe_subscription_id)
          )
        WHERE sio.owner_user_id <> u.id
          OR sio.business_id IS NOT NULL
      ) OR EXISTS (
        SELECT 1
        FROM businesses b
        JOIN stripe_identity_owners sio
          ON (
            (sio.identity_type = 'customer' AND sio.identity_value = b.stripe_customer_id)
            OR
            (sio.identity_type = 'subscription' AND sio.identity_value = b.stripe_subscription_id)
          )
        WHERE sio.owner_user_id <> b.owner_user_id
          OR sio.business_id IS DISTINCT FROM b.id::text
      ) THEN
        RAISE EXCEPTION 'Conflicting Stripe identity ownership requires manual review';
      END IF;
    END $$;
  `);
  await database.execute(sql`
    ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS stripe_checkout_reservation_id varchar(255),
      ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar(255),
      ADD COLUMN IF NOT EXISTS stripe_checkout_seat_count integer,
      ADD COLUMN IF NOT EXISTS stripe_last_event_created_at timestamptz,
      ADD COLUMN IF NOT EXISTS stripe_last_event_rank integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_last_event_id varchar(255)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS stripe_billing_events_subscription_idx
      ON stripe_billing_events(subscription_id, event_created_at DESC)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS stripe_billing_events_status_idx
      ON stripe_billing_events(status, updated_at)
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_uniq
      ON users(stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_uniq
      ON users(stripe_subscription_id)
      WHERE stripe_subscription_id IS NOT NULL
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_customer_id_uniq
      ON businesses(stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_subscription_id_uniq
      ON businesses(stripe_subscription_id)
      WHERE stripe_subscription_id IS NOT NULL
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_checkout_session_id_uniq
      ON businesses(stripe_checkout_session_id)
      WHERE stripe_checkout_session_id IS NOT NULL
  `);
}
