/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TrialMilestoneModal } from "@/components/TrialMilestoneModal";

let mockUser: any;
let mockLocation = "/business-center";
const mockNavigate = jest.fn();
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("wouter", () => ({ useLocation: () => [mockLocation, mockNavigate] }));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <>{children}</>,
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
}));

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockClear();
  mockLocation = "/business-center";
  mockUser = { id: "synthetic-trial-actor", trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(), daysRemaining: 7 };
});

test.each([7, 3, 1])("normal %s-day trial milestone opens and dismisses once per window", days => {
  mockUser.daysRemaining = days;
  const view = render(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.unmount();
  render(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("a fresh profile object with the same trial inputs does not repeat updates or dismiss the open milestone", () => {
  const view = render(<TrialMilestoneModal />);
  for (let i = 0; i < 60; i++) {
    mockUser = { ...mockUser };
    view.rerender(<TrialMilestoneModal />);
  }
  expect(screen.queryByRole("dialog")).not.toBeNull();
  expect(localStorage.length).toBe(1);
});

test("excluded onboarding route waits until normal navigation before showing the milestone", () => {
  mockLocation = "/onboarding";
  const view = render(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
  mockLocation = "/business-center";
  view.rerender(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).not.toBeNull();
});

test.each(["mpm_premium_monthly", "mpm_ultimate_monthly"])("paid plan %s never becomes a trial milestone", planLookupKey => {
  mockUser.planLookupKey = planLookupKey;
  render(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(localStorage.length).toBe(0);
});

test("nontrial restricted demo metadata does not trigger the consumer milestone", () => {
  mockUser = { id: "synthetic-demo-actor", professionalRole: "physician", operatingStatus: "demo_only" };
  render(<TrialMilestoneModal />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
