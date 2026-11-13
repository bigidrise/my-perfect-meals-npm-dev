/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import Recommendation from "@/components/clinical/ProtocolRecommendationModal";
import Downgrade from "@/components/clinical/ProtocolDowngradeModal";
import Thyroid from "@/components/clinical/ThyroidRecommendationModal";

jest.mock("@/components/ui/universal-modal", () => ({
  UniversalDialog: ({ children }: any) => <div>{children}</div>,
}));
jest.mock("@/components/ui/dialog", () => ({
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/hooks/useEffectiveClinicalProtocols", () => ({ refreshClinicalProtocols: jest.fn() }));

const signal = {
  protocol: "heart-failure", confidence: "moderate", reason: "Saved measurement signal",
  triggerFields: ["blood_pressure_systolic"],
} as const;
const downgradeSignal = {
  protocol: "heart-failure", protocolLabel: "Cardiac Health",
  normalFields: ["blood_pressure_systolic"], reason: "A reading does not establish resolution.",
};
const thyroidSignal = {
  hasThyroidIndicators: true, confidence: "moderate", reason: "Saved thyroid signal",
  triggerFields: ["tsh_high"], subtypeConditions: [], isAutoimmune: false,
} as const;
const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
afterEach(cleanup);

test.each(["primary", "thyroid", "removal"])("%s never reports success after a forbidden backend operation", async variant => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  const success = jest.fn();
  const close = jest.fn();
  if (variant === "primary") render(<Recommendation open onClose={close} signal={signal as any} labId={7} physicianLocked={false} onAccepted={success} />);
  if (variant === "thyroid") render(<Thyroid open onClose={close} signal={thyroidSignal as any} labId={7} onAccepted={success} />);
  if (variant === "removal") render(<Downgrade open onClose={close} signal={downgradeSignal} labId={7} onRemoved={success} />);
  fireEvent.click(screen.getByRole("button", { name: variant === "primary" ? /Activate Cardiac/ : variant === "thyroid" ? /Activate Thyroid/ : /Turn Off Self-Managed/ }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  expect(success).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

test("protected reassessment disables removal without claiming disease resolution", () => {
  render(<Downgrade open onClose={jest.fn()} signal={downgradeSignal} labId={7} physicianLocked onRemoved={jest.fn()} />);
  expect(screen.getByRole("button", { name: /Turn Off Self-Managed/ })).toBeDisabled();
  expect(screen.queryByText("Your numbers are back to normal range.")).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("protected thyroid activation is disabled", () => {
  render(<Thyroid open onClose={jest.fn()} signal={thyroidSignal as any} labId={7} physicianLocked onAccepted={jest.fn()} />);
  expect(screen.getByRole("button", { name: /Activate Thyroid/ })).toBeDisabled();
});

test("successful self-managed activation invokes the success callback", async () => {
  fetchMock.mockResolvedValue({ ok: true });
  const accepted = jest.fn();
  render(<Recommendation open onClose={jest.fn()} signal={signal as any} labId={7} physicianLocked={false} onAccepted={accepted} />);
  fireEvent.click(screen.getByRole("button", { name: /Activate Cardiac/ }));
  await waitFor(() => expect(accepted).toHaveBeenCalledTimes(1));
});
