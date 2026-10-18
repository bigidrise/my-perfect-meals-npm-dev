/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("wouter", () => ({ useLocation: jest.fn() }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(() => { throw new Error("Paused page must not mount Pregnancy content"); }),
}));
jest.mock("@/lib/api", () => ({ post: jest.fn(), ApiError: class extends Error {} }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/components/layout/MobileHeaderGuard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.mock("@/components/PregnancySupportSetupModal", () => ({ PregnancySupportSetupModal: () => null }));
jest.mock("@/components/voice/VoiceInputButton", () => ({ VoiceInputButton: () => null }));

import MyPerfectPregnancyPage from "@/pages/MyPerfectPregnancyPage";
import { useAuth } from "@/contexts/AuthContext";
import { post } from "@/lib/api";

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
