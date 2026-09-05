/** @jest-environment jsdom */

jest.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

import { Capacitor } from "@capacitor/core";
import { patchFetchForCredentials } from "../fetch-credentials-patch";

const mockIsNativePlatform = Capacitor.isNativePlatform as jest.Mock;

describe("patchFetchForCredentials", () => {
  let originalFetch: jest.Mock;

  beforeEach(() => {
    delete (window as any).__fetchCredsPatched;
    originalFetch = jest.fn().mockResolvedValue({ ok: true });
    window.fetch = originalFetch as unknown as typeof fetch;
  });

  it("adds a session CSRF token to browser API mutations", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    originalFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "session-token" }),
      })
      .mockResolvedValueOnce({ ok: true });
    patchFetchForCredentials();

    await window.fetch("/api/user/profile", { method: "PATCH" });

    expect(originalFetch).toHaveBeenNthCalledWith(
      1,
      "/api/auth/csrf",
      { credentials: "include" },
    );
    const mutationInit = originalFetch.mock.calls[1][1] as RequestInit;
    expect(mutationInit.credentials).toBe("include");
    expect(new Headers(mutationInit.headers).get("x-csrf-token")).toBe(
      "session-token",
    );
  });

  it("adds a CSRF token to native cookie-authenticated mutations", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    originalFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "native-session-token" }),
      })
      .mockResolvedValueOnce({ ok: true });
    patchFetchForCredentials();
    await window.fetch("/api/user/profile", { method: "PATCH" });
    expect(originalFetch).toHaveBeenCalledTimes(2);
    const mutationInit = originalFetch.mock.calls[1][1] as RequestInit;
    expect(new Headers(mutationInit.headers).get("x-csrf-token")).toBe(
      "native-session-token",
    );
  });

  it("does not request a CSRF token for explicit bearer mutations", async () => {
    delete (window as any).__fetchCredsPatched;
    originalFetch.mockClear();
    window.fetch = originalFetch as unknown as typeof fetch;
    mockIsNativePlatform.mockReturnValue(false);
    patchFetchForCredentials();
    await window.fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "x-auth-token": "bearer" },
    });
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes the cached token after a session-changing auth response", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    originalFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "old-session-token" }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "new-session-token" }),
      })
      .mockResolvedValueOnce({ ok: true });
    patchFetchForCredentials();

    await window.fetch("/api/profile", { method: "PATCH" });
    await window.fetch("/api/auth/login", { method: "POST" });
    await window.fetch("/api/profile", { method: "PATCH" });

    expect(originalFetch).toHaveBeenCalledTimes(5);
    const finalMutation = originalFetch.mock.calls[4][1] as RequestInit;
    expect(new Headers(finalMutation.headers).get("x-csrf-token")).toBe(
      "new-session-token",
    );
  });

  it("retries once with a fresh token only after CSRF rejection", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    const rejected = {
      ok: false,
      status: 403,
      clone: () => ({
        json: async () => ({ code: "CSRF_TOKEN_INVALID" }),
      }),
    };
    originalFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "stale-token" }),
      })
      .mockResolvedValueOnce(rejected)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "fresh-token" }),
      })
      .mockResolvedValueOnce({ ok: true });
    patchFetchForCredentials();

    await window.fetch("/api/profile", { method: "PATCH" });

    expect(originalFetch).toHaveBeenCalledTimes(4);
    const retry = originalFetch.mock.calls[3][1] as RequestInit;
    expect(new Headers(retry.headers).get("x-csrf-token")).toBe("fresh-token");
  });

  it("routes a bundled native relative API request to the canonical API origin", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    patchFetchForCredentials();

    await window.fetch("/api/user/profile");

    expect(originalFetch.mock.calls[0][0]).toBe(
      "https://app.myperfectmeals.ai/api/user/profile",
    );
    expect(originalFetch.mock.calls[0][1].credentials).toBe("include");
    expect(
      new Headers(originalFetch.mock.calls[0][1].headers).get(
        "x-requested-with",
      ),
    ).toBe("XMLHttpRequest");
  });

  it("does not redirect local assets through the API", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    patchFetchForCredentials();

    await window.fetch("/icons/chef.png");

    expect(originalFetch).toHaveBeenCalledWith("/icons/chef.png", {
      credentials: "include",
    });
  });

  it("keeps browser relative API requests on their browser origin", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    patchFetchForCredentials();

    await window.fetch("/api/user/profile");

    expect(originalFetch.mock.calls[0][0]).toBe("/api/user/profile");
    expect(originalFetch.mock.calls[0][1].credentials).toBe("include");
    expect(
      new Headers(originalFetch.mock.calls[0][1].headers).get(
        "x-requested-with",
      ),
    ).toBe("XMLHttpRequest");
  });
});