import type { LookupKey } from "../../client/src/data/planSkus";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

const keyMode = stripeKey.startsWith("sk_live_")
  ? "LIVE"
  : stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")
    ? "TEST"
    : "UNKNOWN";

console.log(`🔑 Stripe key mode: ${keyMode}`);

function requirePrice(envVarName: string, planLabel: string): string {
  const value = process.env[envVarName]?.trim();

  if (!value) {
    throw new Error(
      `Missing required env var ${envVarName} for plan "${planLabel}"`,
    );
  }

  return value;
}

/* Consumer Plans */

const basic = requirePrice("STRIPE_PRICE_BASIC", "Basic");
const premium = requirePrice("STRIPE_PRICE_PREMIUM", "Premium");
const ultimate = requirePrice("STRIPE_PRICE_ULTIMATE", "Ultimate");

/* Family Plans */

const familyBase = requirePrice("STRIPE_PRICE_FAMILY_BASE", "Family Base");
const familyAllPremium = requirePrice(
  "STRIPE_PRICE_FAMILY_ALL_PREMIUM",
  "Family Premium",
);
const familyAllUltimate = requirePrice(
  "STRIPE_PRICE_FAMILY_ALL_ULTIMATE",
  "Family Ultimate",
);

/* Trainer Plans */

const trainer5 = requirePrice("STRIPE_PRICE_TRAINER_5", "Trainer 5");
const trainer10 = requirePrice("STRIPE_PRICE_TRAINER_10", "Trainer 10");
const trainer25 = requirePrice("STRIPE_PRICE_TRAINER_25", "Trainer 25");
const trainer50 = requirePrice("STRIPE_PRICE_TRAINER_50", "Trainer 50");
const trainer150 = requirePrice("STRIPE_PRICE_TRAINER_150", "Trainer 150");

/* ProCare */

const procare = requirePrice("STRIPE_PRICE_PROCARE", "ProCare");

/* Mapping must match LookupKey exactly */

export const STRIPE_PRICE_IDS: Record<LookupKey, string> = {
  mpm_basic_monthly: basic,
  mpm_premium_monthly: premium,
  mpm_premium_beta_monthly: premium,
  mpm_ultimate_monthly: ultimate,

  mpm_family_base_monthly: familyBase,
  mpm_family_all_premium_monthly: familyAllPremium,
  mpm_family_all_ultimate_monthly: familyAllUltimate,

  mpm_procare_monthly: procare,

  mpm_procare_trainer_5: trainer5,
  mpm_procare_trainer_10: trainer10,
  mpm_procare_trainer_25: trainer25,
  mpm_procare_trainer_50: trainer50,
  mpm_procare_trainer_150: trainer150,
};
