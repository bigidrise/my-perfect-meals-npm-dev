
import type { LookupKey } from "../../client/src/data/planSkus";

console.log("🔍 Loading Stripe Price IDs from environment:");
console.log("STRIPE_PRICE_BASIC:", process.env.STRIPE_PRICE_BASIC);
console.log("STRIPE_PRICE_UPGRADE_BETA:", process.env.STRIPE_PRICE_UPGRADE_BETA);
console.log("STRIPE_PRICE_UPGRADE:", process.env.STRIPE_PRICE_UPGRADE);
console.log("STRIPE_PRICE_ULTIMATE:", process.env.STRIPE_PRICE_ULTIMATE);
console.log("STRIPE_PRICE_FAMILY_BASE:", process.env.STRIPE_PRICE_FAMILY_BASE);
console.log("STRIPE_PRICE_FAMILY_ALL_PREMIUM:", process.env.STRIPE_PRICE_FAMILY_ALL_PREMIUM);
console.log("STRIPE_PRICE_FAMILY_ALL_ULTIMATE:", process.env.STRIPE_PRICE_FAMILY_ALL_ULTIMATE);
console.log("STRIPE_PRICE_PROCARE:", process.env.STRIPE_PRICE_PROCARE);

export const STRIPE_PRICE_IDS: Record<LookupKey, string> = {
  mpm_basic_monthly: (process.env.STRIPE_PRICE_BASIC || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_premium_monthly: (process.env.STRIPE_PRICE_UPGRADE || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_premium_beta_monthly: (process.env.STRIPE_PRICE_UPGRADE_BETA || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_ultimate_monthly: (process.env.STRIPE_PRICE_ULTIMATE || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_family_base_monthly: (process.env.STRIPE_PRICE_FAMILY_BASE || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_family_all_premium_monthly: (process.env.STRIPE_PRICE_FAMILY_ALL_PREMIUM || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_family_all_ultimate_monthly: (process.env.STRIPE_PRICE_FAMILY_ALL_ULTIMATE || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
  mpm_procare_monthly: (process.env.STRIPE_PRICE_PROCARE || "price_1SUWfOJC1cXhpBKwzi4XECQ7").trim(),
};

console.log("✅ Resolved Stripe Price IDs:", STRIPE_PRICE_IDS);
