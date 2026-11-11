/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import GuestBuilder from "@/pages/GuestBuilder";
import { ProTipCard } from "@/components/ProTipCard";
import * as policy from "@/lib/instructionalPopupPolicy";
import { isGuestMode } from "@/lib/guestMode";

const mockOpen = jest.fn();
const mockResponse = jest.fn();
const mockNavigate = jest.fn();
const mockNarration = jest.fn(() => ({
  isPlaying: false, currentSectionIndex: 0, totalSections: 1,
  play: jest.fn(), pause: jest.fn(), resume: jest.fn(), stop: jest.fn(),
  reset: jest.fn(), skipBack10: jest.fn(),
}));
jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => ({ isOpen: false, open: mockOpen, setLastResponse: mockResponse }),
}));
jest.mock("@/hooks/useNarration", () => ({
  useNarration: () => mockNarration(),
}));
jest.mock("wouter", () => ({ useLocation: () => ["/guest-builder", mockNavigate] }));
jest.mock("@/lib/guestMode", () => ({
  isGuestMode: jest.fn(() => true), endGuestSession: jest.fn(),
}));
jest.mock("@/hooks/useGuestProgress", () => ({
  useGuestProgress: () => ({
    isFeatureUnlocked: () => true, getUnlockMessage: () => "",
    nextStepMessage: "", shouldShowUpgrade: false, generationsRemaining: 3,
    daysRemaining: 7, phase: 1, showSoftNudge: false, showHardGate: false,
    biometricsRevealed: false,
  }),
}));
jest.mock("@/lib/guestSuiteNavigator", () => ({ hasCompletedFirstLoop: () => false }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/productionGates", () => ({ isFeatureEnabled: () => true }));
jest.mock("@/components/GuestModeBanner", () => ({ GuestModeBanner: () => null }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/components/modals/GuestUpgradePromptModal", () => ({ GuestUpgradePromptModal: () => null }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({
  __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/copilot/ChefCapIcon", () => ({
  ChefCapIcon: () => <span>Manual Chef</span>,
}));
jest.mock("@/components/copilot/CopilotPageExplanations", () => ({
  getGuestPageExplanation: () => ({
    title: "Guest welcome", description: "Guest help", spokenText: "Guest explanation", autoClose: true,
  }),
}));
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, whileTap, whileHover, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  jest.mocked(isGuestMode).mockReturnValue(true);
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test("guest welcome never auto-opens on first visit or revisit, even with Guide enabled", () => {
  expect(policy.AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED).toBe(false);
  localStorage.setItem("coachMode", "guided");
  localStorage.setItem("copilot_autoplay_enabled", "true");
  const first = render(<GuestBuilder />);
  act(() => { jest.advanceTimersByTime(2000); });
  first.unmount();
  render(<GuestBuilder />);
  act(() => { jest.advanceTimersByTime(2000); });
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockResponse).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("guest_copilot_welcome_seen")).toBeNull();
  expect(localStorage.getItem("copilot_autoplay_enabled")).toBe("true");
});

test("manual guest Chef still opens Copilot and supplies its explanation", () => {
  render(<GuestBuilder />);
  fireEvent.click(screen.getByRole("button", { name: /Manual Chef/i }));
  act(() => { jest.advanceTimersByTime(2000); });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockResponse).toHaveBeenCalledWith(expect.objectContaining({
    title: "Guest welcome", spokenText: "Guest explanation",
  }));
});

test("non-guests still navigate to welcome rather than receiving a guest popup", () => {
  jest.mocked(isGuestMode).mockReturnValue(false);
  render(<GuestBuilder />);
  act(() => { jest.advanceTimersByTime(2000); });
  expect(mockNavigate).toHaveBeenCalledWith("/welcome");
  expect(mockOpen).not.toHaveBeenCalled();
});

test("embedded Pro Tip cards render nothing and do not initialize narration", () => {
  const { container } = render(<ProTipCard />);
  expect(container.innerHTML).toBe("");
  expect(mockNarration).not.toHaveBeenCalled();
});

test("the existing policy can restore the retained Pro Tip content and manual Listen action", () => {
  jest.replaceProperty(policy as { AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED: boolean }, "AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED", true);
  render(<ProTipCard />);
  expect(screen.getByText("★ Pro Tip")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Listen" }));
  const narration = mockNarration.mock.results[0].value;
  expect(narration.play).toHaveBeenCalledTimes(1);
});

test("the existing policy can restore the automatic guest welcome", () => {
  jest.replaceProperty(policy as { AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED: boolean }, "AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED", true);
  render(<GuestBuilder />);
  act(() => { jest.advanceTimersByTime(1200); });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockResponse).toHaveBeenCalledWith(expect.objectContaining({ title: "Guest welcome" }));
  expect(sessionStorage.getItem("guest_copilot_welcome_seen")).toBe("true");
});
