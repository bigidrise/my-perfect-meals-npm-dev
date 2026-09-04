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
  let csrfToken: string | null = null;
  let csrfRequest: Promise<string> | null = null;

  const getMethod = (input: RequestInfo | URL, init?: RequestInit) =>
    (init?.method ||
      (typeof Request !== "undefined" && input instanceof Request
        ? input.method
        : "GET")).toUpperCase();

  const hasHeader = (headers: Headers, name: string) =>
    Boolean(headers.get(name));

  const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;
    if (!csrfRequest) {
      csrfRequest = original(routeNativeApiRequest("/api/auth/csrf") as any, {
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to establish CSRF protection");
          const body = await response.json();
          if (typeof body?.csrfToken !== "string") {
            throw new Error("Invalid CSRF response");
          }
          csrfToken = body.csrfToken;
          return body.csrfToken;
        })
        .finally(() => {
          csrfRequest = null;
        });
    }
    return csrfRequest!;
  };

  const isPreAuthenticationPath = (url: string): boolean => {
    try {
      const path = new URL(url, window.location.href).pathname;
      return [
        "/api/auth/login",
        "/api/auth/signup",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
      ].includes(path);
    } catch {
      return false;
    }
  };

  const isAuthenticationPath = (url: string): boolean => {
    try {
      return new URL(url, window.location.href).pathname.startsWith("/api/auth/");
    } catch {
      return false;
    }
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const routedInput = routeNativeApiRequest(input);
    const url = getRequestUrl(routedInput);

    if (isCredsDomain(url)) {
      const requestInit: RequestInit = {
        credentials: "include",
        ...(init || {}),
      };
      const method = getMethod(routedInput, requestInit);
      const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
      const headers = new Headers(
        requestInit.headers ||
          (typeof Request !== "undefined" && routedInput instanceof Request
            ? routedInput.headers
            : undefined),
      );
      const isApiRequest = (() => {
        try {
          const parsed = new URL(url, window.location.href);
          return parsed.pathname === "/api" || parsed.pathname.startsWith("/api/");
        } catch {
          return false;
        }
      })();
      if (isApiRequest) {
        headers.set("x-requested-with", "XMLHttpRequest");
        requestInit.headers = headers;
      }

      if (
        unsafe &&
        isApiRequest &&
        !isPreAuthenticationPath(url) &&
        !hasHeader(headers, "x-auth-token")
      ) {
        headers.set("x-csrf-token", await getCsrfToken());
        requestInit.headers = headers;
      }
      const retryInput =
        typeof Request !== "undefined" && routedInput instanceof Request
          ? routedInput.clone()
          : routedInput;
      const response = await original(routedInput as any, requestInit);

      if (response.ok && unsafe && isAuthenticationPath(url)) {
        csrfToken = null;
      }

      if (
        response.status === 403 &&
        unsafe &&
        headers.has("x-csrf-token")
      ) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (body?.code === "CSRF_TOKEN_INVALID") {
          csrfToken = null;
          headers.set("x-csrf-token", await getCsrfToken());
          return original(retryInput as any, {
            ...requestInit,
            headers,
          });
        }
      }

      return response;
    }

    return original(routedInput as any, init);
  };
}
