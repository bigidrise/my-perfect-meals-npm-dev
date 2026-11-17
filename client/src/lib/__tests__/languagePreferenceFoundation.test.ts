/** @jest-environment jsdom */
import {
  LANGUAGE_PREFERENCE_KEY, SUPPORTED_UI_LANGUAGES, normalizeLanguagePreference,
  readLanguagePreference, resolveLanguagePreference, storeLanguagePreference,
} from "@/i18n/languagePreference";

beforeEach(() => localStorage.clear());

test.each(SUPPORTED_UI_LANGUAGES)("explicit %s survives startup and device-language differences", language => {
  storeLanguagePreference(language);
  expect(readLanguagePreference()).toBe(language);
  expect(resolveLanguagePreference(readLanguagePreference(), "es-MX")).toBe(language);
});

test("Auto remains Auto across refresh and follows each device without an explicit write", () => {
  storeLanguagePreference("auto");
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("auto");
  expect(resolveLanguagePreference(readLanguagePreference(), "es-MX")).toBe("es");
  expect(resolveLanguagePreference(readLanguagePreference(), "fr-CA")).toBe("fr");
  expect(localStorage.getItem(LANGUAGE_PREFERENCE_KEY)).toBe("auto");
});

test.each([null, undefined, "null", "", "unsupported", "{invalid}"])("invalid/missing hint %s cannot break startup", value => {
  expect(normalizeLanguagePreference(value)).toBe("auto");
  expect(resolveLanguagePreference(value, "xx-XX")).toBe("en");
});

test("region tags normalize without changing the choice into a device language", () => {
  storeLanguagePreference("es-419");
  expect(readLanguagePreference()).toBe("es");
  expect(resolveLanguagePreference("auto", "AR-EG")).toBe("ar");
});

test("disabled storage does not break language resolution", () => {
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(readLanguagePreference()).toBe("auto");
  expect(() => storeLanguagePreference("es")).not.toThrow();
  read.mockRestore();
  write.mockRestore();
});

test("fresh initialization restores Spanish before rendering even on an English device", () => {
  storeLanguagePreference("es");
  const device = jest.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  jest.isolateModules(() => {
    const initialized = require("@/i18n").default;
    expect(initialized.language).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dir).toBe("ltr");
  });
  device.mockRestore();
});
