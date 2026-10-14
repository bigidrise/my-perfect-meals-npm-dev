/** @jest-environment node */
jest.mock("@/utils/deviceId", () => ({ getDeviceId: () => "synthetic-device" }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}), isNativePlatform: () => false }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
import { apiRequest } from "../apiRequest";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test("API errors retain status and server reason without changing existing fallback messages", async () => {
  global.fetch = jest.fn(async () => ({
    ok: false, status: 403, json: async () => ({ error: "Authorized Studio required", code: "STUDIO_ACCESS_DENIED" }),
  })) as any;
  await expect(apiRequest("/synthetic")).rejects.toMatchObject({
    message: "Request failed (403)", status: 403,
    code: "STUDIO_ACCESS_DENIED", serverMessage: "Authorized Studio required",
  });
});

test("existing explicit server messages remain unchanged", async () => {
  global.fetch = jest.fn(async () => ({
    ok: false, status: 503, json: async () => ({ message: "Please retry later." }),
  })) as any;
  await expect(apiRequest("/synthetic")).rejects.toMatchObject({
    message: "Please retry later.", status: 503, serverMessage: null,
  });
});
