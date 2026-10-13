/** @jest-environment jsdom */
import React, { StrictMode } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { OnboardingWelcome } from "@/components/guided/OnboardingWelcome";
import { useQuickTour } from "../useQuickTour";

jest.mock("@/components/guided/OnboardingWelcome.css", () => ({}));
jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => ({ isOpen: false, close: jest.fn() }),
}));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/components/ui/universal-modal", () => ({
  UniversalDialog: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null,
}));
jest.mock("@/components/ui/dialog", () => ({
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

const accountId = "synthetic-account";
const seenKey = `quick-tour::development-setup-welcome-v1::${accountId}`;

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); });

test("opens automatically without waiting, including StrictMode, and explains only onboarding", () => {
  render(<StrictMode><OnboardingWelcome accountId={accountId} /></StrictMode>);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Let's Get to Know You" })).toBeTruthy();
  expect(screen.getByText(/your food preferences, your goals, and your lifestyle/)).toBeTruthy();
  for (const text of ["Set Your Nutrition Targets", "Discover Your Meal Tools", "Shop for Your Meals"]) {
    expect(screen.queryByText(text)).toBeNull();
  }
});

test("Start Onboarding only dismisses the explanation and retains the existing questions", () => {
  const originalFetch = window.fetch;
  const request = jest.fn();
  window.fetch = request;
  const originalPath = window.location.pathname;
  render(<><OnboardingWelcome accountId={accountId} /><input aria-label="Existing onboarding question" /></>);
  fireEvent.click(screen.getByRole("button", { name: "Start Onboarding" }));
  act(() => { jest.runOnlyPendingTimers(); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Existing onboarding question" })).toBeTruthy();
  expect(window.location.pathname).toBe(originalPath);
  expect(request).not.toHaveBeenCalled();
  expect(localStorage.getItem(seenKey)).toBeNull();
  window.fetch = originalFetch;
});

test.each([seenKey, "quick-tour-global-disabled"])("respects deliberate opt-out %s and still allows Guide", key => {
  localStorage.setItem(key, key === seenKey ? "seen" : "true");
  render(<OnboardingWelcome accountId={accountId} />);
  act(() => { jest.runOnlyPendingTimers(); });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open setup guide" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(localStorage.getItem(key)).toBe(key === seenKey ? "seen" : "true");
});

test("Don't show again persists only this account's introduction", () => {
  const view = render(<OnboardingWelcome accountId={accountId} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Start Onboarding" }));
  expect(localStorage.getItem(seenKey)).toBe("seen");
  view.unmount();
  render(<OnboardingWelcome accountId="another-synthetic-account" />);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("other pages retain their existing delayed guide behavior", () => {
  const { result } = renderHook(() => useQuickTour("unrelated-page"));
  expect(result.current.shouldShow).toBe(false);
  act(() => { jest.advanceTimersByTime(499); });
  expect(result.current.shouldShow).toBe(false);
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current.shouldShow).toBe(true);
});
