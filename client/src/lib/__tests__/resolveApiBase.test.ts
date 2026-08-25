jest.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

import { NATIVE_PRODUCTION_API_ORIGIN, apiUrl, resolveApiBaseForRuntime } from "../resolveApiBase";

describe("resolveApiBaseForRuntime", () => {
  it("keeps bundled native API calls on the canonical production API origin", () => {
    expect(
      resolveApiBaseForRuntime({
        isNative: true,
        webOrigin: "capacitor://localhost",
      }),
    ).toBe("https://app.myperfectmeals.ai");
    expect(NATIVE_PRODUCTION_API_ORIGIN).toBe("https://app.myperfectmeals.ai");
  });

  it("keeps web calls on their current document origin", () => {
    expect(
      resolveApiBaseForRuntime({
        isNative: false,
        webOrigin: "https://preview.example.test",
      }),
    ).toBe("https://preview.example.test");
  });

  it("does not modify an already absolute API URL", () => {
    expect(apiUrl("https://media.example.test/stream")).toBe(
      "https://media.example.test/stream",
    );
  });
});