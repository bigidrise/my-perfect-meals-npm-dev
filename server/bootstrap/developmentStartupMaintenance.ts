/**
 * Opt-in suppression of automatic startup work only. Never use this policy in
 * authentication, authorization, clinical validation, or request write paths.
 * A deployment/Production marker wins over the Development opt-in.
 */
export function startupMaintenanceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const safeDevelopment = env.NODE_ENV === "development" &&
    !env.REPLIT_DEPLOYMENT &&
    !["true", "1"].includes((env.VITE_IS_PRODUCTION_PROJECT ?? "").trim().toLowerCase()) &&
    env.DEVELOPMENT_SAFE_RESTART === "true";
  return !safeDevelopment;
}
