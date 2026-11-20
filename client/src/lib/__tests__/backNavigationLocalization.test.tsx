/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { BackNavigationLabel, BACK_NAVIGATION_SOURCES } from "@/components/navigation/BackNavigationLabel";
import { AcademyBackButton } from "@/components/AcademyBackButton";
import { OnboardingFooter } from "@/components/OnboardingFooter";
import { BIOMETRICS_SOURCES } from "@/lib/biometricsNavigation";
import { execFileSync } from "node:child_process";

afterEach(cleanup);

test("every registered navigation source has real English and Spanish resources", () => {
  for (const source of BACK_NAVIGATION_SOURCES) {
    expect(consumerEnglish[source]).toBe(source);
    expect(consumerSpanish[source]?.trim()).toBeTruthy();
    expect(consumerSpanish[source]).not.toBe(source);
  }
  for (const source of Object.values(BIOMETRICS_SOURCES)) {
    expect(BACK_NAVIGATION_SOURCES).toContain(source.label);
  }
});

test.each(["en", "es"])("%s labels use the selected language without changing callbacks", async language => {
  await i18n.changeLanguage(language);
  const onBack = jest.fn();
  render(<AcademyBackButton label="Partner Programs" onClick={onBack} />);
  fireEvent.click(screen.getByRole("button", {
    name: language === "es" ? "Programas de colaboradores" : "Partner Programs",
  }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("a mounted shared control follows language changes immediately", async () => {
  await i18n.changeLanguage("en");
  const onBack = jest.fn();
  render(<OnboardingFooter isSaving={false} onSave={jest.fn()} onBack={onBack} />);
  expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  await act(async () => { await i18n.changeLanguage("es"); });
  fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("named destinations translate but unknown labels remain original", async () => {
  await i18n.changeLanguage("es");
  render(<>
    <span><BackNavigationLabel label="Saved Meals" backTo /></span>
    <span><BackNavigationLabel label="Original external label" /></span>
  </>);
  expect(screen.getByText("Volver a Comidas guardadas")).toBeInTheDocument();
  expect(screen.getByText("Original external label")).toBeInTheDocument();
});

test("the reported GLP-1 label and existing navigation keys resolve in Spanish", async () => {
  await i18n.changeLanguage("es");
  expect(i18n.t("metabolicBuilder.glp1Hub")).toBe("Centro de GLP-1");
  expect(i18n.t("businessCenter.back")).toBe("Atrás");
  expect(i18n.t("joinStudio.backToApp")).toBe("Volver a la aplicación");
  expect(i18n.t("businessCenterSection.backBtn")).toBe("Suite de negocios");
});

test("the whole client source passes the static navigation-label audit", () => {
  const result = JSON.parse(execFileSync(process.execPath,
    ["scripts/check-back-navigation.mjs"], { encoding: "utf8" }));
  expect(result.inspectedFiles).toBeGreaterThan(300);
  expect(result.findings).toEqual([]);
});
