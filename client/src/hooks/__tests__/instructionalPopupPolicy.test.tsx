/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import * as policy from "@/lib/instructionalPopupPolicy";
import { shouldAllowAutoOpen, useCopilotRespectGuard } from "@/components/copilot/CopilotRespectGuard";
import { useQuickTour } from "@/hooks/useQuickTour";
import { useCopilotPageExplanation } from "@/components/copilot/useCopilotPageExplanation";
import { CopilotButton } from "@/components/copilot/CopilotButton";

const mockOpen = jest.fn();
const mockClose = jest.fn();
const mockResponse = jest.fn();
jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => ({ isOpen: false, open: mockOpen, close: mockClose, setLastResponse: mockResponse }),
}));
jest.mock("wouter", () => ({ useLocation: () => ["/fridge-rescue", jest.fn()] }));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false }));
jest.mock("@/components/copilot/ChefCapIcon", () => ({ ChefCapIcon: () => <svg aria-hidden="true" /> }));
jest.mock("@/components/copilot/CopilotPageExplanations", () => ({
  getGuestPageExplanation: () => ({ title: "Guide", description: "Help", spokenText: "Manual explanation" }),
}));
jest.mock("framer-motion", () => ({
  motion: { button: ({ children, whileTap, whileHover, ...props }: any) => <button {...props}>{children}</button> },
}));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("release default disables automatic explanations even with previous autoplay opt-in", () => {
  expect(policy.AUTOMATIC_INSTRUCTIONAL_POPUPS_ENABLED).toBe(false);
  localStorage.setItem("coachMode", "guided");
  localStorage.setItem("copilot_autoplay_enabled", "true");
  expect(shouldAllowAutoOpen()).toBe(false);
  expect(useCopilotRespectGuard().shouldAllowAutoOpen).toBe(false);
  expect(localStorage.getItem("copilot_autoplay_enabled")).toBe("true");
});

test("opening and revisiting a feature never auto-opens Copilot or writes a response", () => {
  const first = renderHook(() => useCopilotPageExplanation());
  act(() => { jest.runOnlyPendingTimers(); });
  first.unmount();
  renderHook(() => useCopilotPageExplanation());
  act(() => { jest.runOnlyPendingTimers(); });
  expect(mockOpen).not.toHaveBeenCalled();
  expect(mockResponse).not.toHaveBeenCalled();
});

test.each([undefined, false, true])("Quick Tour stays closed automatically with setupComplete=%s, but manual Guide still works", setupComplete => {
  const { result } = renderHook(() => useQuickTour("academy-test", undefined, { setupComplete }));
  act(() => { jest.runOnlyPendingTimers(); });
  expect(result.current.shouldShow).toBe(false);
  expect(localStorage.getItem("quick-tour::academy-test")).toBeNull();
  act(() => result.current.openTour());
  expect(result.current.shouldShow).toBe(true);
  act(() => result.current.closeTour(false));
  expect(result.current.shouldShow).toBe(false);
});

test("manual Chef help still opens the sheet and supplies the page explanation", () => {
  render(<CopilotButton />);
  fireEvent.click(screen.getByRole("button"));
  act(() => { jest.runOnlyPendingTimers(); });
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(mockResponse).toHaveBeenCalledWith(expect.objectContaining({
    spokenText: "Manual explanation", autoClose: false,
  }));
});
