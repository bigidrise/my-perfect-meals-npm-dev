import type { LookupKey } from "../../client/src/data/planSkus";

const stripeKey = process.env.STRIPE_SECRET_KEY || "";
const keyMode = stripeKey.startsWith("sk_live_") ? "LIVE" : stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_") ? "TEST" : "UNKNOWN";
console.log(`🔑 Stripe key mode: ${keyMode}`);

function requirePrice(envVarName: string, planLabel: string): string {
  const value = process.env[envVarName]?.trim();
  if (!value) {
    console.error(`❌ Missing required env var ${envVarName} for plan "${planLabel}"`);
    return "";
  }
  console.log(`✅ ${planLabel}: ${envVarName} = ${value}`);
  return value;
}

const basic = requirePrice("STRIPE_PRICE_BASIC", "Basic");
const premium = requirePrice("STRIPE_PRICE_PREMIUM", "Premium");
const ultimate = requirePrice("STRIPE_PRICE_ULTIMATE", "Ultimate");
const familyBase = requirePrice("STRIPE_PRICE_FAMILY_BASE", "Family Base");
const familyAllPremium = requirePrice("STRIPE_PRICE_FAMILY_ALL_PREMIUM", "Family All-Premium");
const familyAllUltimate = requirePrice("STRIPE_PRICE_FAMILY_ALL_ULTIMATE", "Family All-Ultimate");
const procare = requirePrice("STRIPE_PRICE_PROCARE", "ProCare");

export const STRIPE_PRICE_IDS: Record<LookupKey, string> = {
  mpm_basic_monthly: basic,
  mpm_premium_monthly: premium,
  mpm_premium_beta_monthly: premium,
  mpm_ultimate_monthly: ultimate,
  mpm_family_base_monthly: familyBase,
  mpm_family_all_premium_monthly: familyAllPremium,
  mpm_family_all_ultimate_monthly: familyAllUltimate,
  mpm_procare_monthly: procare,
};
