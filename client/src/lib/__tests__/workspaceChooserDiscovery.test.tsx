/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { buildDevelopmentWorkspaceMetadata } from "../../../../server/services/developmentWorkspaceDiscovery";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority } from "../../../../server/config/developmentFounderPhysicianDemo";

const mockDiscovery = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@/lib/workspaceAvailability", () => ({
  fetchWorkspaceAvailability: () => mockDiscovery(),
}));
jest.mock("wouter", () => ({ useLocation: () => ["/pro-portal", mockNavigate] }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("framer-motion", () => ({
  motion: { div: ({ children }: any) => children },
  AnimatePresence: ({ children }: any) => children,
}));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));

beforeEach(() => { jest.clearAllMocks(); });
afterEach(cleanup);

test("the existing chooser presents Personal, Business/Organization and the original Clinic together", async () => {
  mockDiscovery.mockResolvedValue(buildDevelopmentWorkspaceMetadata({
    userId: authority.userId, professionalRole: "business", onboardingCompletedAt: "2026-01-01",
    studio: { id: authority.clinicId, ownerUserId: authority.userId, type: "clinic", status: "active", name: "Original fixture Clinic" },
    organizations: [{ id: "own-org", name: "Own fixture Organization", role: "owner",
      relationshipType: "internal_staff", locations: [{ id: "own-location", name: "Own Location", role: "owner", isDefault: true }] }],
  }).availability);
  render(<WorkspaceChooser />);
  const clinic = await screen.findByRole("button", { name: /Clinic.*access review required/i });
  expect(screen.getByRole("button", { name: /personalSpace/i })).toBeInTheDocument();
  const organization = screen.getByRole("button", { name: /Business.*Organization/i });
  expect(organization).toHaveTextContent("Own fixture Organization");
  fireEvent.click(clinic);
  expect(mockNavigate).toHaveBeenCalledWith("/pro-portal");
  fireEvent.click(organization);
  expect(mockNavigate).toHaveBeenCalledWith("/business-organizations");
});
test("a failed discovery remains an explicit error rather than invented Personal-only availability", async () => {
  mockDiscovery.mockRejectedValue(new Error("Unavailable"));
  render(<WorkspaceChooser />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Workspace discovery failed");
  expect(screen.getByRole("button", { name: /Retry workspace discovery/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /personalSpace/i })).not.toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});
