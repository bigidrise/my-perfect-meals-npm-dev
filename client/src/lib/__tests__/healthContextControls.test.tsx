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

  it("offers only GLP-1 as a personal support choice, independently of medication and Builder", async () => {
    render(<HealthContextControls userId="account-a" />);
    expect(await screen.findByText("Your current meal strategy: Diabetic Builder. These support settings do not switch it.")).toBeTruthy();
    expect(screen.getByText("GLP-1 Nutrition Support")).toBeTruthy();
    expect(screen.queryByText("Anti-Inflammatory Nutrition Support")).toBeNull();
    expect(screen.getByText(/does not record medication use, change your Builder, or change meals yet/)).toBeTruthy();
    const switches = screen.getAllByRole("button", { name: "Turn on my support" });
    expect(switches).toHaveLength(1);
    mockApiRequest.mockResolvedValueOnce({
      ...initial,
      supports: [
        initial.supports[0],
        { protocol: "glp1", status: "active", personalEnabled: true,
          sources: [{ id: "personal", kind: "you", status: "active" }] },
      ],
    });
    fireEvent.click(switches[0]);
    await waitFor(() => expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/health-context/support/glp1", { method: "PUT", body: '{"enabled":true}' },
    ));
    expect(await screen.findByRole("button", { name: "My support is on · turn off" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn on my support" })).toBeNull();
  });

  it("acknowledges one GLP-1 click immediately and waits for the saved result before changing its state", async () => {
    let finishSave!: (value: typeof initial) => void;
    render(<HealthContextControls userId="account-a" />);
    await screen.findByText("GLP-1 Nutrition Support");
    mockApiRequest.mockImplementationOnce(() =>
      new Promise<typeof initial>((resolve) => { finishSave = resolve; }));

    fireEvent.click(screen.getByRole("button", { name: "Turn on my support" }));
    const saving = screen.getByRole("button", { name: "Saving…" });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Saving your support choice…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "My support is on · turn off" })).toBeNull();
    expect(mockApiRequest).toHaveBeenCalledTimes(2);

    finishSave({
      ...initial,
      supports: [initial.supports[0], {
        protocol: "glp1", status: "active", personalEnabled: true,
        sources: [{ id: "personal", kind: "you", status: "active" }],
      }],
    });
    expect(await screen.findByRole("button", { name: "My support is on · turn off" })).toBeTruthy();
  });

  it("clears the prior account's controls immediately on keyed account change", async () => {
    const { rerender } = render(<HealthContextControls key="account-a" userId="account-a" />);
    await screen.findByText("GLP-1 Nutrition Support");
    let finishOther!: (value: typeof initial) => void;
    mockApiRequest.mockImplementationOnce(() =>
      new Promise<typeof initial>((resolve) => { finishOther = resolve; }));
    rerender(<HealthContextControls key="account-b" userId="account-b" />);
    expect(screen.queryByText("GLP-1 Nutrition Support")).toBeNull();
    expect(screen.getByText("Loading support settings…")).toBeTruthy();
    finishOther(initial);
    expect(await screen.findByText("GLP-1 Nutrition Support")).toBeTruthy();
  });

  it("does not turn existing clinical records into extra onboarding switches", async () => {
    mockApiRequest.mockResolvedValueOnce({
      ...initial,
      legacyAntiPreferenceNeedsReview: true,
      supports: [
        initial.supports[1],
        ...["diabetes", "cardiac", "renal", "liver_support", "thyroid",
          "hormone_optimization", "menopause", "perimenopause",
          "metabolic_recovery", "oncology", "anti_inflammatory", "performance"].map((protocol) => ({
          protocol, status: "active", personalEnabled: true,
          sources: [{ id: `${protocol}-personal`, kind: "you", status: "active" }],
        })),
      ],
    });
    render(<HealthContextControls userId="account-a" placement="onboarding" />);
    expect(await screen.findByText("GLP-1 Nutrition Support")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Turn on my support" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "This already applies to me" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Use my support again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yes, keep support" })).toBeNull();
    expect(screen.getByText("Earlier support information")).toBeTruthy();
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith("/api/health-context");
  });

  it("reloads the same personal support choices after navigation without changing the Builder", async () => {
    let stored = {
      ...initial,
      supports: [
        { protocol: "anti_inflammatory", status: "off", personalEnabled: false, sources: [] as { id: string; kind: string; status: string }[] },
        { protocol: "glp1", status: "off", personalEnabled: false, sources: [] as { id: string; kind: string; status: string }[] },
      ],
    };
    mockApiRequest.mockImplementation(async (path: string, options?: { body: string }) => {
      if (path === "/api/health-context") return stored;
      if (path === "/api/health-context/support/glp1" && options) {
        const enabled = JSON.parse(options.body).enabled as boolean;
        stored = {
          ...stored,
          supports: [stored.supports[0], {
            protocol: "glp1", status: enabled ? "active" : "off", personalEnabled: enabled,
            sources: [{ id: "personal", kind: "you", status: enabled ? "active" : "off" }],
          }],
        };
        return stored;
      }
      throw new Error("Unexpected API request");
    });
    const { unmount } = render(<HealthContextControls userId="account-a" placement="onboarding" />);
    await screen.findByText("GLP-1 Nutrition Support");
    fireEvent.click(screen.getByRole("button", { name: "Turn on my support" }));
    await screen.findByRole("button", { name: "My support is on · turn off" });
    unmount();
    render(<HealthContextControls userId="account-a" />);
    expect(await screen.findByRole("button", { name: "My support is on · turn off" })).toBeTruthy();
    expect(screen.getByText(/Your current meal strategy: Diabetic Builder/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "My support is on · turn off" }));
    await waitFor(() => expect(stored.supports[1].personalEnabled).toBe(false));
  });
});