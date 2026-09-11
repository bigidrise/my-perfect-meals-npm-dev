jest.mock("@/lib/auth", () => ({
  getAuthHeaders: jest.fn(),
}));
jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => path,
}));

import { getAuthHeaders } from "@/lib/auth";
import { persistMealBuilderSelection } from "@/lib/mealBuilderSelection";

describe("persistMealBuilderSelection", () => {
  const refreshUser = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { dispatchEvent: jest.fn() },
    });
    Object.defineProperty(globalThis, "CustomEvent", {
      configurable: true,
      value: class CustomEvent {
        constructor(public type: string) {}
      },
    });
  });

  it("persists with an authenticated cookie even when no bearer token exists", async () => {
    (getAuthHeaders as jest.Mock).mockReturnValue({});
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ selectedMealBuilder: "general_nutrition" }),
    });

    await persistMealBuilderSelection("general_nutrition", refreshUser);

    expect(fetch).toHaveBeenCalledWith("/api/user/meal-builder", expect.objectContaining({
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }));
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it("keeps bearer authentication while also including credentials", async () => {
    (getAuthHeaders as jest.Mock).mockReturnValue({ "x-auth-token": "test-token" });
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ selectedMealBuilder: "general_nutrition" }),
    });

    await persistMealBuilderSelection("general_nutrition", refreshUser);

    expect(fetch).toHaveBeenCalledWith("/api/user/meal-builder", expect.objectContaining({
      credentials: "include",
      headers: expect.objectContaining({ "x-auth-token": "test-token" }),
    }));
  });

  it("does not refresh authoritative state when persistence fails", async () => {
    (getAuthHeaders as jest.Mock).mockReturnValue({});
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Switch limit reached" }),
    });

    await expect(
      persistMealBuilderSelection("general_nutrition", refreshUser),
    ).rejects.toThrow("Switch limit reached");
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it("rejects a mismatched server confirmation", async () => {
    (getAuthHeaders as jest.Mock).mockReturnValue({});
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ selectedMealBuilder: "glp1" }),
    });

    await expect(
      persistMealBuilderSelection("general_nutrition", refreshUser),
    ).rejects.toThrow("did not confirm");
    expect(refreshUser).not.toHaveBeenCalled();
  });
});