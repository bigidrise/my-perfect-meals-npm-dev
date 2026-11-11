/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import BottomNav from "@/components/BottomNav";
import DesktopLayout from "@/layout/DesktopLayout";

const mockNavigate = jest.fn();
const mockCopilot = jest.fn(() => { throw new Error("Navigation must not invoke Copilot"); });
jest.mock("wouter", () => ({
  useLocation: () => ["/dashboard", mockNavigate],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/copilot/CopilotContext", () => ({
  useCopilot: () => mockCopilot(),
}));
jest.mock("@/lib/guestMode", () => ({ isGuestMode: () => false }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "navigation-fixture", onboardingCompletedAt: "complete" } }),
}));
jest.mock("@/layout/DesktopHeader", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => null }));
jest.mock("@/hooks/useProUnreadCount", () => ({ useProUnreadCount: () => 0 }));
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: async () => ({ organization: { available: false } }),
}));
jest.mock("@/lib/studioNavigationAccess", () => ({
  deriveStudioNavigationAccess: () => ({ studioVisible: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test.each(["mobile", "desktop"])("%s smiley navigates to Ask Chef without opening or scheduling a Copilot card", async surface => {
  await act(async () => {
    render(surface === "mobile" ? <BottomNav /> : <DesktopLayout><p>Current page</p></DesktopLayout>);
  });
  fireEvent.click(screen.getByRole("button", { name: "Chef" }));
  act(() => { jest.advanceTimersByTime(2000); });
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/coach-corner/home");
  expect(mockCopilot).not.toHaveBeenCalled();
});
