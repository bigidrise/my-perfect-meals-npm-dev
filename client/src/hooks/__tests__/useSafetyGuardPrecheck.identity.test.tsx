/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useSafetyGuardPrecheck } from "../useSafetyGuardPrecheck";
import { isGuestMode } from "@/lib/guestMode";
import { getAuthHeaders, isNativePlatform } from "@/lib/auth";

jest.mock("@/lib/guestMode", () => ({ isGuestMode: jest.fn() }));
jest.mock("@/lib/auth", () => ({
  getAuthHeaders: jest.fn(() => ({})),
  isNativePlatform: jest.fn(() => false),
}));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));

const guestMode = isGuestMode as jest.MockedFunction<typeof isGuestMode>;
const nativePlatform = isNativePlatform as jest.MockedFunction<typeof isNativePlatform>;
const authHeaders = getAuthHeaders as jest.MockedFunction<typeof getAuthHeaders>;

describe("shared safety preflight browser identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    guestMode.mockReturnValue(false);
    nativePlatform.mockReturnValue(false);
    authHeaders.mockReturnValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "SAFE" }),
    });
  });

  it("marks a cached signed-in browser request without sending an identity or allergy claim", async () => {
    window.localStorage.setItem("mpm_current_user", JSON.stringify({ id: "subject-a" }));
    const { result } = renderHook(() => useSafetyGuardPrecheck());
    await act(async () => {
      expect(await result.current.checkSafety("gumbo", "create-dish")).toBe(true);
    });
    expect(fetch).toHaveBeenCalledWith("/api/safety-check", expect.objectContaining({
      credentials: "include",
      headers: expect.objectContaining({ "x-safety-auth-intent": "authenticated" }),
      body: JSON.stringify({ input: "gumbo", builderId: "create-dish" }),
    }));
  });

  it("stops generation and asks for sign-in when the authenticated session has expired", async () => {
    window.localStorage.setItem("mpm_current_user", JSON.stringify({ id: "subject-a" }));
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const { result } = renderHook(() => useSafetyGuardPrecheck());
    await act(async () => {
      expect(await result.current.checkSafety("gumbo", "create-dish")).toBe(false);
    });
    expect(result.current.alert.message).toMatch(/sign in again/i);
  });

  it("does not mark a genuine guest as an authenticated browser", async () => {
    guestMode.mockReturnValue(true);
    const { result } = renderHook(() => useSafetyGuardPrecheck());
    await act(async () => {
      expect(await result.current.checkSafety("gumbo", "create-dish", ["shellfish"])).toBe(true);
    });
    expect(fetch).toHaveBeenCalledWith("/api/safety-check", expect.objectContaining({
      headers: expect.not.objectContaining({ "x-safety-auth-intent": "authenticated" }),
      body: JSON.stringify({ input: "gumbo", builderId: "create-dish", guestAllergies: ["shellfish"] }),
    }));
  });

  it("keeps a native bearer without the browser-only intent header", async () => {
    nativePlatform.mockReturnValue(true);
    authHeaders.mockReturnValue({ "x-auth-token": "native-token" });
    window.localStorage.setItem("mpm_current_user", JSON.stringify({ id: "subject-a" }));
    const { result } = renderHook(() => useSafetyGuardPrecheck());
    await act(async () => {
      expect(await result.current.checkSafety("gumbo", "create-dish")).toBe(true);
    });
    expect(fetch).toHaveBeenCalledWith("/api/safety-check", expect.objectContaining({
      headers: expect.objectContaining({ "x-auth-token": "native-token" }),
    }));
    expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty("x-safety-auth-intent");
  });
});