import { LookupKey } from "@/data/planSkus";

/**
 * Stripe lookup keys → friendly names shown in UI
 * Maps technical lookup_keys to user-friendly display names
 */
export function planDisplayName(lookupKey?: string): string {
  switch (lookupKey) {
    case "mpm_basic_monthly":
      return "Basic";
    case "mpm_upgrade_monthly": // ← keep key, show Premium
    case "mpm_upgrade_beta_monthly":
      return "Premium";
    case "mpm_ultimate_monthly":
      return "Ultimate";
    case "mpm_family_base_monthly":
      return "Family Base";
    case "mpm_family_all_upgrade_monthly":
      return "Family All-Premium";
    case "mpm_family_all_ultimate_monthly":
      return "Family All-Ultimate";
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
  return name === "Premium (Beta)" ? "Premium" : name;
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
