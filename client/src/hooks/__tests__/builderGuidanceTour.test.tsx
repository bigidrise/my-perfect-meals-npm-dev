/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useBuilderGuidanceTour } from "../useBuilderGuidanceTour";
import { BuilderGuidanceTour } from "@/components/guided/BuilderGuidanceTour";
import { MEAL_BUILDER_GUIDANCE, type GuidedMealBuilderKey } from "@shared/mealBuilderGuidance";
import { createGuidancePreferenceStore } from "@/lib/guidedJourney/preferences";

let mockUser: any = { id: "synthetic-guide-owner", role: "physician" };
let mockLoading = false;
let mockOrgId = "synthetic-org";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, loading: mockLoading }) }));
jest.mock("@/contexts/HouseholdContext", () => ({ useHousehold: () => ({ activeProfileId: null }) }));
jest.mock("@/contexts/OrgContext", () => ({ useOrg: () => ({ org: { id: mockOrgId }, isLoading: false }) }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: true }));
jest.mock("@/components/guided/OnboardingWelcome.css", () => ({}));

beforeEach(() => {
  localStorage.clear();
  mockUser = { id: "synthetic-guide-owner", role: "physician" };
  mockLoading = false;
  mockOrgId = "synthetic-org";
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test.each(Object.keys(MEAL_BUILDER_GUIDANCE) as GuidedMealBuilderKey[])(
  "%s renders the same dark introduction and closes without saving or navigating",
  builderKey => {
    const close = jest.fn();
    render(<BuilderGuidanceTour builderKey={builderKey} isOpen title="Detailed builder guide"
      steps={[]} onClose={close} />);
    expect(screen.getByRole("dialog").classList.contains("bg-[#111111]")).toBe(true);
    expect(screen.getByText(MEAL_BUILDER_GUIDANCE[builderKey].name)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue in Builder" }));
    expect(close).toHaveBeenCalledWith(false);
  },
);

test("professional guidance describes the selected client's targets, never the practitioner's onboarding", () => {
  render(<BuilderGuidanceTour builderKey="diabetic" professionalClient isOpen
    title="Detailed diabetes guide" steps={[]} onClose={jest.fn()} />);
  expect(screen.getByRole("heading", { name: "Let's Build Your Client's Meals" })).toBeTruthy();
  expect(screen.getByText("Professional Client Builder Guide")).toBeTruthy();
  expect(screen.getAllByText(/not your personal setup/).length).toBeGreaterThan(0);
  expect(screen.queryByText("Stage 1 of 3")).toBeNull();
});

test("an existing critical dialog takes priority over the builder introduction", () => {
  render(<>
    <div role="alertdialog" aria-label="Required safety acknowledgement">Safety acknowledgement</div>
    <BuilderGuidanceTour builderKey="diabetic" isOpen title="Full guide" steps={[]} onClose={jest.fn()} />
  </>);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the accepted personal General Nutrition guide is not replaced by a competing introduction", () => {
  const hook = renderHook(() => useBuilderGuidanceTour("general_nutrition"));
  expect(hook.result.current.useIntroduction).toBe(false);
  expect(hook.result.current.scopeKey).toBe("general-nutrition-builder");
});

test("Don't show again is an explicit presentation choice", () => {
  const close = jest.fn();
  render(<BuilderGuidanceTour builderKey="glp1" isOpen title="Full guide" steps={[]} onClose={close} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue in Builder" }));
  expect(close).toHaveBeenCalledWith(true);
});

test("the full existing builder guide remains available", () => {
  render(<BuilderGuidanceTour builderKey="anti_inflammatory" isOpen title="Original full guide"
    steps={[{ title: "Existing duplication controls", description: "Keep the existing guide." }]} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Read the Full Builder Guide" }));
  expect(screen.getByRole("heading", { name: "Original full guide" })).toBeTruthy();
  expect(screen.getByText("Keep the existing guide.")).toBeTruthy();
});

test("client and organization switches hide the prior open guide and isolate preferences", () => {
  const hook = renderHook(({ clientId }) => useBuilderGuidanceTour("diabetic", clientId), {
    initialProps: { clientId: "synthetic-client-A" },
  });
  act(() => jest.advanceTimersByTime(500));
  expect(hook.result.current.shouldShow).toBe(true);
  const oldKey = hook.result.current.scopeKey;
  act(() => hook.result.current.closeTour(true));
  hook.rerender({ clientId: "synthetic-client-B" });
  expect(hook.result.current.shouldShow).toBe(false);
  expect(hook.result.current.scopeKey).not.toBe(oldKey);
  act(() => jest.advanceTimersByTime(500));
  expect(hook.result.current.shouldShow).toBe(true);
  mockOrgId = "synthetic-second-org";
  hook.rerender({ clientId: "synthetic-client-B" });
  expect(hook.result.current.shouldShow).toBe(false);
  hook.rerender({ clientId: "synthetic-client-A" });
  act(() => jest.advanceTimersByTime(500));
  expect(hook.result.current.shouldShow).toBe(true);
  mockOrgId = "synthetic-org";
  hook.rerender({ clientId: "synthetic-client-A" });
  act(() => jest.advanceTimersByTime(500));
  expect(hook.result.current.shouldShow).toBe(false);
  act(() => hook.result.current.openTour());
  expect(hook.result.current.shouldShow).toBe(true);
});

test("automatic-off respects account preferences while manual Guide still opens", () => {
  createGuidancePreferenceStore({ accountId: mockUser.id }).apply("disable_automatic");
  const hook = renderHook(() => useBuilderGuidanceTour("performance_competition"));
  act(() => jest.advanceTimersByTime(1000));
  expect(hook.result.current.shouldShow).toBe(false);
  act(() => hook.result.current.openTour());
  expect(hook.result.current.shouldShow).toBe(true);
});

test("unresolved authentication cannot automatically present or manually open a guide", () => {
  mockLoading = true;
  const hook = renderHook(() => useBuilderGuidanceTour("weekly"));
  act(() => jest.advanceTimersByTime(1000));
  act(() => hook.result.current.openTour());
  expect(hook.result.current.shouldShow).toBe(false);
});
