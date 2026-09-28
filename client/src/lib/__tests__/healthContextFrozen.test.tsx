/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HealthContextControls } from "@/components/profile/HealthContextControls";
import type { HealthContextView } from "@shared/healthContextControl";
import { PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED } from "@shared/personalFoodSupportFreeze";

const mockApiRequest = jest.fn();
jest.mock("@/lib/apiRequest", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

describe("frozen optional personal support UI", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue({
      shadowOnly: true,
      builder: "glp1",
      supports: [
        { protocol: "glp1", status: "active", personalEnabled: true,
          sources: [
            { id: "saved-choice", kind: "you", status: "active" },
            { id: "clinical-source", kind: "care_team", status: "active" },
            { id: "medication-source", kind: "medication_information", status: "active" },
          ] },
        { protocol: "anti_inflammatory", status: "active", personalEnabled: true,
          sources: [{ id: "saved-anti-choice", kind: "you", status: "active" }] },
      ],
      history: [{ protocol: "glp1", activity: "selected", occurredAt: "2026-01-01" }],
      labReviews: [],
      legacyAntiPreferenceNeedsReview: true,
    } as unknown as HealthContextView);
  });

  it("hides personal GLP-1 and Anti-Inflammatory choices but keeps clinical context visible", async () => {
    expect(PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED).toBe(false);
    render(<HealthContextControls userId="person" profilePreferenceCard={<button>Turn on preference</button>} />);
    expect(await screen.findByText("Your current meal strategy: GLP-1 Builder.")).toBeTruthy();
    expect(screen.queryByText("GLP-1 Nutrition Support")).toBeNull();
    expect(screen.queryByText("Anti-Inflammatory Support")).toBeNull();
    expect(screen.queryByRole("button", { name: /turn on my support|turn off|turn on preference|yes, keep support/i })).toBeNull();
    expect(screen.getByText(/Care team — recorded as current/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /medication information is no longer current/i })).toBeTruthy();
    expect(screen.getByText(/Saved personal support choices are retained but paused/)).toBeTruthy();
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledTimes(1));
    expect(mockApiRequest).not.toHaveBeenCalledWith(expect.stringContaining("/support/"), expect.anything());
  });

  it("shows unresolved earlier clinical history even while optional support controls are paused", async () => {
    const pending = {
      shadowOnly: true, builder: "standard",
      supports: [
        { protocol: "cardiac", status: "needs_confirmation", personalEnabled: false,
          sources: [{ id: "00000000-0000-4000-8000-000000000001", kind: "earlier_profile", status: "needs_confirmation" }] },
        { protocol: "renal", status: "needs_confirmation", personalEnabled: false,
          sources: [{ id: "00000000-0000-4000-8000-000000000002", kind: "care_team", status: "needs_confirmation" }] },
      ],
      history: [], labReviews: [], legacyAntiPreferenceNeedsReview: false,
    } as HealthContextView;
    mockApiRequest.mockResolvedValueOnce(pending).mockResolvedValueOnce({
      ...pending, supports: [pending.supports[1]], message: "Earlier profile information reviewed.",
    });
    render(<HealthContextControls userId="person" />);
    expect(await screen.findByText("Health information needing review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes, keep support" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "No, this is past" })).toBeTruthy();
    expect(screen.getByText(/A personal choice cannot remove a provider-owned instruction/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Turn on my support/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "No, this is past" }));
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/health-context/earlier-profile/00000000-0000-4000-8000-000000000001/decision",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ current: false }) }),
    ));
    expect(await screen.findByText("Earlier profile information reviewed.")).toBeTruthy();
  });

  it("lets a subject mark pending medication information as past without certifying current use", async () => {
    const sourceId = "00000000-0000-4000-8000-000000000003";
    mockApiRequest.mockResolvedValueOnce({
      shadowOnly: true, builder: "standard",
      supports: [{ protocol: "glp1", status: "needs_confirmation", personalEnabled: false,
        sources: [{ id: sourceId, kind: "medication_information", status: "needs_confirmation" }] }],
      history: [], labReviews: [], legacyAntiPreferenceNeedsReview: false,
    } as HealthContextView).mockResolvedValueOnce({
      shadowOnly: true, builder: "standard", supports: [],
      history: [], labReviews: [], legacyAntiPreferenceNeedsReview: false,
    } as HealthContextView);
    render(<HealthContextControls userId="person" />);
    fireEvent.click(await screen.findByRole("button", { name: /medication information is no longer current/i }));
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith(
      `/api/health-context/medication/${sourceId}/past`,
      expect.objectContaining({ method: "POST", body: "{}" }),
    ));
    expect(await screen.findByText(/review was recorded.*current meal safety rules remain unchanged/i)).toBeTruthy();
  });
});