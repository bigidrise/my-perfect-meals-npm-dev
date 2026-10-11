/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { DevelopmentStudioGuard } from "../client/src/components/pro/DevelopmentStudioGuard";
import { StudioLoadingPanel } from "../client/src/components/pro/StudioLoadingPanel";
import { apiRequest } from "../client/src/lib/queryClient";
import { preloadStudioPage } from "../client/src/lib/studioTransition";

let mockUser: any;
let mockOrgLoading = false;
let mockRoute = "/pro/clients";
const mockNavigate = jest.fn();
const mockPrivateData = jest.fn();
const mockTiming = { start: jest.fn(), finish: jest.fn(), selectCode: jest.fn(), codeLoaded: jest.fn() };
jest.mock("../client/src/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock("../client/src/contexts/OrgContext", () => ({
  useOrg: () => ({ org: { id: "synthetic-org", featureFlags: { requireAcademy: true } }, isLoading: mockOrgLoading }),
}));
jest.mock("../client/src/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ requestUpgrade: jest.fn() }) }));
jest.mock("wouter", () => ({ useLocation: () => [mockRoute, mockNavigate] }));
jest.mock("../client/src/lib/queryClient", () => ({ apiRequest: jest.fn() }));
jest.mock("../client/src/lib/professionalLegalRecovery", () => ({ createProfessionalLegalRecoveryUrl: () => "/agreements" }));
jest.mock("../client/src/lib/studioTransition", () => ({
  preloadStudioPage: jest.fn(),
  currentStudioNavigation: () => mockTiming,
}));

const request = apiRequest as jest.Mock;
const preload = preloadStudioPage as jest.Mock;
function ProtectedPage() {
  useEffect(() => { mockPrivateData(); }, []);
  return <h1>Authorized clients</h1>;
}
function response(url: string) {
  if (url.includes("studio-access")) return { studioAccess: { canReconnectAddon: false } };
  if (url.includes("/legal/")) return { allAccepted: true };
  return { phase1Complete: true, proCareCertificationComplete: true };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: "synthetic-user", professionalRole: "trainer", isAdmin: false, phase2GateEnabled: true };
  mockOrgLoading = false;
  mockRoute = "/pro/clients";
  request.mockImplementation(async (url: string) => response(url));
  preload.mockResolvedValue(undefined);
});
afterEach(cleanup);

test("pending verification preserves navigation and never mounts protected data", async () => {
  request.mockReturnValue(new Promise(() => {}));
  render(<><nav>Studio navigation</nav><DevelopmentStudioGuard component={ProtectedPage} /></>);
  await act(async () => {});
  expect(screen.getByRole("navigation")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Opening your Studio workspace");
  expect(screen.queryByText("Authorized clients")).not.toBeInTheDocument();
  expect(mockPrivateData).not.toHaveBeenCalled();
  expect(preload).toHaveBeenCalledWith("/pro/clients");
  expect(request).toHaveBeenCalledWith("/api/business/workspace/studio-access");
  expect(request).toHaveBeenCalledWith("/api/legal/status?flow=attestation");
  expect(request).toHaveBeenCalledWith("/api/legal/status?flow=professional");
  expect(request).toHaveBeenCalledWith("/api/certifications/phase1-status");
});

test("authorized page waits for both code and all permission checks", async () => {
  const code = deferred<void>();
  preload.mockReturnValue(code.promise);
  render(<DevelopmentStudioGuard component={ProtectedPage} />);
  await waitFor(() => expect(mockTiming.finish).toHaveBeenCalledWith("agreements", "verified"));
  expect(mockPrivateData).not.toHaveBeenCalled();
  code.resolve();
  expect(await screen.findByText("Authorized clients")).toBeInTheDocument();
  expect(mockPrivateData).toHaveBeenCalledTimes(1);
  expect(mockTiming.finish).toHaveBeenCalledWith("authorized-page", "ready");
});

test.each(["/api/legal/status?flow=attestation", "/api/legal/status?flow=professional"])(
  "failed agreement request %s is unable to verify, never accepted",
  async failedUrl => {
    request.mockImplementation(async (url: string) => {
      if (url === failedUrl) throw new Error("503");
      return response(url);
    });
    render(<DevelopmentStudioGuard component={ProtectedPage} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to verify");
    expect(mockPrivateData).not.toHaveBeenCalled();
    expect(mockTiming.finish).toHaveBeenCalledWith("agreements", "error");
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

test.each(["/api/business/workspace/studio-access", "/api/certifications/phase1-status"])(
  "failed access or certification request %s keeps content hidden",
  async failedUrl => {
    request.mockImplementation(async (url: string) => {
      if (url === failedUrl) throw new Error("403 MFA_REQUIRED");
      return response(url);
    });
    render(<DevelopmentStudioGuard component={ProtectedPage} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to verify");
    expect(mockPrivateData).not.toHaveBeenCalled();
  },
);

test.each([
  ["/api/business/workspace/studio-access", { studioAccess: { canReconnectAddon: true } }, "/more"],
  ["/api/legal/status?flow=attestation", { allAccepted: false }, "/agreements"],
  ["/api/certifications/phase1-status", { phase1Complete: false }, "/professional-onboarding-bridge"],
  ["/api/certifications/phase1-status", { phase1Complete: true, proCareCertificationComplete: false }, "/certifications/procare_certification"],
])("denied check %s preserves its existing recovery route", async (deniedUrl, result, recovery) => {
  request.mockImplementation(async (url: string) => url === deniedUrl ? result : response(url));
  render(<DevelopmentStudioGuard component={ProtectedPage} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Studio access is unavailable");
  expect(mockPrivateData).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith(recovery);
});

test("signed-out session never starts permission requests or private data", async () => {
  mockUser = null;
  render(<DevelopmentStudioGuard component={ProtectedPage} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Sign in");
  await waitFor(() => expect(preload).toHaveBeenCalled());
  expect(request).not.toHaveBeenCalled();
  expect(mockPrivateData).not.toHaveBeenCalled();
});

test("Organization policy loads before certification while other checks run in parallel", async () => {
  mockOrgLoading = true;
  const view = render(<DevelopmentStudioGuard component={ProtectedPage} />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("/api/legal/status?flow=attestation"));
  expect(request).not.toHaveBeenCalledWith("/api/certifications/phase1-status");
  expect(mockPrivateData).not.toHaveBeenCalled();
  mockOrgLoading = false;
  view.rerender(<DevelopmentStudioGuard component={ProtectedPage} />);
  await act(async () => {});
  expect(await screen.findByText("Authorized clients")).toBeInTheDocument();
});

test("existing admin certification exemption does not waive workspace or agreements", async () => {
  mockUser.isAdmin = true;
  render(<DevelopmentStudioGuard component={ProtectedPage} />);
  expect(await screen.findByText("Authorized clients")).toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith("/api/certifications/phase1-status");
  expect(request).toHaveBeenCalledWith("/api/business/workspace/studio-access");
  expect(request).toHaveBeenCalledWith("/api/legal/status?flow=attestation");
});

test("later navigation rechecks permissions instead of reusing approval", async () => {
  const view = render(<DevelopmentStudioGuard component={ProtectedPage} />);
  await screen.findByText("Authorized clients");
  mockRoute = "/care-team/trainer";
  request.mockReturnValue(new Promise(() => {}));
  view.rerender(<DevelopmentStudioGuard component={ProtectedPage} />);
  await act(async () => {});
  expect(screen.queryByText("Authorized clients")).not.toBeInTheDocument();
  expect(request.mock.calls.filter(([url]) => url.includes("studio-access"))).toHaveLength(2);
});

test("late approvals from the previous account cannot render the next account", async () => {
  const previous = deferred<any>();
  request.mockReturnValue(previous.promise);
  const view = render(<DevelopmentStudioGuard component={ProtectedPage} />);
  mockUser = { ...mockUser, id: "second-synthetic-user" };
  request.mockReturnValue(new Promise(() => {}));
  view.rerender(<DevelopmentStudioGuard component={ProtectedPage} />);
  await act(async () => previous.resolve({ ...response("/api/certifications/phase1-status"), allAccepted: true }));
  await waitFor(() => expect(mockTiming.codeLoaded).toHaveBeenCalledWith("professional", "ready"));
  expect(mockPrivateData).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("page-code failure is explicit and cannot mount protected content", async () => {
  preload.mockRejectedValue(new Error("Module failed"));
  render(<DevelopmentStudioGuard component={ProtectedPage} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to verify");
  expect(mockPrivateData).not.toHaveBeenCalled();
});

test("loading, errors and denials share branded accessible panel semantics", () => {
  const view = render(<StudioLoadingPanel />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  view.rerender(<StudioLoadingPanel kind="error" />);
  expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  view.rerender(<StudioLoadingPanel kind="denied" />);
  expect(screen.getByRole("alert")).toHaveTextContent("access");
});
