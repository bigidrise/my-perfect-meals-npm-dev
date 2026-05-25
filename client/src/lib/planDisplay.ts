import { LookupKey } from "@/data/planSkus";

/**
 * Stripe lookup keys → friendly names shown in UI
 * Maps technical lookup_keys to user-friendly display names
 */
export function planDisplayName(lookupKey?: string): string {
  switch (lookupKey) {
    case "mpm_basic_monthly":
      return "Essential";
    case "mpm_upgrade_monthly":
    case "mpm_upgrade_beta_monthly":
      return "Pro";
    case "mpm_ultimate_monthly":
      return "Clinical";
    case "mpm_family_base_monthly":
      return "Family Essential";
    case "mpm_family_premium":
    case "mpm_family_all_upgrade_monthly":
    case "mpm_family_all_premium_monthly":
      return "Family Pro";
    case "mpm_family_all_ultimate_monthly":
      return "Family Clinical";
    case "mpm_procare_monthly":
      return "ProCare";
    default:
      return "My Perfect Meals";
  }
}

/**
 * Short badge text for UI chips
 */
export function planBadge(lookupKey?: string): string {
  const name = planDisplayName(lookupKey);
  return name;
}

/**
 * Price label helper for success pages and billing displays
 */
export function planPriceLabel(
  lookupKey?: string,
  amountMonthly?: number
): string {
  const name = planDisplayName(lookupKey);
  return amountMonthly != null
    ? `${name} — $${amountMonthly.toFixed(2)}/mo`
    : name;
}
