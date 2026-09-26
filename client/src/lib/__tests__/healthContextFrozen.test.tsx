/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
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
});