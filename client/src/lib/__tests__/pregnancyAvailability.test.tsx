/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
let mockPageVisible = false;
jest.mock("@shared/familyFeatureVisibility", () => ({
  get PREGNANCY_PAGE_VISIBLE() { return mockPageVisible; },
  PREGNANCY_COACH_VISIBLE: false,
  PARENTS_CORNER_VISIBLE: false,
}));
jest.mock("@/lib/developmentComingSoon", () => ({ developmentComingSoonEnabled: false }));
jest.mock("wouter", () => ({
  useLocation: jest.fn(),
  Link: jest.fn(({ href, children, ...props }: any) => (
    <a {...props} href={href} onClick={event => {
      event.preventDefault();
      window.history.pushState({}, "", href);
    }}>{children}</a>
  )),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ isSuccess: false, isError: false })),
}));
jest.mock("@/contexts/PageTitleContext", () => ({ usePageTitle: jest.fn() }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn(async () => ({ children: [] })) }));
jest.mock("@/components/ui/HowThisWorksLink", () => ({ HowThisWorksLink: () => null }));
jest.mock("@/lib/api", () => ({ post: jest.fn(), ApiError: class extends Error {} }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: jest.fn(() => false) }));
jest.mock("@/components/PregnancySupportSetupModal", () => ({ PregnancySupportSetupModal: jest.fn(() => null) }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ VoiceInputButton: () => null }));

import MyPerfectPregnancyPage from "@/pages/MyPerfectPregnancyPage";
import MyPerfectBeginningPage from "@/pages/lifestyle/MyPerfectBeginningPage";
import { useAuth } from "@/contexts/AuthContext";
import { post } from "@/lib/api";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/apiRequest";
import { PregnancySupportSetupModal } from "@/components/PregnancySupportSetupModal";

beforeEach(() => {
  mockPageVisible = false;
  (useLocation as jest.Mock).mockReturnValue(["/lifestyle", jest.fn()]);
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: "viewer", entitlements: ["FULL_ACCESS"] }, refreshUser: jest.fn(),
  });
  (useIsDesktop as jest.Mock).mockReturnValue(false);
  window.scrollTo = jest.fn();
});

it("direct navigation shows Coming Soon without mounting setup, coaching, or account queries", () => {
  const { container } = render(<MyPerfectPregnancyPage />);
  expect(screen.getByRole("heading").textContent).toContain("Coming Soon");
  expect(container.textContent).toContain("Clinical");
  expect(container.textContent).toContain("Existing Pregnancy settings are preserved");
  expect(container.textContent).toContain("not pregnancy-adjusted");
  expect(container.querySelector("form")).toBeNull();
  expect(container.querySelector("input")).toBeNull();
  expect(useAuth).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

it("keeps the mobile Coming Soon header and content below the iPhone safe area", () => {
  render(<MyPerfectPregnancyPage />);
  const page = screen.getByTestId("pregnancy-coming-soon");
  // JSDOM drops env() values; inspect the actual React style supplied to browsers.
  expect(MyPerfectPregnancyPage().props.style.paddingTop).toBe("env(safe-area-inset-top, 0px)");
  expect(page.querySelector('[aria-label="Pregnancy page header"]')).not.toBeNull();
  expect(page.querySelector("header")).toBeNull(); // Avoid global header CSS adding a second inset.
  expect(screen.getByRole("link", { name: "Back to Lifestyle" }).getAttribute("href")).toBe("/lifestyle");
});

it("does not add a duplicate mobile header on desktop", () => {
  (useIsDesktop as jest.Mock).mockReturnValueOnce(true);
  render(<MyPerfectPregnancyPage />);
  expect(screen.queryByLabelText("Pregnancy page header")).toBeNull();
  expect(screen.getByRole("heading").textContent).toContain("Coming Soon");
});

it("Back to Lifestyle uses internal routing without a document navigation", () => {
  window.history.replaceState({}, "", "/lifestyle/my-perfect-pregnancy");
  const push = jest.spyOn(window.history, "pushState");
  render(<MyPerfectPregnancyPage />);
  const link = screen.getByRole("link", { name: "Back to Lifestyle" });
  expect(Link).toHaveBeenCalledWith(expect.objectContaining({ href: "/lifestyle" }), expect.anything());
  expect(fireEvent.click(link, { button: 0 })).toBe(false); // Full-document navigation prevented.
  expect(window.location.pathname).toBe("/lifestyle");
  expect(push).toHaveBeenCalled();
  push.mockRestore();
});

describe("Pregnancy visible with coaching hidden", () => {
  beforeEach(() => { mockPageVisible = true; });

  it.each([false, true])("opens existing education without coaching on desktop=%s", desktop => {
    (useIsDesktop as jest.Mock).mockReturnValue(desktop);
    const { container } = render(<MyPerfectPregnancyPage />);
    expect(screen.queryByTestId("pregnancy-coming-soon")).toBeNull();
    expect(container.textContent).not.toContain("Coming Soon");
    expect(screen.getByRole("button", { name: /Learn/ }).className).toContain("bg-pink-700");
    expect(screen.getByRole("button", { name: /Food Safety/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Ask Coach/ })).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("retains the Food Safety section without exposing a coach action", () => {
    render(<MyPerfectPregnancyPage />);
    fireEvent.click(screen.getByRole("button", { name: /Food Safety/ }));
    expect(screen.getByRole("button", { name: /Food Safety/ }).className).toContain("bg-pink-700");
    expect(screen.queryByRole("button", { name: /Ask Coach/ })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("preserves the existing protocol editor entry while hiding the configured user's coach shortcut", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: "viewer", entitlements: ["FULL_ACCESS"], pregnancyStage: "trimester-2",
        pregnancySupportContext: { active: true, stage: "trimester-2", symptoms: [] },
      },
      refreshUser: jest.fn(),
    });
    render(<MyPerfectPregnancyPage />);
    fireEvent.click(screen.getByRole("button", { name: /Update Protocol/ }));
    expect((PregnancySupportSetupModal as jest.Mock).mock.calls.at(-1)?.[0].open).toBe(true);
    expect(screen.queryByRole("button", { name: /Ask Coach/ })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("preserves existing Clinical eligibility instead of granting access", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "viewer", entitlements: [] } });
    render(<MyPerfectPregnancyPage />);
    expect(screen.getByText("Clinical Plan Required")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Learn/ })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});

it("hides only Parent's Corner and retains both existing non-coaching cards", async () => {
  const { container } = render(<MyPerfectBeginningPage />);
  await waitFor(() => expect(screen.getByText("Child Nutrition Profile")).not.toBeNull());
  expect(screen.getByText("Create a Meal")).not.toBeNull();
  expect(screen.queryByText("Parent's Corner")).toBeNull();
  expect(container.textContent).toContain("My Perfect Beginning");
  expect(apiRequest).toHaveBeenCalledWith("/api/my-perfect-beginning/children");
  expect((apiRequest as jest.Mock).mock.calls.every(call => call.length === 1)).toBe(true);
  expect(post).not.toHaveBeenCalled();
});
