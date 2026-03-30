/**
 * ACTIVE BUILDER NAMESPACE — SINGLE SOURCE OF TRUTH
 *
 * Each builder page calls setActiveBuilderNs(ns) on mount.
 * AddToMealPlanButton (and any other cross-context component) calls
 * getActiveBuilderNs() so writes and reads always target the correct board.
 *
 * localStorage key: mpm.activeBuilderNs
 * Value: the bt= namespace string, or '' for the default weekly board.
 */

const STORAGE_KEY = 'mpm.activeBuilderNs';

/** Set the currently active board namespace. Call on builder mount. */
export function setActiveBuilderNs(ns: string | undefined): void {
  const value = ns ?? '';
  if (value) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Get the currently active board namespace. Returns '' for default board. */
export function getActiveBuilderNs(): string {
  return localStorage.getItem(STORAGE_KEY) ?? '';
}
