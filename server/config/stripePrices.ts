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
const familyPremium = requirePrice("STRIPE_PRICE_FAMILY_ALL_PREMIUM", "Family Premium");
const familyUltimate = requirePrice(
  "STRIPE_PRICE_FAMILY_ALL_ULTIMATE",
  "Family Ultimate",
);

/* Trainer Plans */

const trainer5 = requirePrice("STRIPE_PRICE_PROCARE_TRAINER_5", "Trainer 5");
const trainer10 = requirePrice("STRIPE_PRICE_PROCARE_TRAINER_10", "Trainer 10");
const trainer25 = requirePrice("STRIPE_PRICE_PROCARE_TRAINER_25", "Trainer 25");
const trainer50 = requirePrice("STRIPE_PRICE_PROCARE_TRAINER_50_PLUS", "Trainer 50");

/* Physician Plans */

const physician50 = requirePrice("STRIPE_PRICE_PROCARE_PHYSICIAN_50", "Physician 50");
const physician150 = requirePrice("STRIPE_PRICE_PROCARE_PROFESSIONAL_150", "Physician 150");

/* ProCare / Guidance */

const procare = requirePrice("STRIPE_PRICE_PROCARE", "ProCare");
const guidance = requirePrice("STRIPE_PRICE_PROCARE_PROFESSIONAL", "Personal Guidance");

/* Signature Kitchen */

const signatureKitchenStarter = requirePrice("STRIPE_PRICE_SIGNATURE_KITCHEN_STARTER", "Signature Kitchen Starter");
const signatureKitchenPro = requirePrice("STRIPE_PRICE_SIGNATURE_KITCHEN_PRO", "Signature Kitchen Pro");
const signatureKitchenPartner = requirePrice("STRIPE_PRICE_SIGNATURE_KITCHEN_PARTNER", "Signature Kitchen Partner");

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

  signature_kitchen_starter_monthly: signatureKitchenStarter,
  signature_kitchen_pro_monthly: signatureKitchenPro,
  signature_kitchen_partner_monthly: signatureKitchenPartner,
};
