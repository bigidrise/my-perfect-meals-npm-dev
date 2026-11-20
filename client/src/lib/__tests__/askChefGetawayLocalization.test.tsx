/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/i18n";
import CoachsCorner from "@/pages/CoachsCorner";
import MyPerfectGetaway from "@/pages/lifestyle/MyPerfectGetaway";
import GetawayAvailabilityNotice from "@/components/away-from-home/GetawayAvailabilityNotice";
import GetawayVenueMeals from "@/components/away-from-home/GetawayVenueMeals";
import CoachFeatureAction from "@/components/coaching/CoachFeatureAction";
import { consumerEnglish, consumerSpanish } from "@/i18n/consumerJourney";
import { consumerFeatureSpanish } from "@/i18n/consumerFeatureCopy";

const mockAPI = jest.fn();
const mockNavigate = jest.fn();
let mockDesktop = true;
jest.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mockAPI(...args) }));
jest.mock("wouter", () => ({ useLocation: () => ["/fixture", mockNavigate] }));
jest.mock("@/lib/chefCornerExperience", () => ({ isChefConversationEnabled: () => true }));
jest.mock("@/lib/chefConversationReliabilityGate", () => ({
  isChefConversationReliabilityEnabled: () => false, isChefFeatureScreenContextEnabled: () => false,
}));
jest.mock("@/components/voice/VoiceInputButton", () => ({
  VoiceInputButton: ({ label, disabled }: any) => <button disabled={disabled} aria-label={label}>Voice fixture</button>,
}));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => mockDesktop }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "synthetic-localization" } }) }));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("@/lib/subscriptionCheck", () => ({ isProOrAbove: () => true }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (url: string) => url }));
jest.mock("@/contexts/PageTitleContext", () => ({ usePageTitle: jest.fn() }));
jest.mock("@/components/FavoriteButton", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/away-from-home/AwayFromHomeMealCard", () => ({ __esModule: true, default: () => null }));

let client: QueryClient;
beforeEach(() => {
  mockAPI.mockReset(); mockNavigate.mockReset(); sessionStorage.clear();
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.scrollTo = jest.fn();
  window.scrollTo = jest.fn();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity,
    queryFn: ({ queryKey }) => mockAPI(queryKey[0]) }, mutations: { retry: false } } });
  global.fetch = jest.fn(async input => {
    if (input === "/api/getaway/venues") return { ok: true, json: async () => ({ venues: [] }) } as Response;
    throw new Error(`Unexpected request in offline test: ${String(input)}`);
  }) as any;
});
afterEach(() => { cleanup(); client.clear(); });
const withClient = (element: React.ReactElement) => render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);

test("ordinary resources retain English keys, Spanish content and interpolation parity", () => {
  const variables = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
  for (const [key, proposed] of Object.entries(consumerFeatureSpanish)) {
    expect(consumerEnglish[key]).toBe(key);
    expect(consumerSpanish[key]).toBeTruthy();
    expect(variables(consumerSpanish[key])).toEqual(variables(key));
    expect(proposed.trim()).not.toBe("");
  }
});

describe.each(["en", "es"])("%s actual component copy with offline dependencies", language => {
  beforeEach(async () => { await i18n.changeLanguage(language); });
  test("Ask Chef preserves history and only opens clear confirmation", async () => {
    const stored = "HISTORICAL_RECIPE_NAME_AND_USER_TEXT";
    client.setQueryData(["/api/coach/bootstrap"], {
      profileCompleted: false, profile: null, conversationId: "fixture-conversation",
      messages: [{ id: "fixture-message", role: "user", content: stored, created_at: "2026-11-18", structured_payload: null }],
      hasOlderMessages: false,
    });
    withClient(<CoachsCorner />);
    expect(screen.getByPlaceholderText(language === "es" ? "Pregúntame lo que quieras..." : "Ask me anything...")).toBeEnabled();
    expect(screen.getByText(stored)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Opciones del mensaje" : "Message options" }));
    expect(screen.getByRole("button", { name: language === "es" ? "Eliminar mensaje" : "Delete message" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Borrar conversación" : "Clear conversation" }));
    expect(await screen.findByText(language === "es" ? "¿Borrar esta conversación?" : "Clear this conversation?")).toBeVisible();
    expect(screen.getByText(language === "es"
      ? "Todos los mensajes se eliminarán de forma permanente. Solo se borra el historial del chat."
      : "All messages will be permanently deleted. Only the chat history is removed.")).toBeVisible();
    expect(mockAPI).not.toHaveBeenCalled();
  });
  test.each([true, false])("Getaway desktop branch=%s localizes entry without venue or account writes", async desktop => {
    mockDesktop = desktop;
    render(<MyPerfectGetaway />);
    await waitFor(() => expect(screen.getByText(language === "es" ? "Come bien estés donde estés" : "Eat Well, Anywhere")).toBeVisible());
    expect(screen.getByRole("button", { name: language === "es" ? "Buscar establecimiento" : "Search venue" })).toBeDisabled();
    expect(screen.getByPlaceholderText(language === "es" ? "Busca una ubicación o un establecimiento…" : "Search location or venue…")).toBeVisible();
    expect(screen.getByRole("button", { name: /Disney World/ })).toBeVisible();
    expect(screen.getByRole("button", { name: language === "es" ? /Un complejo turístico/ : /A resort/ })).toBeVisible();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(mockAPI).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
  test("Getaway shared panels retain venue identity, preferences and menu qualification", () => {
    const availability: any = { preferences: { cuisine: "Fixture cuisine", diets: ["vegan"] },
      summary: "UNCHANGED_EVIDENCE", restaurants: [{ name: "VENUE_IDENTITY", address: "SAVED_ADDRESS", menuNote: "MENU_EVIDENCE" }] };
    const before = JSON.stringify(availability);
    render(<GetawayAvailabilityNotice availability={availability} />);
    expect(screen.getByRole("region", { name: language === "es" ? "Posibles establecimientos para comer" : "Possible dining listings" })).toBeVisible();
    expect(screen.getByText(language === "es" ? "La ubicación y el menú necesitan confirmación." : "Location and menu need confirmation.")).toBeVisible();
    expect(screen.getByText("VENUE_IDENTITY")).toBeVisible();
    expect(screen.getByText("MENU_EVIDENCE")).toBeVisible();
    expect(JSON.stringify(availability)).toBe(before);
    render(<GetawayVenueMeals destination={{ destinationName: "VENUE_IDENTITY", venueId: "CANONICAL-ID" }} />);
    expect(screen.getByRole("button", { name: language === "es" ? "Recomendar comidas para este lugar" : "Recommend meals for this venue" })).toBeDisabled();
    expect(mockAPI).not.toHaveBeenCalled();
  });
  test("Chef navigation localizes the control without changing authorization or route", async () => {
    mockAPI.mockResolvedValue({ destinationId: "my_perfect_getaway", route: "/lifestyle/my-perfect-getaway" });
    render(<CoachFeatureAction destinationId="my_perfect_getaway" />);
    fireEvent.click(screen.getByRole("button", { name: language === "es" ? "Abrir Mi Escapada Perfecta" : "Open My Perfect Getaway" }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/lifestyle/my-perfect-getaway"));
    expect(mockAPI).toHaveBeenCalledWith("/api/coach/navigation", {
      method: "POST", body: JSON.stringify({ destinationId: "my_perfect_getaway" }),
    });
  });
});
