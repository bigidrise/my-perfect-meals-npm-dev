/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import HydrationDashboardCard from "@/components/dashboard/HydrationDashboardCard";

let mockUser: Record<string, unknown>;
const mockNavigate = jest.fn();
const mockRequestUpgrade = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", mockNavigate] }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock("@/contexts/UpgradeModalContext", () => ({
  useUpgradeModal: () => ({ requestUpgrade: mockRequestUpgrade }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: "test-user", planLookupKey: "mpm_premium_monthly" };
});

test.each(["mpm_premium_monthly", "mpm_ultimate_monthly"])("purchased %s opens the existing Hydration route", planLookupKey => {
  mockUser.planLookupKey = planLookupKey;
  render(<HydrationDashboardCard />);
  fireEvent.click(screen.getByRole("button", { name: "Open My Perfect Hydration Center" }));
  expect(mockNavigate).toHaveBeenCalledWith("/hydration");
  expect(mockRequestUpgrade).not.toHaveBeenCalled();
});

test.each(["mpm_free", "mpm_basic_monthly"])("purchased %s preserves the Pro upgrade gate despite bypass flags", planLookupKey => {
  mockUser = { id: "test-user", planLookupKey, isTester: true, accessTier: "PAID_FULL", entitlements: ["hydration_center"] };
  render(<HydrationDashboardCard />);
  fireEvent.click(screen.getByRole("button", { name: "Open My Perfect Hydration Center" }));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockRequestUpgrade).toHaveBeenCalledWith(expect.objectContaining({
    requiredTier: "pro", featureName: "My Perfect Hydration Center",
  }));
});

test.each(["{Enter}", " "])("the entire card opens with keyboard input %s", async key => {
  const user = userEvent.setup();
  render(<HydrationDashboardCard />);
  await user.tab();
  expect(screen.getByRole("button")).toHaveFocus();
  await user.keyboard(key);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

test("the compact card keeps wrapping text and shrinkable content at narrow widths", () => {
  render(<HydrationDashboardCard />);
  expect(screen.getByRole("button")).toHaveClass("w-full", "text-left");
  expect(screen.getByText("My Perfect Hydration Center").parentElement).toHaveClass("flex-wrap");
  expect(screen.getByText("My Perfect Hydration Center").parentElement?.parentElement).toHaveClass("min-w-0");
  expect(screen.getByText("Track fluids, find drinks that work for you, and get personalized hydration support.")).toBeVisible();
});

test("the Dashboard places Hydration directly after My Perfect Menu and before Shopping List", () => {
  const source = readFileSync(join(process.cwd(), "client/src/pages/DashboardNew.tsx"), "utf8");
  const menu = source.indexOf('data-testid="card-foods-i-enjoy"');
  const hydration = source.indexOf("<HydrationDashboardCard />");
  const shopping = source.indexOf('data-testid="card-shopping-list"');
  expect(menu).toBeGreaterThan(-1);
  expect(hydration).toBeGreaterThan(menu);
  expect(hydration).toBeLessThan(shopping);
  expect(source.slice(menu, hydration)).toContain("My Perfect Menu");
});
