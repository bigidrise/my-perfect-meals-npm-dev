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
    window.localStorage.clear();
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

  it("uses the stored bearer token for authenticated API mutations without CSRF bootstrap", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    window.localStorage.setItem("mpm_auth_token", "stored-auth-token");
    patchFetchForCredentials();

    await window.fetch("/api/meals/craving-creator", { method: "POST" });

    expect(originalFetch).toHaveBeenCalledTimes(1);
    const requestInit = originalFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(requestInit.headers).get("x-auth-token")).toBe(
      "stored-auth-token",
    );
  });

  it("does not attach a stale stored bearer token to pre-authentication requests", async () => {
    mockIsNativePlatform.mockReturnValue(false);
    window.localStorage.setItem("mpm_auth_token", "stale-auth-token");
    patchFetchForCredentials();

    await window.fetch("/api/auth/login", { method: "POST" });

    expect(originalFetch).toHaveBeenCalledTimes(1);
    const requestInit = originalFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(requestInit.headers).has("x-auth-token")).toBe(false);
  });

  it.each([
    "/api/auth/mfa/challenge",
    "/api/auth/mfa/challenge/backup",
  ])("submits the pending-MFA challenge without authenticated CSRF bootstrap: %s", async (path) => {
    mockIsNativePlatform.mockReturnValue(false);
    patchFetchForCredentials();

    await window.fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });

    expect(originalFetch).toHaveBeenCalledTimes(1);
    expect(originalFetch.mock.calls[0][0]).toBe(path);
    const challengeInit = originalFetch.mock.calls[0][1] as RequestInit;
    expect(challengeInit.credentials).toBe("include");
    expect(
      new Headers(challengeInit.headers).get("x-requested-with"),
    ).toBe("XMLHttpRequest");
    expect(
      new Headers(challengeInit.headers).has("x-csrf-token"),
    ).toBe(false);
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