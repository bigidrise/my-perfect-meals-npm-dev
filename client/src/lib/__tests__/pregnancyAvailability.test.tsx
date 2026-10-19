/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  useAuth: jest.fn(() => { throw new Error("Paused page must not mount Pregnancy content"); }),
}));
jest.mock("@/lib/api", () => ({ post: jest.fn(), ApiError: class extends Error {} }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: jest.fn(() => false) }));
jest.mock("@/components/PregnancySupportSetupModal", () => ({ PregnancySupportSetupModal: () => null }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ VoiceInputButton: () => null }));

import MyPerfectPregnancyPage from "@/pages/MyPerfectPregnancyPage";
import { useAuth } from "@/contexts/AuthContext";
import { post } from "@/lib/api";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { Link } from "wouter";

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
