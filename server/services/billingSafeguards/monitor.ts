import type Stripe from "stripe";
import type { Pool } from "pg";
import { inspectInventory, subscriptionInventory } from "./inventory";
import { billingSafeguardsEnabled } from "./runtime";
import { captureException } from "../../lib/sentry";

let requestScan: (() => void) | undefined;
export function requestBillingDuplicateScan(): void { requestScan?.(); }

export async function scanBillingDuplicates(input: {
  stripe: Stripe; pool: Pool; managedPrices: ReadonlyMap<string, string>;
  alert?: (event: { code: string; fingerprint: string; category: string; count: number }) => void;
}) {
  const [account, balance] = await Promise.all([
    input.stripe.accounts.retrieve(), input.stripe.balance.retrieve(),
  ]);
  const subscriptions = await subscriptionInventory(input.stripe);
  const findings = inspectInventory(subscriptions, input.managedPrices, account.id, balance.livemode);
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize scans without holding a lock during provider pagination.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      [`mpm-billing-scan:${account.id}:${balance.livemode}`]);
    for (const finding of findings) {
      await client.query(
        `INSERT INTO billing_duplicate_incidents
         (fingerprint,account_id,livemode,subject_key,category,subscription_ids)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (fingerprint) DO UPDATE SET last_seen_at=now(),
         last_alert_at=CASE WHEN billing_duplicate_incidents.state='resolved' THEN NULL
                            ELSE billing_duplicate_incidents.last_alert_at END,
         state=CASE WHEN billing_duplicate_incidents.state='resolved' THEN 'open'
                    ELSE billing_duplicate_incidents.state END,
         resolved_at=NULL`,
        [finding.fingerprint, account.id, balance.livemode, finding.subjectKey,
          finding.category, JSON.stringify(finding.subscriptionIds)],
      );
    }
    // Only a successfully completed full inventory can resolve old findings.
    await client.query(
      `UPDATE billing_duplicate_incidents SET state='resolved',resolved_at=now()
       WHERE account_id=$1 AND livemode=$2 AND state<>'resolved'
       AND NOT (fingerprint=ANY($3::text[]))`,
      [account.id, balance.livemode, findings.map(f => f.fingerprint)],
    );
    await client.query(
      `INSERT INTO billing_safeguard_scans (account_id,livemode,completed_at,subscription_count)
       VALUES ($1,$2,now(),$3) ON CONFLICT (account_id,livemode)
       DO UPDATE SET completed_at=now(),subscription_count=$3`,
      [account.id, balance.livemode, subscriptions.length],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  // Incidents are the durable outbox. Log delivery retries after failures.
  const pending = await input.pool.query(
    `SELECT fingerprint,category,jsonb_array_length(subscription_ids) AS count
     FROM billing_duplicate_incidents WHERE account_id=$1 AND livemode=$2
     AND state='open' AND (last_alert_at IS NULL OR last_alert_at<now()-interval '24 hours')`,
    [account.id, balance.livemode],
  );
  for (const row of pending.rows) {
    (input.alert ?? (event => {
      console.error(JSON.stringify(event));
      captureException(new Error(event.code), {
        component: "billing-safety", fingerprint: event.fingerprint,
        category: event.category, subscriptionCount: event.count,
      });
    }))({
      code: "MPM_BILLING_REVIEW_REQUIRED", fingerprint: row.fingerprint,
      category: row.category, count: row.count,
    });
    await input.pool.query(
      "UPDATE billing_duplicate_incidents SET last_alert_at=now() WHERE fingerprint=$1", [row.fingerprint],
    );
  }
  return { accountId: account.id, livemode: balance.livemode,
    subscriptionCount: subscriptions.length, findings };
}

/** Explicit bootstrap only; default-off and never called by tests or imports. */
export function startBillingDuplicateMonitor(input: Parameters<typeof scanBillingDuplicates>[0]): () => void {
  if (!billingSafeguardsEnabled()) return () => {};
  let running = false;
  let lastRun = 0;
  const run = async () => {
    if (running || Date.now() - lastRun < 60_000) return;
    lastRun = Date.now();
    running = true;
    try { await scanBillingDuplicates(input); }
    catch { console.error(JSON.stringify({ code: "MPM_BILLING_SCAN_FAILED", action: "operator_review_required" })); }
    finally { running = false; }
  };
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  void run();
  requestScan = () => { void run(); };
  return () => { clearInterval(timer); requestScan = undefined; };
}
