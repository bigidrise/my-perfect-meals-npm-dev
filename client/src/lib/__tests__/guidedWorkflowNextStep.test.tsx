/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { GuidedWorkflowNextStep } from "@/components/guided/GuidedWorkflowNextStep";
import { useGuidedJourneyDashboard } from "@/hooks/useGuidedJourneyDashboard";

jest.mock("wouter", () => ({ useLocation: () => ["/macro-counter", jest.fn()] }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({
  user: { id: "layout-fixture", role: "client", isSandbox: false },
  loading: false, refreshUser: jest.fn(),
}) }));
jest.mock("@/contexts/HouseholdContext", () => ({ useHousehold: () => ({ activeProfileId: null }) }));
jest.mock("@/lib/developmentAuthRoutes", () => ({ IS_DEVELOPMENT: true }));
jest.mock("@/hooks/useGuidedJourneyDashboard", () => ({ useGuidedJourneyDashboard: jest.fn() }));
jest.mock("@/components/guided/GuidedJourneyExplanation", () => ({ GuidedJourneyExplanation: () => null }));
const hook = useGuidedJourneyDashboard as jest.Mock;
const retry = jest.fn();
beforeEach(() => {
  localStorage.clear();
  retry.mockClear();
  hook.mockImplementation(input => ({
    visible: input.eligible, handoff: null, presentationNotice: null, explanation: null,
    model: { canRetry: true, statusText: "Saved targets could not be confirmed.", busy: false },
    retry,
  }));
});

test("new Retry panel clears the native fixed summary without moving the summary", () => {
  render(<GuidedWorkflowNextStep summaryVisible />);
  const panel = screen.getByTestId("guided-workflow-next-step");
  expect(panel.style.marginTop).toBe("8rem");
  const button = screen.getByRole("button", { name: "Retry Progress Check" });
  expect(button.className).toContain("scroll-mt-64");
  fireEvent.click(button);
  expect(retry).toHaveBeenCalledTimes(1);
});
test("guided views without the fixed summary do not get extra clearance", () => {
  render(<GuidedWorkflowNextStep />);
  expect(screen.getByTestId("guided-workflow-next-step").style.marginTop).toBe("");
});
test("ineligible professional calculator sessions add neither offer nor spacing", () => {
  const result = render(<GuidedWorkflowNextStep summaryVisible professionalSession />);
  expect(result.container.children).toHaveLength(0);
  expect(hook.mock.calls.at(-1)[0].eligible).toBe(false);
});
