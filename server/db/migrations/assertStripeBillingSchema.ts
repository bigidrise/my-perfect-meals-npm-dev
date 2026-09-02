import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const REQUIRED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["users", "stripe_last_event_created_at"],
  ["users", "stripe_last_event_rank"],
  ["users", "stripe_last_event_id"],
  ["users", "stripe_entitlement_source"],
  ["users", "stripe_reconciled_at"],
  ["stripe_billing_events", "event_id"],
  ["stripe_billing_events", "event_type"],
  ["stripe_billing_events", "event_created_at"],
  ["stripe_billing_events", "customer_id"],
  ["stripe_billing_events", "subscription_id"],
  ["stripe_billing_events", "user_id"],
  ["stripe_billing_events", "source"],
  ["stripe_billing_events", "status"],
  ["stripe_billing_events", "attempts"],
  ["stripe_billing_events", "error_message"],
  ["stripe_billing_events", "processed_at"],
  ["stripe_billing_events", "created_at"],
  ["stripe_billing_events", "updated_at"],
  ["stripe_identity_owners", "identity_type"],
  ["stripe_identity_owners", "identity_value"],
  ["stripe_identity_owners", "owner_user_id"],
  ["stripe_identity_owners", "business_id"],
  ["stripe_identity_owners", "created_at"],
  ["stripe_identity_owners", "updated_at"],
  ["businesses", "stripe_checkout_reservation_id"],
  ["businesses", "stripe_checkout_session_id"],
  ["businesses", "stripe_checkout_seat_count"],
  ["businesses", "stripe_last_event_created_at"],
  ["businesses", "stripe_last_event_rank"],
  ["businesses", "stripe_last_event_id"],
];

const REQUIRED_INDEXES = [
  "stripe_identity_owners_owner_idx",
  "stripe_billing_events_subscription_idx",
  "stripe_billing_events_status_idx",
  "users_stripe_customer_id_uniq",
  "users_stripe_subscription_id_uniq",
  "businesses_stripe_customer_id_uniq",
  "businesses_stripe_subscription_id_uniq",
  "businesses_stripe_checkout_session_id_uniq",
] as const;

function resultRows(result: unknown): Array<Record<string, unknown>> {
  const candidate = result as { rows?: unknown } | Array<Record<string, unknown>>;
  if (Array.isArray(candidate)) return candidate;
  return Array.isArray(candidate?.rows) ? candidate.rows : [];
}

/**
 * Read-only guard for the schema that runStripeBillingMigration must provide.
 * It intentionally does not inspect or modify Stripe ownership data.
 */
export async function assertStripeBillingSchema(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  const columnResult = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'users' AND column_name IN (
          'stripe_last_event_created_at',
          'stripe_last_event_rank',
          'stripe_last_event_id',
          'stripe_entitlement_source',
          'stripe_reconciled_at'
        ))
        OR
        (table_name = 'stripe_billing_events' AND column_name IN (
          'event_id', 'event_type', 'event_created_at', 'customer_id',
          'subscription_id', 'user_id', 'source', 'status', 'attempts',
          'error_message', 'processed_at', 'created_at', 'updated_at'
        ))
        OR
        (table_name = 'stripe_identity_owners' AND column_name IN (
          'identity_type', 'identity_value', 'owner_user_id', 'business_id',
          'created_at', 'updated_at'
        ))
        OR
        (table_name = 'businesses' AND column_name IN (
          'stripe_checkout_reservation_id',
          'stripe_checkout_session_id',
          'stripe_checkout_seat_count',
          'stripe_last_event_created_at',
          'stripe_last_event_rank',
          'stripe_last_event_id'
        ))
      )
  `);

  const presentColumns = new Set(
    resultRows(columnResult).map((row) => `${row.table_name}.${row.column_name}`),
  );
  const missingColumns = REQUIRED_COLUMNS
    .map(([table, column]) => `${table}.${column}`)
    .filter((name) => !presentColumns.has(name));

  const indexResult = await db.execute(sql`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'stripe_identity_owners_owner_idx',
        'stripe_billing_events_subscription_idx',
        'stripe_billing_events_status_idx',
        'users_stripe_customer_id_uniq',
        'users_stripe_subscription_id_uniq',
        'businesses_stripe_customer_id_uniq',
        'businesses_stripe_subscription_id_uniq',
        'businesses_stripe_checkout_session_id_uniq'
      )
  `);
  const presentIndexes = new Set(
    resultRows(indexResult).map((row) => String(row.indexname)),
  );
  const missingIndexes = REQUIRED_INDEXES.filter(
    (indexName) => !presentIndexes.has(indexName),
  );

  if (missingColumns.length > 0 || missingIndexes.length > 0) {
    const missing = [
      ...missingColumns.map((name) => `column ${name}`),
      ...missingIndexes.map((name) => `index ${name}`),
    ];
    throw new Error(
      `🚨 STARTUP GUARD: Stripe billing schema is incomplete. Missing ${missing.join(", ")}`,
    );
  }

  console.log("✅ [guard] Stripe billing schema confirmed present");
}