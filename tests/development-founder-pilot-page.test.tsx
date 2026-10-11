/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import PilotProgramAdmin from "../client/src/pages/PilotProgramAdmin";
import DevelopmentPilotMfaStatus from "../client/src/components/business/DevelopmentPilotMfaStatus";
import { apiRequest } from "../client/src/lib/queryClient";
import { useAuth } from "../client/src/contexts/AuthContext";

jest.mock("../client/src/lib/queryClient", () => ({ apiRequest: jest.fn() }));
jest.mock("../client/src/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("wouter", () => ({ useLocation: () => ["/admin/pilots", jest.fn()] }));
jest.mock("../client/src/components/business/FounderPilotInvitation", () => ({
  __esModule: true,
  default: () => <div>Founder-issued 30-Day Business Pilot</div>,
}));

const request = apiRequest as jest.Mock;
const auth = useAuth as jest.Mock;
afterEach(cleanup);
beforeEach(() => {
  jest.resetAllMocks();
  auth.mockReturnValue({ user: { isAdmin: true, isFounder: true } });
  request.mockImplementation(async (url: string) => url === "/api/auth/mfa/status"
    ? { mfaEnabled: true, sessionVerified: true }
    : { authorizations: [] });
});

test.each([null, { isAdmin: false, isFounder: true }, { isAdmin: false, isFounder: false }])(
  "unauthorized user cannot see the founder screen or trigger its reads (%j)",
  (user) => {
    auth.mockReturnValue({ user });
    render(<PilotProgramAdmin showDevelopmentMfaStatus />);
    expect(screen.getByText("Administrator access is required.")).toBeInTheDocument();
    expect(screen.queryByText("Founder-issued 30-Day Business Pilot")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Development MFA status")).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  },
);

test("authorized founder sees the invitation screen and read-only MFA status", async () => {
  render(<PilotProgramAdmin showDevelopmentMfaStatus />);
  expect(screen.getByText("Founder-issued 30-Day Business Pilot")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("Current session verified:").parentElement).toHaveTextContent("Yes"));
  expect(screen.getByText("MFA enabled:").parentElement).toHaveTextContent("Yes");
  expect(request).toHaveBeenCalledWith("/api/auth/mfa/status");
  expect(request.mock.calls.every(([, options]) => !options || !options.method || options.method === "GET")).toBe(true);
});

test("admin without founder identity cannot see founder invitation or MFA indicator", async () => {
  auth.mockReturnValue({ user: { isAdmin: true, isFounder: false } });
  render(<PilotProgramAdmin showDevelopmentMfaStatus />);
  await waitFor(() => expect(screen.getByText("No Business Pilot signup authorizations.")).toBeInTheDocument());
  expect(screen.getByText("Organization Pilots")).toBeInTheDocument();
  expect(screen.queryByText("Founder-issued 30-Day Business Pilot")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith("/api/auth/mfa/status");
});

test("default/Production page has no new MFA reads or indicator", async () => {
  render(<PilotProgramAdmin />);
  await waitFor(() => expect(screen.getByText("No Business Pilot signup authorizations.")).toBeInTheDocument());
  expect(screen.getByText("Founder-issued 30-Day Business Pilot")).toBeInTheDocument();
  expect(screen.queryByLabelText("Development MFA status")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalledWith("/api/auth/mfa/status");
});

test.each([
  [true, false, "Yes", "No"],
  [false, false, "No", "No"],
  [true, true, "Yes", "Yes"],
])("distinguishes enrollment %s from session verification %s", async (mfaEnabled, sessionVerified, enabled, verified) => {
  request.mockResolvedValue({ mfaEnabled, sessionVerified });
  render(<DevelopmentPilotMfaStatus />);
  await waitFor(() => expect(screen.getByText("MFA enabled:").parentElement).toHaveTextContent(enabled));
  expect(screen.getByText("Current session verified:").parentElement).toHaveTextContent(verified);
});

test("shows a loading state, not an unverified success", () => {
  request.mockReturnValue(new Promise(() => {}));
  render(<DevelopmentPilotMfaStatus />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking MFA status");
  expect(screen.queryByText("Current session verified:")).not.toBeInTheDocument();
});

test.each([new Error("401 AUTH_REQUIRED"), new Error("503 MFA service unavailable")])(
  "failed authenticated read remains unavailable (%s)",
  async (error) => {
    request.mockRejectedValue(error);
    render(<DevelopmentPilotMfaStatus />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not verify MFA status");
    expect(screen.queryByText("Current session verified:")).not.toBeInTheDocument();
  },
);

test.each([{}, { mfaEnabled: "true", sessionVerified: true }, { mfaEnabled: true }])(
  "malformed status never displays a successful verification (%j)",
  async (data) => {
    request.mockResolvedValue(data);
    render(<DevelopmentPilotMfaStatus />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not verify MFA status");
    expect(screen.queryByText("Current session verified:")).not.toBeInTheDocument();
  },
);
