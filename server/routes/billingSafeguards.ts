import { Router } from "express";
import Stripe from "../services/isolatedStripeClient";
import { pool } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { STRIPE_PRICE_IDS } from "../config/stripePrices";
import { billingSafeguardsEnabled, managedBillingPrices } from "../services/billingSafeguards/runtime";
import { scanBillingDuplicates, startBillingDuplicateMonitor } from "../services/billingSafeguards/monitor";

export const billingSafeguardsRouter = Router();
billingSafeguardsRouter.use(requireAuth, requireAdmin);
billingSafeguardsRouter.use((_req, res, next) => {
  if (!billingSafeguardsEnabled()) return res.status(503).json({ code: "BILLING_SAFEGUARDS_NOT_RELEASED" });
  next();
});
billingSafeguardsRouter.get("/incidents", async (_req, res) => {
  try {
    const [incidents, scans] = await Promise.all([
      pool.query(`SELECT fingerprint,category,subscription_ids,state,first_seen_at,last_seen_at,last_alert_at
                  FROM billing_duplicate_incidents ORDER BY last_seen_at DESC LIMIT 100`),
      pool.query("SELECT account_id,livemode,completed_at,subscription_count FROM billing_safeguard_scans"),
    ]);
    res.json({ incidents: incidents.rows, scans: scans.rows });
  } catch { res.status(503).json({ code: "BILLING_MONITOR_UNAVAILABLE" }); }
});
billingSafeguardsRouter.post("/scan", async (_req, res) => {
  try {
    res.json(await scanBillingDuplicates(monitorDependencies()));
  } catch { res.status(503).json({ code: "BILLING_SCAN_FAILED" }); }
});
billingSafeguardsRouter.post("/incidents/:fingerprint/acknowledge", async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(req.params.fingerprint)) return res.status(400).json({ code: "INVALID_INCIDENT" });
  try {
    const result = await pool.query(
      "UPDATE billing_duplicate_incidents SET state='acknowledged' WHERE fingerprint=$1 AND state='open' RETURNING fingerprint",
      [req.params.fingerprint],
    );
    res.json({ acknowledged: result.rowCount === 1 });
  } catch { res.status(503).json({ code: "BILLING_MONITOR_UNAVAILABLE" }); }
});

function monitorDependencies() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe not configured");
  return { stripe: new Stripe(process.env.STRIPE_SECRET_KEY), pool,
    managedPrices: managedBillingPrices(STRIPE_PRICE_IDS) };
}
export function initializeBillingSafeguardMonitor(): void {
  if (billingSafeguardsEnabled()) startBillingDuplicateMonitor(monitorDependencies());
}
