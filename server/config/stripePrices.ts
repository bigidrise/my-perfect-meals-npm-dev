import type { LookupKey } from "../../client/src/data/planSkus";

const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

const keyMode = stripeKey.startsWith("sk_live_")
  ? "LIVE"
  : stripeKey.startsWith("sk_test_") || stripeKey.startsWith("rk_test_")
    ? "TEST"
    : "UNKNOWN";

console.log(`🔑 Stripe key mode: ${keyMode}`);

/**
 * NEVER crash the server on missing env vars.
 * Required plans log an error, optional plans log a warning.
 */

function safePrice(
  envVarName: string,
  planLabel: string,
  required = true,
): string {
  const value = process.env[envVarName]?.trim();

  if (!value) {
    const message = `${required ? "❌ Missing" : "⚠️ Missing"} env var ${envVarName} for "${planLabel}"`;

    if (required) {
      console.error(message);
    } else {
      console.warn(message);
    }

    return "";
  }

  return value;
}

/* Consumer Plans */

const basic = safePrice("STRIPE_PRICE_BASIC", "Basic");
const premium = safePrice("STRIPE_PRICE_PREMIUM", "Premium");
const ultimate = safePrice("STRIPE_PRICE_ULTIMATE", "Ultimate");

/* Family Plans */

const familyBase = safePrice("STRIPE_PRICE_FAMILY_BASE", "Family Base");
const familyPremium = safePrice(
  "STRIPE_PRICE_FAMILY_ALL_PREMIUM",
  "Family Premium",
);
const familyUltimate = safePrice(
  "STRIPE_PRICE_FAMILY_ALL_ULTIMATE",
  "Family Ultimate",
);

/* Trainer Plans */

const trainer5 = safePrice("STRIPE_PRICE_PROCARE_TRAINER_5", "Trainer 5");
const trainer10 = safePrice("STRIPE_PRICE_PROCARE_TRAINER_10", "Trainer 10");
const trainer25 = safePrice("STRIPE_PRICE_PROCARE_TRAINER_25", "Trainer 25");
const trainer50 = safePrice(
  "STRIPE_PRICE_PROCARE_TRAINER_50_PLUS",
  "Trainer 50",
);

/* Physician Plans */

const physician50 = safePrice(
  "STRIPE_PRICE_PROCARE_PHYSICIAN_50",
  "Physician 50",
);
const physician150 = safePrice(
  "STRIPE_PRICE_PROCARE_PROFESSIONAL_150",
  "Physician 150",
);

/* ProCare / Guidance */

const procare = safePrice("STRIPE_PRICE_PROCARE", "ProCare");
const guidance = safePrice(
  "STRIPE_PRICE_PROCARE_PROFESSIONAL",
  "Personal Guidance",
);

/* Signature Kitchen (OPTIONAL — NEVER crashes server) */

const signatureKitchenStarter = safePrice(
  "STRIPE_PRICE_SIGNATURE_KITCHEN_STARTER",
  "Signature Kitchen Starter",
  false,
);
const signatureKitchenPro = safePrice(
  "STRIPE_PRICE_SIGNATURE_KITCHEN_PRO",
  "Signature Kitchen Pro",
  false,
);
const signatureKitchenPartner = safePrice(
  "STRIPE_PRICE_SIGNATURE_KITCHEN_PARTNER",
  "Signature Kitchen Partner",
  false,
);

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
