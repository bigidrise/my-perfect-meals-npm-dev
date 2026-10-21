/** @jest-environment jsdom */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockToast = jest.fn();
const mockCheckSafety = jest.fn();
const mockClearAlert = jest.fn();
jest.mock("@/lib/api", () => ({ apiJSON: jest.fn() }));
jest.mock("@/lib/developmentPairingMessages", () => ({ __esModule: true, developmentPairingMessagesEnabled: true }));
jest.mock("wouter", () => ({ useLocation: () => ["/lifestyle/chef-pairings", jest.fn()] }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ initial, animate, transition, children, ...props }: any) => <div {...props}>{children}</div> },
}));
jest.mock("lucide-react", () => ({ ArrowLeft: () => null, Wine: () => null, Beer: () => null, Martini: () => null }));
jest.mock("@/components/ui/card", () => {
  const Wrapper = ({ children }: any) => <div>{children}</div>;
  return { Card: Wrapper, CardContent: Wrapper, CardHeader: Wrapper, CardTitle: Wrapper };
});
jest.mock("@/components/glass", () => ({
  GlassButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
jest.mock("@/components/ui/progress", () => ({ Progress: () => null }));
jest.mock("@/components/MealGenerationProgress", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/components/PhaseGate", () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock("@/components/copilot/useCopilotPageExplanation", () => ({ useCopilotPageExplanation: () => undefined }));
jest.mock("@/components/guided/QuickTourButton", () => ({ QuickTourButton: () => null }));
jest.mock("@/hooks/useQuickTour", () => ({
  useQuickTour: () => ({ isOpen: false, openTour: jest.fn(), closeTour: jest.fn(), currentStep: 0 }),
}));
jest.mock("@/components/guided/QuickTourModal", () => ({ QuickTourModal: () => null }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "synthetic-test-subject" } }) }));
jest.mock("@/components/SafetyGuardToggle", () => ({ SafetyGuardToggle: () => null }));
jest.mock("@/components/GlucoseGuardToggle", () => ({ GlucoseGuardToggle: () => null }));
jest.mock("@/components/SafetyGuardBanner", () => ({ SafetyGuardBanner: () => null }));
jest.mock("@/hooks/useSafetyGuardPrecheck", () => ({
  useSafetyGuardPrecheck: () => ({
    checking: false, alert: null, checkSafety: mockCheckSafety, clearAlert: mockClearAlert,
    setAlert: jest.fn(), setOverrideToken: jest.fn(), overrideToken: undefined, hasActiveOverride: false,
  }),
}));
jest.mock("@/components/FavoriteButton", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/AlcoholRecommendationCard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: ({ children }: any) => children }));

import ChefPairings from "@/pages/ChefPairings";
import { apiJSON } from "@/lib/api";
import * as gate from "@/lib/developmentPairingMessages";

const explanation =
  "Verified pairing ingredients are unavailable for your active food-safety restrictions. Please check a complete label or ask the venue.";
const ingredientError = () => Object.assign(new Error("API 503 Service Unavailable"), {
  status: 503, body: JSON.stringify({ code: "PAIRING_INGREDIENTS_UNVERIFIED", error: explanation }),
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  Object.defineProperty(gate, "developmentPairingMessagesEnabled", { value: true, configurable: true });
  window.scrollTo = jest.fn();
  mockCheckSafety.mockResolvedValue(true);
  (apiJSON as jest.Mock).mockRejectedValue(ingredientError());
  global.fetch = jest.fn(() => Promise.reject(new Error("Unexpected real network request"))) as any;
});
afterEach(cleanup);

async function submitOnce() {
  render(<ChefPairings />);
  fireEvent.change(screen.getByPlaceholderText("e.g., steak, salmon, pizza, burger..."), {
    target: { value: "Grilled zucchini and mushrooms" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find Pairings" }));
  await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
}

it("submits with unchanged strict safety and shows the reason-coded warning without rerunning", async () => {
  await submitOnce();
  expect(mockToast).toHaveBeenCalledWith({
    title: "Ingredient verification required", description: explanation, variant: "warning",
  });
  expect(mockCheckSafety).toHaveBeenCalledWith("Grilled zucchini and mushrooms", "chef-pairings");
  expect(apiJSON).toHaveBeenCalledTimes(1);
  expect(apiJSON).toHaveBeenCalledWith("/api/ai/chef-pairings", {
    method: "POST", json: {
      foodItem: "Grilled zucchini and mushrooms", userId: "synthetic-test-subject",
      safetyMode: "STRICT", overrideToken: undefined,
    },
  });
  expect(screen.getByRole("button", { name: "Find Pairings" }).hasAttribute("disabled")).toBe(false);
  expect(mockClearAlert).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

it("keeps unrelated service failures on the existing generic message", async () => {
  (apiJSON as jest.Mock).mockRejectedValue(Object.assign(new Error("Service unavailable"), {
    status: 503, body: JSON.stringify({ code: "PROTOCOL_CONTEXT_UNRESOLVED" }),
  }));
  await submitOnce();
  expect(mockToast).toHaveBeenCalledWith({
    title: "Generation Failed", description: "Please try again.", variant: "destructive",
  });
});

it("does not change the established Production message path", async () => {
  Object.defineProperty(gate, "developmentPairingMessagesEnabled", { value: false });
  await submitOnce();
  expect(mockToast).toHaveBeenCalledWith({
    title: "Generation Failed", description: "Please try again.", variant: "destructive",
  });
});
