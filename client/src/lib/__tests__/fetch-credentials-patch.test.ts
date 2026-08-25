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

  it("routes a bundled native relative API request to the canonical API origin", async () => {
    mockIsNativePlatform.mockReturnValue(true);
    patchFetchForCredentials();

    await window.fetch("/api/user/profile");

    expect(originalFetch).toHaveBeenCalledWith(
      "https://app.myperfectmeals.ai/api/user/profile",
      { credentials: "include" },
    );
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

    expect(originalFetch).toHaveBeenCalledWith("/api/user/profile", {
      credentials: "include",
    });
  });
});