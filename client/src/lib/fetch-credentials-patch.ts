// Global fetch credentials patch
// Ensures API fetches include credentials while allowing third-party fetches to work normally.

export function patchFetchForCredentials() {
  if (typeof window === "undefined" || typeof window.fetch !== "function")
    return;

  // Prevent double-patching
  if ((window as any).__fetchCredsPatched) return;
  (window as any).__fetchCredsPatched = true;

  const isCredsDomain = (url: string) => {
    try {
      const u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch {
      return true; // relative URLs
    }
  };

  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : "";

    if (isCredsDomain(url)) {
      return original(input as any, {
        credentials: "include",
        ...(init || {}),
      });
    }

    return original(input as any, init);
  };
}
