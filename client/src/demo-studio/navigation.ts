/** Explicit Group 1 allowlist, not the full application router. */
export const DEMO_ROUTES = {
  "/dashboard": "Dashboard",
  "/onboarding": "Onboarding",
  "/onboarding-v2": "Onboarding",
  "/macro-counter": "Macro Calculator",
  "/builders": "Meal Builders",
  "/select-builder": "Select Meal Builder",
  "/lifestyle": "Lifestyle",
  "/more": "More",
  "/craving-creator-landing": "Cravings, Sushi & Desserts Hub",
  "/lifestyle/beverage-hub": "Beverage Creator Hub",
} as const;

export function demoDestination(input: string, current = "/dashboard"): string | null {
  try {
    const url = new URL(input, `https://demo.invalid${current}`);
    if (url.origin !== "https://demo.invalid" || !input ||
      (!input.startsWith("/") && !input.startsWith("?") && !input.startsWith("#"))) return null;
    if (url.pathname === "/home") url.pathname = "/dashboard";
    if (url.pathname === "/planner") url.pathname = "/builders";
    if (url.pathname !== "/" && !Object.hasOwn(DEMO_ROUTES, url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function blockedDestination(input: string): string {
  if (/pregnancy|pairings|wine-list|reduce-drinking/.test(input)) {
    return `Coming Soon — ${input}. This feature is not activated in Demo Mode.`;
  }
  return `Not connected in Demo Mode Group 1: ${input}. This destination's reads and actions are not verified; no live fallback was used.`;
}
