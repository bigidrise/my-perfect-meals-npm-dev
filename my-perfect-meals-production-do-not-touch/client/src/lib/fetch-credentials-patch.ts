// Global fetch credentials patch
// Ensures API fetches include credentials while allowing third-party fetches to work normally.
(function patchFetchForCredentials() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  // Check if URL should include credentials (same-origin or API calls)
  const isCredsDomain = (url: string) => {
    try {
      const u = new URL(url, window.location.href);
      // Include credentials for same-origin and relative URLs
      return u.origin === window.location.origin;
    } catch {
      // Relative URLs will resolve to same-origin
      return true;
    }
  };

  const original = window.fetch;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (isCredsDomain(url)) {
      const nextInit: RequestInit = { credentials: "include", ...(init || {}) };
      return original(input, nextInit);
    }
    // Third-party fetches keep existing behavior (no credentials)
    return original(input, init);
  };
})();
