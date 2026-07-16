/**
 * Coach's Corner Feature Flag
 *
 * Controls visibility of Coach's Corner across the entire app.
 * SAFE DEFAULT: hidden (false) — only shown when explicitly enabled.
 *
 * To enable in a workspace: set VITE_COACHES_CORNER_ENABLED=true
 * Production spaces: leave unset → hidden automatically.
 */
export const COACHES_CORNER_ENABLED =
  import.meta.env.VITE_COACHES_CORNER_ENABLED === "true";

export function isCoachesCornerEnabled(): boolean {
  return COACHES_CORNER_ENABLED;
}
