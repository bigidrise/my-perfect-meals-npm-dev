/**
 * Resolves server-to-server API calls without hardcoding a production loopback
 * URL. Production must supply an intentional internal/public origin; only the
 * development process may fall back to its own local listener.
 */
export function getInternalApiBase(): string {
  const configured =
    process.env.APP_BASE_INTERNAL_URL?.trim() ||
    process.env.API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_BASE_INTERNAL_URL or API_BASE_URL must be configured for production internal API calls",
    );
  }

  return `http://127.0.0.1:${process.env.PORT || "5000"}`;
}