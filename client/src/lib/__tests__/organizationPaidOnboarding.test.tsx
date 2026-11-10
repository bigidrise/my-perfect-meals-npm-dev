/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import OrganizationPaidOnboarding from "@/components/business/OrganizationPaidOnboarding";
jest.mock("@/components/business/OrganizationPaidSuccessPrompt", () => ({
  __esModule: true,
  default: ({ open, hasLinkedRewardful, onContinue, onDismiss }: any) => open
    ? <div role="dialog"><h2>Your Business Subscription Is Active!</h2>
      <button onClick={onContinue}>{hasLinkedRewardful ? "Manage Rewardful" : "Set Up Rewardful"}</button>
      <button onClick={onDismiss}>I'll Do This Later</button></div> : null,
}));
const navigate = jest.fn();
const props = { userId: "owner-fixture", organizationId: "organization-fixture", paidActivationVerified: false,
  affiliate: { organizationId: "organization-fixture", canManage: true, hasLinkedRewardful: false },
  onOpenPartnerRevenue: navigate };
beforeEach(() => { localStorage.clear(); navigate.mockReset(); });
test("a checkout success URL without server-confirmed paid evidence never displays onboarding", () => {
  window.history.replaceState({}, "", "/business-dashboard?checkout=success&session_id=cs_fixture");
  render(<OrganizationPaidOnboarding {...props} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("server-confirmed paid activation shows the prompt once per exact owner and organization", () => {
  const view = render(<OrganizationPaidOnboarding {...props} paidActivationVerified />);
  fireEvent.click(screen.getByText("I'll Do This Later"));
  expect(screen.queryByRole("dialog")).toBeNull();
  view.unmount();
  const next = render(<OrganizationPaidOnboarding {...props} paidActivationVerified />);
  expect(screen.queryByRole("dialog")).toBeNull();
  next.rerender(<OrganizationPaidOnboarding {...props} userId="another-owner" paidActivationVerified />);
  expect(screen.getByRole("dialog")).toBeTruthy();
});
test("setup opens the existing authorized Partner & Revenue flow, not an invented external URL", () => {
  render(<OrganizationPaidOnboarding {...props} paidActivationVerified />);
  fireEvent.click(screen.getByText("Set Up Rewardful"));
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("linked affiliates are offered management instead of creation", () => {
  render(<OrganizationPaidOnboarding {...props} paidActivationVerified affiliate={{ ...props.affiliate, hasLinkedRewardful: true }} />);
  expect(screen.getByText("Manage Rewardful")).toBeTruthy();
  expect(screen.queryByText("Set Up Rewardful")).toBeNull();
});
test("workspace changes hide stale prior-organization onboarding", () => {
  const view = render(<OrganizationPaidOnboarding {...props} paidActivationVerified />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  view.rerender(<OrganizationPaidOnboarding {...props} organizationId="other-organization" paidActivationVerified />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("revoked payment evidence or nonmanager identity closes onboarding", () => {
  const view = render(<OrganizationPaidOnboarding {...props} paidActivationVerified />);
  view.rerender(<OrganizationPaidOnboarding {...props} paidActivationVerified affiliate={{ ...props.affiliate, canManage: false }} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  view.rerender(<OrganizationPaidOnboarding {...props} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});
