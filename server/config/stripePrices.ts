import type { LookupKey } from "../../client/src/data/planSkus";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

const keyMode = stripeKey.startsWith("sk_live_")
  ? "LIVE"
  : stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")
    ? "TEST"
    : "UNKNOWN";

console.log(`🔑 Stripe key mode: ${keyMode}`);

function getPrice(envVarName: string, planLabel: string): string {
  const value = process.env[envVarName]?.trim();

  if (!value) {
    console.warn(`⚠️ Missing env var ${envVarName} for plan "${planLabel}" - Stripe payments disabled for this plan`);
    return "";
  }

  return value;
}

/* Consumer Plans */

const basic = getPrice("STRIPE_PRICE_BASIC", "Basic");
const premium = getPrice("STRIPE_PRICE_PREMIUM", "Premium");
const ultimate = getPrice("STRIPE_PRICE_ULTIMATE", "Ultimate");

/* Family Plans */

const familyBase = getPrice("STRIPE_PRICE_FAMILY_BASE", "Family Base");
const familyPremium = getPrice("STRIPE_PRICE_FAMILY_ALL_PREMIUM", "Family Premium");
const familyUltimate = getPrice(
  "STRIPE_PRICE_FAMILY_ALL_ULTIMATE",
  "Family Ultimate",
);

/* Trainer Plans */

const trainer5 = getPrice("STRIPE_PRICE_PROCARE_TRAINER_5", "Trainer 5");
const trainer10 = getPrice("STRIPE_PRICE_PROCARE_TRAINER_10", "Trainer 10");
const trainer25 = getPrice("STRIPE_PRICE_PROCARE_TRAINER_25", "Trainer 25");
const trainer50 = getPrice("STRIPE_PRICE_PROCARE_TRAINER_50_PLUS", "Trainer 50");

/* Physician Plans */

const physician50 = getPrice("STRIPE_PRICE_PROCARE_PHYSICIAN_50", "Physician 50");
const physician150 = getPrice("STRIPE_PRICE_PROCARE_PROFESSIONAL_150", "Physician 150");

/* ProCare / Guidance */

const procare = getPrice("STRIPE_PRICE_PROCARE", "ProCare");
const guidance = getPrice("STRIPE_PRICE_PROCARE_PROFESSIONAL", "Personal Guidance");

/* Mapping must match LookupKey exactly */

export const STRIPE_PRICE_IDS: Record<LookupKey, string> = {
  mpm_basic: basic,
  mpm_premium: premium,
  mpm_ultimate: ultimate,

  mpm_family_base: familyBase,
  mpm_family_premium: familyPremium,
  mpm_family_ultimate: familyUltimate,

  mpm_trainer_5: trainer5,
  mpm_trainer_10: trainer10,
  mpm_trainer_25: trainer25,
  mpm_trainer_50: trainer50,

  mpm_physician_50: physician50,
  mpm_physician_150: physician150,

  mpm_guidance: guidance,
};
