/** @jest-environment jsdom */
import { patchFetchForCredentials } from "@/lib/fetch-credentials-patch";
import { LANGUAGE_PREFERENCE_KEY } from "@/i18n/languagePreference";

jest.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => false } }));
jest.mock("@/lib/resolveApiBase", () => ({ resolveApiBase: () => "https://approved-api.invalid" }));

const originalFetch = jest.fn();
beforeEach(() => {
  localStorage.clear();
  delete (window as any).__fetchCredsPatched;
  originalFetch.mockReset().mockResolvedValue({ ok: true, status: 200 });
  window.fetch = originalFetch;
});
afterEach(() => jest.restoreAllMocks());

test("a fresh Spanish-device API request carries Spanish while Auto stays Auto", async () => {
  jest.spyOn(navigator, "language", "get").mockReturnValue("es-MX");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "auto");
  patchFetchForCredentials();
  await window.fetch("/api/chef", { method: "GET" });
  const headers = originalFetch.mock.calls[0][1].headers as Headers;
  expect(headers.get("x-mpm-ui-language")).toBe("es");
  expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("auto");
});

test("an explicit English choice wins without changing the submitted body or pre-auth security", async () => {
  jest.spyOn(navigator, "language", "get").mockReturnValue("es-ES");
  localStorage.setItem(LANGUAGE_PREFERENCE_KEY, "en");
  patchFetchForCredentials();
  const body = JSON.stringify({ email: "fixture@example.invalid", password: "synthetic-only" });
  await window.fetch("/api/auth/login", { method: "POST", body });
  const init = originalFetch.mock.calls[0][1];
  expect(init.headers.get("x-mpm-ui-language")).toBe("en");
  expect(init.body).toBe(body);
  expect(init.credentials).toBe("include");
  expect(init.headers.has("x-auth-token")).toBe(false);
});

test("third-party requests and local assets receive no new language header", async () => {
  patchFetchForCredentials();
  await window.fetch("https://external.example.invalid/image");
  expect(originalFetch.mock.calls[0][1]).toBeUndefined();
  await window.fetch("/icons/chef.png");
  expect(originalFetch.mock.calls[1][1].headers).toBeUndefined();
});
