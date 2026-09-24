/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HealthContextControls } from "@/components/profile/HealthContextControls";

const mockApiRequest = jest.fn();
jest.mock("@/lib/apiRequest", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

const initial = {
  shadowOnly: true,
  builder: "diabetic",
  supports: [
    { protocol: "anti_inflammatory", status: "off", personalEnabled: false, sources: [] },
    { protocol: "glp1", status: "off", personalEnabled: false, sources: [] },
  ],
  legacyAntiPreferenceNeedsReview: false,
  labReviews: [],
  history: [],
};

describe("DEV profile support controls", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue(initial);
  });

  it("renders GLP-1 and Anti-Inflammatory as editable peer overlays without a medication assertion", async () => {
    render(<HealthContextControls userId="account-a" />);
    expect(await screen.findByText("Your current meal strategy: Diabetic Builder. These support settings do not switch it.")).toBeTruthy();
    expect(screen.getByText("GLP-1 Support")).toBeTruthy();
    expect(screen.getByText("Anti-Inflammatory Support")).toBeTruthy();
    expect(screen.getByText("Nutrition support only. This does not record current medication use.")).toBeTruthy();
    const switches = screen.getAllByRole("button", { name: "Turn on my support" });
    expect(switches).toHaveLength(2);
    mockApiRequest.mockResolvedValueOnce({
      ...initial,
      supports: [
        initial.supports[0],
        { protocol: "glp1", status: "active", personalEnabled: true,
          sources: [{ id: "personal", kind: "you", status: "active" }] },
      ],
    });
    fireEvent.click(switches[1]);
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/health-context/support/glp1", { method: "PUT", body: '{"enabled":true}' },
    ));
    expect(await screen.findByRole("button", { name: "My support is on" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Turn on my support" })).toHaveLength(1);
  });

  it("clears the prior account's controls immediately on keyed account change", async () => {
    const { rerender } = render(<HealthContextControls key="account-a" userId="account-a" />);
    await screen.findByText("GLP-1 Support");
    let finishOther!: (value: typeof initial) => void;
    mockApiRequest.mockImplementationOnce(() =>
      new Promise<typeof initial>((resolve) => { finishOther = resolve; }));
    rerender(<HealthContextControls key="account-b" userId="account-b" />);
    expect(screen.queryByText("GLP-1 Support")).toBeNull();
    expect(screen.getByText("Loading support settings…")).toBeTruthy();
    finishOther(initial);
    expect(await screen.findByText("GLP-1 Support")).toBeTruthy();
  });
});