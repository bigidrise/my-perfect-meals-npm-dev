// Global fetch credentials patch
// Ensures API fetches include credentials while allowing third-party fetches to work normally.
import { Capacitor } from "@capacitor/core";
import { resolveApiBase } from "@/lib/resolveApiBase";

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  if (input instanceof URL) return input.toString();
  return "";
}

/**
 * A bundled Capacitor app starts at capacitor://localhost. Relative API paths
 * must be directed to the production API, while local assets and SPA routes
 * must remain local.
 */
function routeNativeApiRequest(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof window === "undefined") return input;

  try {
    if (!Capacitor.isNativePlatform()) return input;

    const requestedUrl = new URL(getRequestUrl(input), window.location.href);
    const isLocalApiPath =
      requestedUrl.origin === window.location.origin &&
      (requestedUrl.pathname === "/api" || requestedUrl.pathname.startsWith("/api/"));

    if (!isLocalApiPath) return input;

    const apiUrl = new URL(
      `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`,
      resolveApiBase(),
    ).toString();

    if (typeof Request !== "undefined" && input instanceof Request) {
      return new Request(apiUrl, input);
    }

    return apiUrl;
  } catch {
    return input;
  }
}

export function patchFetchForCredentials() {
  if (typeof window === "undefined" || typeof window.fetch !== "function")
    return;

  // Prevent double-patching
  if ((window as any).__fetchCredsPatched) return;
  (window as any).__fetchCredsPatched = true;

  const isCredsDomain = (url: string) => {
    try {
      const u = new URL(url, window.location.href);
      const apiOrigin = new URL(resolveApiBase()).origin;
      return u.origin === window.location.origin || u.origin === apiOrigin;
    } catch {
      return true; // relative URLs
    }
  };

  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const routedInput = routeNativeApiRequest(input);
    const url = getRequestUrl(routedInput);

    if (isCredsDomain(url)) {
      return original(routedInput as any, {
        credentials: "include",
        ...(init || {}),
      });
    }

    return original(routedInput as any, init);
  };
}
