/**
 * Opt-in readability scope for the narrowly approved development-only
 * account-entry and onboarding pages.
 */
export const entryReadabilityClassName = import.meta.env.DEV
  ? "mpm-entry-readable"
  : "";
