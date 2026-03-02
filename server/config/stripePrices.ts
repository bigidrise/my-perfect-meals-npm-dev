
import type { LookupKey } from "../../client/src/data/planSkus";

const TEST_FALLBACK_PRICE = "price_1SUWfOJC1cXhpBKwzi4XECQ7";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const isTestMode = stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_");

if (isTestMode) {
  console.log("⚠️ Stripe is in TEST mode — using test-mode price IDs for all plans");
}

function resolvePrice(envVar: string | undefined, label: string): string {
  if (!envVar) {
    return TEST_FALLBACK_PRICE;
  }
  const trimmed = envVar.trim();
  if (isTestMode && trimmed !== TEST_FALLBACK_PRICE) {
    console.log(`⚠️ Skipping ${label} (${trimmed}) — live-mode price not usable with test key, using test fallback`);
    return TEST_FALLBACK_PRICE;
  }
  return trimmed;
}

export const STRIPE_PRICE_IDS: Record<LookupKey, string> = {
  mpm_basic_monthly: resolvePrice(process.env.STRIPE_PRICE_BASIC, "STRIPE_PRICE_BASIC"),
  mpm_premium_monthly: resolvePrice(process.env.STRIPE_PRICE_UPGRADE, "STRIPE_PRICE_UPGRADE"),
  mpm_premium_beta_monthly: resolvePrice(process.env.STRIPE_PRICE_UPGRADE_BETA, "STRIPE_PRICE_UPGRADE_BETA"),
  mpm_ultimate_monthly: resolvePrice(process.env.STRIPE_PRICE_ULTIMATE, "STRIPE_PRICE_ULTIMATE"),
  mpm_family_base_monthly: resolvePrice(process.env.STRIPE_PRICE_FAMILY_BASE, "STRIPE_PRICE_FAMILY_BASE"),
  mpm_family_all_premium_monthly: resolvePrice(process.env.STRIPE_PRICE_FAMILY_ALL_PREMIUM, "STRIPE_PRICE_FAMILY_ALL_PREMIUM"),
  mpm_family_all_ultimate_monthly: resolvePrice(process.env.STRIPE_PRICE_FAMILY_ALL_ULTIMATE, "STRIPE_PRICE_FAMILY_ALL_ULTIMATE"),
  mpm_procare_monthly: resolvePrice(process.env.STRIPE_PRICE_PROCARE, "STRIPE_PRICE_PROCARE"),
};

console.log("✅ Resolved Stripe Price IDs:", STRIPE_PRICE_IDS);
