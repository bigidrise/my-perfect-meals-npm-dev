/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { MfaSetupSection } from "@/components/MfaSetupSection";
import { apiRequest } from "@/lib/queryClient";
import { setAuthToken } from "@/lib/auth";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/lib/queryClient", () => ({
  apiRequest: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  setAuthToken: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
const mockedSetAuthToken = setAuthToken as jest.MockedFunction<typeof setAuthToken>;
const serverSetupKey = "JBSWY3DPEHPK3PXP";

describe("mandatory MFA enrollment mobile UX", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  test("shows QR and same-phone setup using the server-provided key", async () => {
    mockedApiRequest
      .mockResolvedValueOnce({ mfaEnabled: false, enrolledAt: null } as any)
      .mockResolvedValueOnce({
        qrDataUri: "data:image/png;base64,qr-placeholder",
        secret: serverSetupKey,
      } as any);

    render(<MfaSetupSection enrollmentRequired />);

    expect(await screen.findByRole("heading", { name: "Using this phone?" })).toBeInTheDocument();
    expect(screen.getByText("Scan QR code")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByLabelText("Authenticator setup key")).toHaveTextContent(serverSetupKey);
    expect(screen.getByText(/does not create a new My Perfect Meals account/i)).toBeInTheDocument();
    expect(screen.queryByText("mfa.cancel")).not.toBeInTheDocument();
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, "/api/auth/mfa/setup/begin", { method: "POST" });
  });

  test("copies the exact server-provided setup key and confirms success", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockedApiRequest
      .mockResolvedValueOnce({ mfaEnabled: false, enrolledAt: null } as any)
      .mockResolvedValueOnce({
        qrDataUri: "data:image/png;base64,qr-placeholder",
        secret: serverSetupKey,
      } as any);

    render(<MfaSetupSection enrollmentRequired />);
    await user.click(await screen.findByRole("button", { name: "Copy setup key" }));

    expect(writeText).toHaveBeenCalledWith(serverSetupKey);
    expect(screen.getByRole("button", { name: "Setup key copied" })).toBeInTheDocument();
  });

  test("does not begin or reveal enrollment when server status says MFA is already enabled", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      mfaEnabled: true,
      enrolledAt: "2026-09-05T12:00:00.000Z",
    } as any);

    render(<MfaSetupSection enrollmentRequired />);

    await waitFor(() => expect(screen.getByText("mfa.onTitle")).toBeInTheDocument());
    expect(mockedApiRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Authenticator setup key")).not.toBeInTheDocument();
    expect(screen.queryByText("Scan QR code")).not.toBeInTheDocument();
  });

  test("keeps the key selectable and explains manual copying when clipboard access fails", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) },
    });
    mockedApiRequest
      .mockResolvedValueOnce({ mfaEnabled: false, enrolledAt: null } as any)
      .mockResolvedValueOnce({
        qrDataUri: "data:image/png;base64,qr-placeholder",
        secret: serverSetupKey,
      } as any);

    render(<MfaSetupSection enrollmentRequired />);
    await user.click(await screen.findByRole("button", { name: "Copy setup key" }));

    expect(screen.getByLabelText("Authenticator setup key")).toHaveClass("select-all");
    expect(screen.getByText(/Press and hold the selectable key below/i)).toBeInTheDocument();
  });

  test("verifies the TOTP code, retains the rotated token, and completes enrollment", async () => {
    const user = userEvent.setup();
    const onEnrollmentComplete = jest.fn();
    mockedApiRequest
      .mockResolvedValueOnce({ mfaEnabled: false, enrolledAt: null } as any)
      .mockResolvedValueOnce({
        qrDataUri: "data:image/png;base64,qr-placeholder",
        secret: serverSetupKey,
      } as any)
      .mockResolvedValueOnce({
        authToken: "rotated-test-token",
        backupCodes: ["BACKUP01"],
      } as any);

    render(
      <MfaSetupSection
        enrollmentRequired
        onEnrollmentComplete={onEnrollmentComplete}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "mfa.addedAccountNext" }));
    await user.type(screen.getByPlaceholderText("000 000"), "123456");
    await user.click(screen.getByRole("button", { name: "mfa.activate2fa" }));

    expect(await screen.findByText("mfa.enabledTitle")).toBeInTheDocument();
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      3,
      "/api/auth/mfa/setup/confirm",
      { method: "POST", body: JSON.stringify({ code: "123456" }) },
    );
    expect(mockedSetAuthToken).toHaveBeenCalledWith("rotated-test-token");

    await user.click(screen.getByRole("button", { name: "mfa.savedBackupBtn" }));
    expect(onEnrollmentComplete).toHaveBeenCalledTimes(1);
  });

  test("leaves ordinary non-required users in the existing opt-in state", async () => {
    mockedApiRequest.mockResolvedValueOnce({
      mfaEnabled: false,
      enrolledAt: null,
    } as any);

    render(<MfaSetupSection />);

    expect(await screen.findByText("mfa.defaultTitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mfa.enable2fa" })).toBeInTheDocument();
    expect(mockedApiRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Using this phone?")).not.toBeInTheDocument();
  });
});