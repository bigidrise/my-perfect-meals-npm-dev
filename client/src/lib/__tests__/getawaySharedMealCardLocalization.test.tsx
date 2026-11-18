/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import i18n from "@/i18n";
import AwayFromHomeMealCard from "@/components/away-from-home/AwayFromHomeMealCard";
import GetawayMealImage from "@/components/away-from-home/GetawayMealImage";
import { GETAWAY_MENU_NOTICE } from "@shared/getawayEvidence";
import fs from "node:fs";

jest.mock("wouter", () => ({ useLocation: () => ["/fixture", jest.fn()] }));
jest.mock("@/lib/queryClient", () => ({ apiRequest: jest.fn(() => { throw new Error("Unexpected mutation"); }) }));
jest.mock("@/components/away-from-home/MacroConfirmSheet", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ChefFlowImage", () => ({ ChefFlowImage: () => null }));
jest.mock("@/components/away-from-home/RestaurantPortions", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/away-from-home/PlateItems", () => ({ __esModule: true, default: () => null }));
afterEach(cleanup);

test.each(["en", "es"])("%s shared meal card localizes chrome without translating meal evidence or making requests", async language => {
  await i18n.changeLanguage(language);
  global.fetch = jest.fn(() => { throw new Error("Unexpected network"); }) as any;
  const rec: any = {
    id: "fixture-card", restaurantName: "RESTAURANT_IDENTITY", nutritionStatus: "estimated",
    meal: { name: "HISTORICAL_MEAL", description: "SAVED_DESCRIPTION", calories: 400,
      proteinGrams: 30, fatGrams: 12, starchyCarbGrams: 25, fibrousCarbGrams: 4 },
    recommendation: { reason: "EXISTING_EVIDENCE", howToOrder: { askFor: "AUTHORED_ORDER", modify: [], swap: [] },
      medicalWaiterScript: "PROTECTED_WAITER_SCRIPT" },
    protocol: { badges: [] },
  };
  const before = JSON.stringify(rec);
  render(<AwayFromHomeMealCard recommendation={rec} />);
  expect(screen.getByText("HISTORICAL_MEAL")).toBeVisible();
  expect(screen.getByText("PROTECTED_WAITER_SCRIPT")).toBeVisible();
  expect(screen.getByText(language === "es" ? "Cómo pedir" : "How to order")).toBeVisible();
  expect(screen.getByText(language === "es" ? "Pide: AUTHORED_ORDER" : "Ask for: AUTHORED_ORDER")).toBeVisible();
  expect(screen.getByRole("button", { name: language === "es" ? "Registrar o añadir al plan" : "Log or Add to Plan" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Traducir" : "Translate" }));
  expect(screen.getByText(language === "es" ? "Traducir a" : "Translate to")).toBeVisible();
  expect(screen.getByRole("button", { name: "Español" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Français" })).not.toBeInTheDocument();
  expect(JSON.stringify(rec)).toBe(before);
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each(["en", "es"])("%s Getaway image fallback retains a clear non-photograph qualification", async language => {
  await i18n.changeLanguage(language);
  render(<GetawayMealImage name="ORIGINAL_MEAL_NAME" />);
  expect(screen.getByRole("img").getAttribute("alt")).toBe(language === "es"
    ? "Mascota Flame Chef, no es una fotografía de la comida"
    : "Flame Chef mascot — not a meal photograph");
});

test("protected candidates remain pending and their English sources stay intact", () => {
  const manifest = JSON.parse(fs.readFileSync("docs/localization/clinical-review/ask-chef-getaway.es.review.json", "utf8"));
  for (const entry of manifest.entries) {
    expect(entry.status).toBe("pending");
    expect(entry.reviewer).toBeNull();
    const source = fs.readFileSync(entry.file, "utf8").replace(/\s+/g, " ");
    expect(source).toContain(entry.sourceText);
  }
  expect(GETAWAY_MENU_NOTICE).toContain("especially for allergies or clinical requirements");
});
