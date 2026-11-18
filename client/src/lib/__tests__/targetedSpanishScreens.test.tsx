/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import Welcome from "@/pages/Welcome";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { ComplianceCard } from "@/components/dashboard/ComplianceCard";
import { localizeComplianceOpportunity } from "@/i18n/dashboardComplianceCopy";
import { consumerSpanish } from "@/i18n/consumerJourney";

const mockDiscovery = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/welcome", jest.fn()] }));
jest.mock("@/lib/auth", () => ({ getCurrentUser: () => null, getAuthHeaders: () => ({}) }));
jest.mock("@/lib/workspaceAvailability", () => ({ fetchWorkspaceAvailability: () => mockDiscovery() }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: () => { throw new Error("Unexpected API request"); } }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ initial, animate, exit, transition, children, ...props }: any) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }: any) => children,
}));

beforeEach(() => {
  mockDiscovery.mockReset();
  global.fetch = jest.fn(() => { throw new Error("Unexpected network"); }) as any;
});
afterEach(cleanup);

describe.each(["en", "es"])("%s targeted display corrections", language => {
  beforeEach(async () => { await i18n.changeLanguage(language); });

  test("welcome and selection modal reuse existing resources and preserve trademarks", () => {
    render(<Welcome />);
    expect(screen.getByText("My Perfect Meals")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Plataforma de nutrición adaptativa con IA" : "Adaptive AI Nutrition Platform")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Con tecnología Emotion AI™" : "Powered by Emotion AI™")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Con tecnología Behavioral AI™" : "Powered by Behavioral AI™")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Iniciar sesión / Crear cuenta" : "Sign In / Create Account" }));
    expect(screen.getByText(language === "es" ? "¿Cómo quieres comenzar?" : "How would you like to start?")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Ya tengo una cuenta" : "I already have an account")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Es mi primera visita" : "I'm new here")).toBeVisible();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("workspace count and organization action translate without changing tenant names", async () => {
    mockDiscovery.mockResolvedValue({
      personal: { destination: "/dashboard" }, studio: { available: false },
      organization: { available: true, destination: "/business-organizations",
        organizations: [{ id: "org-a", name: "UNCHANGED_A", locations: [] }, { id: "org-b", name: "UNCHANGED_B", locations: [] }] },
    });
    const view = render(<WorkspaceChooser />);
    expect(await screen.findByText(language === "es" ? "2 organizaciones disponibles" : "2 available organizations")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Elige una organización" : "Choose an organization")).toBeVisible();
    expect(global.fetch).not.toHaveBeenCalled();
    view.unmount();
    mockDiscovery.mockResolvedValue({
      personal: { destination: "/dashboard" }, studio: { available: false },
      organization: { available: true, destination: "/business-dashboard",
        organizations: [{ id: "org-a", name: "UNCHANGED_A", locations: [{ id: "location-a" }] }] },
    });
    render(<WorkspaceChooser />);
    expect(await screen.findByText("UNCHANGED_A")).toBeVisible();
    expect(screen.getByText(language === "es" ? "Abrir la suite de negocios" : "Open Business Suite")).toBeVisible();
  });

  test.each([false, true])("dashboard labels retain exact scores and evidence (eligible=%s)", eligible => {
    const summary = {
      complianceScore: 81, mealConsistency: 78, mealCompletion: eligible ? 75 : null,
      mealActivity: { completedMealCount: 3, expectedMealCount: 4 },
      loggedDays7: 4, windowDays: 7, mealLogging: 57,
      macroAdherenceEligible: eligible, macroAdherence: 83,
      hydrationEligible: eligible, hydrationAdherence: eligible ? 92 : null,
      mealSlots: { breakfast: 0, lunch: 0, dinner: 0 },
      biggestOpportunity: "Focus on meeting your daily protein target more consistently.",
    };
    const before = JSON.stringify(summary);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    client.setQueryData(["compliance", "synthetic-ui"], summary);
    const view = render(<QueryClientProvider client={client}><ComplianceCard userId="synthetic-ui" /></QueryClientProvider>);
    for (const key of ["Meal consistency", "Meals completed", "Days with meal logs", "Whole-plan macro adherence"]) {
      expect(screen.getByText(language === "es" ? consumerSpanish[key] : key)).toBeVisible();
    }
    expect(screen.getByText("78%")).toBeVisible();
    expect(screen.getByText("4/7 · 57%")).toBeVisible();
    expect(screen.getByText(eligible ? "3/4 · 75%" : language === "es" ? "Aún sin seguimiento" : "Not yet tracked")).toBeVisible();
    expect(screen.getByText(eligible ? "83%" : language === "es" ? "Actualmente no se puntúa" : "Not currently scored")).toBeVisible();
    if (eligible) {
      expect(screen.getByText(language === "es" ? "Adherencia a la hidratación" : "Hydration adherence")).toBeVisible();
      expect(screen.getByText("92%")).toBeVisible();
    } else {
      const explanation = "Hydration is not scored because no current measurable Hydration target is established.";
      expect(screen.getByText(language === "es" ? consumerSpanish[explanation] : explanation)).toBeVisible();
    }
    expect(screen.getByText(language === "es" ? "Céntrate en alcanzar tu objetivo diario de proteínas con más constancia." : summary.biggestOpportunity)).toBeVisible();
    expect(JSON.stringify(summary)).toBe(before);
    expect(client.getQueryData(["compliance", "synthetic-ui"])).toEqual(summary);
    expect(global.fetch).not.toHaveBeenCalled();
    view.unmount(); client.clear();
  });
});

test("unknown or authored advice is never translated by the closed compliance mapping", () => {
  const translate = jest.fn(() => "SHOULD_NOT_REPLACE");
  expect(localizeComplianceOpportunity("HISTORICAL_OR_AUTHORED_ADVICE", translate)).toBe("HISTORICAL_OR_AUTHORED_ADVICE");
  expect(translate).not.toHaveBeenCalled();
});
