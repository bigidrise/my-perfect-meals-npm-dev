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

test("respects explicit global off and still allows Guide", () => {
  localStorage.setItem("quick-tour-global-disabled", "true");
  render(<OnboardingWelcome accountId={accountId} />);
  act(() => { jest.runOnlyPendingTimers(); });
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open setup guide" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(localStorage.getItem("quick-tour-global-disabled")).toBe("true");
});

test("old seen preferences never complete onboarding; closing is only for this visit", () => {
  localStorage.setItem(seenKey, "seen");
  const view = render(<OnboardingWelcome accountId={accountId} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByText("Don't show again")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start Onboarding" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(localStorage.getItem(seenKey)).toBe("seen");
  view.unmount();
  render(<OnboardingWelcome accountId={accountId} />);
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("saved completion suppresses automatic opening but never manual Guide", () => {
  const { result } = renderHook(() => useQuickTour("setup", undefined, {
    autoOpenDelayMs: 0, setupComplete: true,
  }));
  expect(result.current.shouldShow).toBe(false);
  act(() => result.current.openTour());
  expect(result.current.shouldShow).toBe(true);
  act(() => result.current.closeTour(true));
  expect(result.current.shouldShow).toBe(false);
  expect(localStorage.getItem("quick-tour::setup")).toBeNull();
});

test("unknown completion waits; unfinished setup opens once per visit without marking completion", () => {
  const { result, rerender, unmount } = renderHook(
    ({ complete }: { complete: boolean | null }) => useQuickTour("setup", undefined, {
      autoOpenDelayMs: 0, setupComplete: complete,
    }), { initialProps: { complete: null as boolean | null } },
  );
  expect(result.current.shouldShow).toBe(false);
  rerender({ complete: false });
  expect(result.current.shouldShow).toBe(true);
  act(() => result.current.closeTour(true));
  rerender({ complete: false });
  expect(result.current.shouldShow).toBe(false);
  expect(localStorage.getItem("quick-tour::setup")).toBeNull();
  unmount();
  const returning = renderHook(() => useQuickTour("setup", undefined, {
    autoOpenDelayMs: 0, setupComplete: false,
  }));
  expect(returning.result.current.shouldShow).toBe(true);
});

test("switching accounts cannot retain the previous setup introduction", () => {
  const { result, rerender } = renderHook(
    ({ key, complete }) => useQuickTour(key, undefined, { autoOpenDelayMs: 0, setupComplete: complete }),
    { initialProps: { key: "account-a", complete: false as boolean | null } },
  );
  expect(result.current.shouldShow).toBe(true);
  rerender({ key: "account-b", complete: null });
  expect(result.current.shouldShow).toBe(false);
  rerender({ key: "account-b", complete: true });
  expect(result.current.shouldShow).toBe(false);
});

test("other pages retain their existing delayed guide behavior", () => {
  const { result } = renderHook(() => useQuickTour("unrelated-page"));
  expect(result.current.shouldShow).toBe(false);
  act(() => { jest.advanceTimersByTime(499); });
  expect(result.current.shouldShow).toBe(false);
  act(() => { jest.advanceTimersByTime(1); });
  expect(result.current.shouldShow).toBe(true);
});

test("ordinary tool tours still respect their own seen preference", () => {
  localStorage.setItem("quick-tour::unrelated-page", "seen");
  const { result } = renderHook(() => useQuickTour("unrelated-page"));
  act(() => jest.runOnlyPendingTimers());
  expect(result.current.shouldShow).toBe(false);
  act(() => result.current.openTour());
  expect(result.current.shouldShow).toBe(true);
});
