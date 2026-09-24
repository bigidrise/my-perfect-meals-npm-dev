/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HealthContextControls } from "@/components/profile/HealthContextControls";
import { NUTRITION_SUPPORT_OPTIONS } from "@shared/nutritionSupportOptions";

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
    expect(screen.getByText("GLP-1 Nutrition Support")).toBeTruthy();
    expect(screen.getByText("Anti-Inflammatory Nutrition Support")).toBeTruthy();
    expect(screen.getByText("Nutrition support only. This does not record medication use or change your Builder.")).toBeTruthy();
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
    expect(await screen.findByRole("button", { name: "My support is on · turn off" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Turn on my support" })).toHaveLength(1);
  });

  it("acknowledges one GLP-1 click immediately and waits for the saved result before changing its state", async () => {
    let finishSave!: (value: typeof initial) => void;
    render(<HealthContextControls userId="account-a" />);
    await screen.findByText("GLP-1 Nutrition Support");
    mockApiRequest.mockImplementationOnce(() =>
      new Promise<typeof initial>((resolve) => { finishSave = resolve; }));

    fireEvent.click(screen.getAllByRole("button", { name: "Turn on my support" })[1]);
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

  it("shows the same eligible options on onboarding and keeps protected sources separate", async () => {
    mockApiRequest.mockResolvedValueOnce({
      ...initial,
      supports: NUTRITION_SUPPORT_OPTIONS.map(({ protocol }) => ({
        protocol, status: protocol === "cardiac" ? "active" : "off",
        personalEnabled: false,
        sources: protocol === "cardiac"
          ? [{ id: "care", kind: "care_team", status: "active" }] : [],
      })),
    });
    render(<HealthContextControls userId="account-a" placement="onboarding" />);
    expect(await screen.findByText("Heart Nutrition Support")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Turn on my support" })).toHaveLength(NUTRITION_SUPPORT_OPTIONS.length);
    expect(screen.getByText(/Another source still includes this support/)).toBeTruthy();
    expect(screen.queryByText("Pregnancy Nutrition Support")).toBeNull();
  });

  it("keeps a known health fact and a personal nutrition preference as separate choices", async () => {
    const toggleCurrent = jest.fn();
    mockApiRequest.mockResolvedValueOnce({
      ...initial,
      supports: [
        ...initial.supports,
        { protocol: "cardiac", status: "off", personalEnabled: false, sources: [] },
      ],
    });
    render(<HealthContextControls
      userId="account-a" placement="onboarding"
      currentConditions={[]}
      onCurrentConditionToggle={toggleCurrent}
    />);
    await screen.findByText("Heart Nutrition Support");
    fireEvent.click(screen.getByRole("button", { name: "This already applies to me" }));
    expect(toggleCurrent).toHaveBeenCalledWith("cardiac");
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
    fireEvent.click(screen.getAllByRole("button", { name: "Turn on my support" })[1]);
    await screen.findByRole("button", { name: "My support is on · turn off" });
    unmount();
    render(<HealthContextControls userId="account-a" />);
    expect(await screen.findByRole("button", { name: "My support is on · turn off" })).toBeTruthy();
    expect(screen.getByText(/Your current meal strategy: Diabetic Builder/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "My support is on · turn off" }));
    await waitFor(() => expect(stored.supports[1].personalEnabled).toBe(false));
  });
});