/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import {
  resolveMeasurementSystem, measurementPreference, MEASUREMENT_COUNTRIES,
  parseMeasurementNumber, parseWeightToLbs, convertServingDisplay,
  convertHeightDisplay, convertLengthDisplay, convertVolumeDisplay,
  convertWeightLbsDisplay, getMeasurementPromptBlock,
} from "@shared/units";
import { restoreBodyMeasurementDraft } from "@/lib/units";
import { formatQuantity } from "@/lib/formatQuantity";
import { saveMeasurementPreferences } from "@/lib/measurementPreferences";
import { MeasurementPreferencesControls } from "@/components/profile/MeasurementPreferencesControls";
import { MeasurementQuantity } from "@/components/MeasurementQuantity";
import { ProductLabelQuantity } from "@/components/ProductLabelQuantity";
import { computeMacros } from "../../../../server/services/macroCalculatorEngine";

let mockUser = { id: "fixture-a", measurementSystem: "auto", countryCode: "CA", preferredLanguage: "en" };
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(async () => {
  mockUser = { id: "fixture-a", measurementSystem: "auto", countryCode: "CA", preferredLanguage: "en" };
  await i18n.changeLanguage("en");
});

describe("one account preference, independent of language", () => {
  test.each(MEASUREMENT_COUNTRIES)("Auto and manual matrix for %s", country => {
    expect(resolveMeasurementSystem("auto", country)).toBe(country === "US" ? "imperial" : "metric");
    expect(resolveMeasurementSystem("imperial", country)).toBe("imperial");
    expect(resolveMeasurementSystem("metric", country)).toBe("metric");
  });
  test.each([undefined, null, "", "ZZ", "GB"])("missing/unsupported country %p explicitly retains US fallback", country => {
    expect(resolveMeasurementSystem("auto", country)).toBe("imperial");
    expect(resolveMeasurementSystem(null, country)).toBe("imperial");
    expect(resolveMeasurementSystem("metric", country)).toBe("metric");
  });
  test("legacy manual preferences keep their meaning; unset is Auto, not a backfill", () => {
    expect(measurementPreference("imperial")).toBe("imperial");
    expect(measurementPreference("metric")).toBe("metric");
    expect(measurementPreference(null)).toBe("auto");
    const account = Object.freeze({ measurementSystem: null, countryCode: "NZ" });
    expect(resolveMeasurementSystem(account.measurementSystem, account.countryCode)).toBe("metric");
    expect(account.measurementSystem).toBeNull();
  });
  test.each(["en-US", "es-MX", "zh-CN", "ar-EG"])("browser %s cannot change account units", language => {
    const device = jest.spyOn(navigator, "language", "get").mockReturnValue(language);
    expect(resolveMeasurementSystem("auto", "CA")).toBe("metric");
    expect(resolveMeasurementSystem("auto", "US")).toBe("imperial");
    device.mockRestore();
  });
});

describe("actual existing conversion and formatting helpers", () => {
  test.each([
    ["1/2", 0.5], ["1 1/2", 1.5], ["1½", 1.5], ["⅔", 2 / 3],
    ["70,5", 70.5], [".5", 0.5], ["0,125", 0.125], [0, 0], ["-2", -2],
  ] as const)("parses %p without changing its meaning", (text, expected) => {
    expect(parseMeasurementNumber(text)).toBeCloseTo(expected);
  });
  test.each(["1/0", "1,000", "1.234,5", "1,234.5", "a pinch", "2 x 4", "", "NaN", "Infinity"])(
    "ambiguous/invalid %p remains unconverted", quantity => {
      expect(parseMeasurementNumber(quantity)).toBeNull();
      expect(convertServingDisplay(quantity, "cup", "metric")).toBe(`${quantity} cup`.trim());
    },
  );
  test("does not strip comma decimals, signs or unit names from weights", () => {
    expect(parseWeightToLbs("70,5", "metric")).toBeCloseTo(70.5 / 0.453592);
    expect(parseWeightToLbs("-70", "metric")).toBeNull();
    expect(parseWeightToLbs("70 kilograms plus 5", "metric")).toBeNull();
  });
  test("mass and fluid operations remain separate and bidirectional", () => {
    expect(convertServingDisplay("1/2", "oz", "metric")).toBe("14 g");
    expect(convertServingDisplay("1/2", "cup", "metric")).toBe("120 ml");
    expect(convertServingDisplay("1 1/2", "cup", "metric")).toBe("360 ml");
    expect(convertServingDisplay(28.3495, "g", "imperial")).toBe("1 oz");
    expect(convertServingDisplay(240, "ml", "imperial")).toBe("1 cup");
    expect(convertServingDisplay(1, "fl oz", "metric")).toBe("30 ml");
    expect(convertServingDisplay(1, "oz", "metric")).toBe("28 g");
    expect(convertServingDisplay(1, "tbsp", "metric")).toBe("15 ml");
    expect(convertServingDisplay("1/2", "tsp", "metric")).toBe("0.5 tsp");
  });
  test.each(["each", "scoops", "package", "unknown", "mg", "kcal", "%", "mmHg"])(
    "%s is not converted, guessed or reclassified", unit => {
      expect(convertServingDisplay("1/2", unit, "metric")).toBe(`1/2 ${unit}`);
      expect(convertServingDisplay(2, unit, "imperial")).toBe(`2 ${unit}`);
    },
  );
  test("small positive quantities retain precision without disappearing", () => {
    expect(convertServingDisplay(0.0001, "g", "imperial")).toBe("0.0001 g");
    expect(convertServingDisplay(0.26, "g", "imperial")).toBe("0.26 g");
    expect(convertServingDisplay(0.75, "ml", "metric")).toBe("0.75 ml");
    expect(convertServingDisplay(2.6, "ml", "imperial")).toBe("2.6 ml");
    expect(convertServingDisplay(4.9, "ml", "imperial")).toBe("4.9 ml");
    expect(convertServingDisplay(5, "ml", "imperial")).toBe("1 tsp");
    expect(convertServingDisplay(15, "ml", "imperial")).toBe("1 tbsp");
    expect(convertServingDisplay(240, "ml", "imperial")).toBe("1 cup");
  });

  test("rounding carries without 5ft12in or lost cups; zero is not a teaspoon", () => {
    expect(convertHeightDisplay(182, "imperial")).toBe('6\' 0"');
    expect(convertVolumeDisplay(456, "imperial")).toBe("2 cup");
    expect(convertVolumeDisplay(0, "imperial")).toBe("0 cup");
    expect(convertVolumeDisplay(-1, "metric")).toBe("—");
    expect(convertLengthDisplay(30, "in", "metric")).toBe("76.2 cm");
    expect(convertLengthDisplay(76.2, "cm", "metric")).toBe("76.2 cm");
    expect(convertWeightLbsDisplay(154.3, "metric")).toBe("70 kg");
  });
  test("shopping formatting uses the actual parser and preserves ambiguous source text and counts", () => {
    expect(formatQuantity("1/2", "cup", "metric")).toBe("120 ml");
    expect(formatQuantity("1/2", "cup")).toBe("½ cup");
    expect(formatQuantity("1,000", "g", "imperial")).toBe("1,000 g");
    expect(formatQuantity(2, "spray")).toBe("2 spray");
    expect(formatQuantity(0, "each")).toBe("0 each");
  });
});

test("explicit draft source units survive restoration and repeated display toggles without changing macros", () => {
  const original = Object.freeze({
    units: "metric", weightKg: 70.5, heightCm: 172.3, waistCm: 82.7,
    weightLbs: 999, heightFt: 9, heightIn: 9, waistIn: 999,
  });
  let draft = restoreBodyMeasurementDraft({ ...original, units: String(original.units) });
  for (let n = 0; n < 20; n++) {
    draft = restoreBodyMeasurementDraft({ ...draft, units: n % 2 ? "metric" : "imperial" });
  }
  expect(draft.weightKg).toBeCloseTo(original.weightKg, 10);
  expect(draft.heightCm).toBeCloseTo(original.heightCm, 10);
  expect(draft.waistCm).toBeCloseTo(original.waistCm, 10);
  expect(original.weightLbs).toBe(999);
  const input = {
    goal: "maint", sex: "female", age: 42,
    kg: original.weightKg, cm: original.heightCm,
    activity: "moderate", bodyType: "meso", userType: "flexible",
    highWaistRisk: true, menopause: false, insulinResistance: true, highStress: false,
    mealsPerDay: 3, fibrousCarbSafetyCap_g: 40, cutIntensity: "none", cutStyle: "balanced",
    starchyCarbCap_g: null, allowZeroStarchyOnLowDay: false, strictMode: false,
  } as Parameters<typeof computeMacros>[0];
  const before = computeMacros(input);
  expect(Number.isFinite(before.target)).toBe(true);
  for (const system of ["imperial", "metric"] as const) {
    convertWeightLbsDisplay(input.kg / 0.45359237, system);
    convertLengthDisplay(original.waistCm, "cm", system);
    convertServingDisplay("1/2", "cup", system);
  }
  expect(computeMacros(input)).toEqual(before);
});

test("resolved two-value systems reach existing prompt rules, without changing safety or scoop exceptions", () => {
  expect(getMeasurementPromptBlock(resolveMeasurementSystem("auto", "CA"))).toContain("METRIC MEASUREMENT RULES");
  expect(getMeasurementPromptBlock(resolveMeasurementSystem("auto", "US"))).toContain("U.S. MEASUREMENT RULES");
  for (const mode of ["metric", "imperial"] as const) {
    expect(getMeasurementPromptBlock(mode)).toContain("Scoop sizes vary by brand");
  }
});

describe("checked saves and authoritative restoration, entirely local mocks", () => {
  const selection = { accountId: "fixture-a", measurementSystem: "auto" as const, countryCode: "CA" };
  const actions = () => ({
    request: jest.fn().mockResolvedValue({ ok: true }),
    refresh: jest.fn().mockResolvedValue({ id: "fixture-a", measurementSystem: "auto", countryCode: "CA" }),
    isCurrentAccount: jest.fn().mockReturnValue(true),
    message: (key: string) => key,
  });
  test("sends only existing measurement fields and waits for matching account restoration", async () => {
    const a = actions();
    const result = await saveMeasurementPreferences(selection, a);
    expect(result).toEqual({ id: "fixture-a", measurementSystem: "auto", countryCode: "CA" });
    expect(a.request).toHaveBeenCalledWith({ measurementSystem: "auto", countryCode: "CA" });
    expect(selection).toEqual({ accountId: "fixture-a", measurementSystem: "auto", countryCode: "CA" });
  });
  test.each([400, 401, 403, 500])("HTTP %i does not report success, advance or refresh", async () => {
    const a = actions(); a.request.mockResolvedValue({ ok: false });
    await expect(saveMeasurementPreferences(selection, a)).rejects.toThrow("saveFailed");
    expect(a.refresh).not.toHaveBeenCalled();
    expect(selection.measurementSystem).toBe("auto");
  });
  test("transport failure keeps the draft; stale refreshes and account changes cannot succeed", async () => {
    const a = actions(); a.request.mockRejectedValue(new Error("offline"));
    await expect(saveMeasurementPreferences(selection, a)).rejects.toThrow("saveFailed");
    const b = actions(); b.refresh.mockResolvedValue({ id: "fixture-b", measurementSystem: "auto", countryCode: "CA" });
    await expect(saveMeasurementPreferences(selection, b)).rejects.toThrow("refreshFailed");
    const c = actions(); c.isCurrentAccount.mockReturnValueOnce(true).mockReturnValue(false);
    await expect(saveMeasurementPreferences(selection, c)).rejects.toThrow("refreshFailed");
    expect(c.refresh).not.toHaveBeenCalled();
    const d = actions(); d.refresh.mockRejectedValue(new Error("offline"));
    await expect(saveMeasurementPreferences(selection, d)).rejects.toThrow("refreshFailed");
  });
});

test.each(["en", "es"])("existing preference controls show three modes and exactly five countries in %s", async language => {
  await i18n.changeLanguage(language);
  const onChange = jest.fn(), onCountryChange = jest.fn();
  render(<MeasurementPreferencesControls value="imperial" country="CA" onChange={onChange} onCountryChange={onCountryChange} />);
  expect(screen.getAllByRole("button")).toHaveLength(8);
  fireEvent.click(screen.getByRole("button", { name: language === "en" ? "United States" : "Estados Unidos" }));
  expect(onCountryChange).toHaveBeenCalledWith("US");
  expect(onChange).not.toHaveBeenCalled();
});

test("view quantities follow the current account with no independent unit cache; original product evidence stays primary", () => {
  const { rerender } = render(<><MeasurementQuantity amount="1/2" unit="cup" /><ProductLabelQuantity label="100 g" /></>);
  expect(screen.getByText("120 mL")).toBeInTheDocument();
  expect(screen.getByText("100 g")).toBeInTheDocument();
  mockUser = { ...mockUser, id: "fixture-b", countryCode: "US" };
  rerender(<><MeasurementQuantity amount="1/2" unit="cup" /><ProductLabelQuantity label="100 g" /></>);
  expect(screen.queryByText("120 mL")).not.toBeInTheDocument();
  expect(screen.getByText("100 g")).toBeInTheDocument();
  expect(screen.getByText(/Equivalent: 3.5 oz/)).toBeInTheDocument();
});
