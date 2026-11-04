/** @jest-environment jsdom */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReleaseBannerMount, suppressReleaseBanner } from "@/components/ReleaseBannerMount";
import { useUpdateState } from "@/contexts/UpdateContext";
import { releaseDismissKey } from "@/lib/releaseVersion";

let mockLocation = "/dashboard";
jest.mock("wouter", () => ({ useLocation: () => [mockLocation, jest.fn()] }));
jest.mock("@/contexts/UpdateContext", () => ({ useUpdateState: jest.fn() }));
const release = { hasUpdate: true, releaseNotes: ["Approved existing release"], releaseId: "test-release" };

beforeEach(() => {
  mockLocation = "/dashboard";
  localStorage.clear();
  (useUpdateState as jest.Mock).mockReturnValue(release);
});
afterEach(cleanup);

test.each([
  "/auth", "/auth?mode=signup", "/login", "/signup", "/auth/mfa",
  "/welcome", "/forgot-password", "/reset-password?token=fixture",
  "/onboarding", "/onboarding/extended", "/onboarding-v2",
  "/select-builder", "/professional-onboarding-bridge",
  "/consumer-welcome", "/procare-welcome", "/trainer-welcome", "/physician-welcome",
  "/procare-identity", "/procare-attestation", "/business/start", "/business/setup",
  "/join/clinic", "/join/business-offer", "/pilot/activate", "/activate/business-pilot",
])("does not render or acknowledge the release on %s", location => {
  mockLocation = location;
  const view = render(<ReleaseBannerMount />);
  expect(view.container.querySelector("[data-release-update-banner]")).toBeNull();
  expect(localStorage.getItem(releaseDismissKey(release.releaseId)!)).toBeNull();
});

test.each(["/dashboard", "/pricing", "/home", "/guest-builder", "/macro-counter", "/performance", "/authentic-recipes", "/onboarding-tools"])(
  "preserves ordinary release visibility on %s", location => {
    expect(suppressReleaseBanner(location)).toBe(false);
    mockLocation = location;
    render(<ReleaseBannerMount />);
    expect(screen.getByText("Approved existing release")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh now" })).toBeTruthy();
  },
);

test("route changes hide without dismissing; returning restores the existing release", () => {
  const view = render(<ReleaseBannerMount />);
  mockLocation = "/auth";
  view.rerender(<ReleaseBannerMount />);
  expect(screen.queryByText("What's new")).toBeNull();
  expect(localStorage.getItem(releaseDismissKey(release.releaseId)!)).toBeNull();
  mockLocation = "/dashboard";
  view.rerender(<ReleaseBannerMount />);
  expect(screen.getByText("What's new")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  expect(localStorage.getItem(releaseDismissKey(release.releaseId)!)).toBe("1");
  expect(screen.queryByText("What's new")).toBeNull();
});

test("does not manufacture a release when detection reports none", () => {
  (useUpdateState as jest.Mock).mockReturnValue({ ...release, hasUpdate: false });
  const view = render(<ReleaseBannerMount />);
  expect(view.container.querySelector("[data-release-update-banner]")).toBeNull();
});

test("provider stays global while welcome/loading replacement screens exclude the banner child", () => {
  const app = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");
  expect(app).toContain("<UpdateProvider>");
  expect(app).toMatch(/<AppRouter>\s*<Router \/>\s*<ReleaseBannerMount \/>\s*<\/AppRouter>/);
  expect(app.match(/<ReleaseBannerMount \/>/g)).toHaveLength(1);
});
