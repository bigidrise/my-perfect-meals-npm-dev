/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockNavigate = jest.fn();
let mockUser = { id: "synthetic-client", professionalRole: "business", isProCare: true, subscriptionStatus: "active", plan: "clinical" };
const mockFetch = jest.fn();
jest.mock("wouter", () => ({ useLocation: () => ["/dashboard", mockNavigate] }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock("@/contexts/OrgContext", () => ({ useOrgFlag: () => false }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: undefined }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/features/clientMessagingFlag", () => ({ developmentClientMessagingEnabled: true }));
jest.mock("@/features/coachCornerFlag", () => ({ COACHES_CORNER_ENABLED: false }));
jest.mock("@/lib/auth", () => ({ getAuthHeaders: () => ({}) }));
jest.mock("@/lib/resolveApiBase", () => ({ apiUrl: (path: string) => path }));
jest.mock("@/lib/subscriptionCheck", () => ({ hasPaidPlan: () => true, hasActivePaidSubscription: () => true }));
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/hooks/useIsDesktop", () => ({ useIsDesktop: () => false }));
jest.mock("@/hooks/useProUnreadCount", () => ({ useProUnreadCount: () => 0 }));
jest.mock("@/hooks/useMyPerfectMenuBuilder", () => ({ useMyPerfectMenuBuilder: () => ({}) }));
jest.mock("@/contexts/UpgradeModalContext", () => ({ useUpgradeModal: () => ({ openUpgradeModal: jest.fn() }) }));
jest.mock("@/components/copilot/CopilotContext", () => ({ useCopilot: () => ({ open: jest.fn() }) }));
jest.mock("@/components/WorkspaceChooser", () => ({ WorkspaceChooser: () => <div>UNEXPECTED WORKSPACE CHOOSER</div> }));
jest.mock("@/components/ProfileSheet", () => ({ ProfileSheet: () => null }));
jest.mock("@/components/MedicalSourcesInfo", () => ({ MedicalSourcesInfo: () => null }));
jest.mock("@/components/icons/HubControlIcon", () => ({ HubControlIcon: () => null }));
jest.mock("@/components/BugReportButton", () => ({ BugReportButton: () => null }));
jest.mock("@/components/dashboard/ComplianceCard", () => ({ ComplianceCard: () => null }));
jest.mock("@/components/dashboard/HydrationDashboardCard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/PatternAlertBanner", () => ({ PatternAlertBanner: () => null }));
jest.mock("@/components/TipsBanner", () => ({ TipsBanner: () => null }));
jest.mock("@/components/InspirationCaptureModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/MacroScanModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/protocol/NutritionPersonalizationSummaryCard", () => ({ NutritionPersonalizationSummaryCard: () => null }));
jest.mock("@/components/dashboard/GettingStartedCard", () => ({ GettingStartedCard: () => null }));
jest.mock("@/components/WhatsNewCard", () => ({ WhatsNewCard: () => null }));
jest.mock("@/components/TrialStatusCard", () => ({ TrialStatusCard: () => null }));
jest.mock("@/components/QuickStartPopover", () => ({ QuickStartPopover: () => null }));
jest.mock("@/components/ace/CoachCornerCard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/universal-modal", () => ({ InformationModal: () => null }));
jest.mock("@/lib/studioVoicePlayback", () => ({ loadStudioVoicePlayback: jest.fn(), StudioVoicePlaybackError: Error }));
jest.mock("@/lib/studioVideoPlayback", () => ({ loadStudioVideoPlayback: jest.fn(), StudioVideoPlaybackError: Error }));

import DashboardNew from "@/pages/DashboardNew";

const incoming = { id: "synthetic-incoming", sender: "pro", contentType: "text", body: "Synthetic provider greeting", createdAt: "2026-10-16T10:00:00Z" };
let failStatus = 503;
let replies: unknown[] = [];
function ok(body: unknown) { return { ok: true, status: 200, json: async () => body }; }

beforeEach(() => {
  window.scrollTo = jest.fn();
  localStorage.clear();
  sessionStorage.clear();
  mockNavigate.mockReset();
  mockFetch.mockReset();
  replies = [];
  failStatus = 503;
  global.fetch = mockFetch;
  mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/api/client/tablet") return ok({ messages: [incoming, ...replies] });
    if (path === "/api/client/tablet/message") {
      if (failStatus) return { ok: false, status: failStatus, json: async () => ({ error: "DO NOT EXPOSE PRIVATE SQL" }) };
      const entry = { ...incoming, id: "synthetic-reply", sender: "client", body: JSON.parse(init?.body as string).body };
      replies.push(entry);
      return { ...ok({ entry }), status: 201 };
    }
    return ok({});
  });
});

async function openConversation() {
  render(<DashboardNew />);
  fireEvent.click(screen.getByTestId("client-messages-entry"));
  await screen.findByText(incoming.body);
  return screen.getByPlaceholderText("replyCoach") as HTMLTextAreaElement;
}

describe("real Dashboard client panel with isolated synthetic dependencies", () => {
  it.each(["business", "physician", "trainer", ""])("shows one Messages entry for role %s and opens the full panel directly", async role => {
    mockUser = { ...mockUser, professionalRole: role };
    await openConversation();
    expect(screen.getAllByText("Messages")).toHaveLength(1);
    expect(screen.queryByText("providerMessages")).not.toBeInTheDocument();
    expect(screen.queryByText("clientMessages")).not.toBeInTheDocument();
    expect(screen.queryByText("UNEXPECTED WORKSPACE CHOOSER")).not.toBeInTheDocument();
    expect(screen.getByLabelText("sendVoice")).toBeInTheDocument();
    expect(screen.getByLabelText("Video message")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  it.each([503, 403, 422])("keeps the conversation and draft after HTTP %s and permits a successful retry", async status => {
    failStatus = status;
    const input = await openConversation();
    fireEvent.change(input, { target: { value: "Synthetic draft to retain" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    const error = await screen.findByTestId("client-message-send-error");
    expect(error).not.toHaveTextContent("PRIVATE SQL");
    expect(screen.getByText(incoming.body)).toBeInTheDocument();
    expect(input).toHaveValue("Synthetic draft to retain");
    expect(mockNavigate).not.toHaveBeenCalled();
    failStatus = 0;
    fireEvent.click(screen.getByRole("button", { name: "Retry message" }));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(screen.getByText("Synthetic draft to retain")).toBeInTheDocument();
    expect(screen.queryByTestId("client-message-send-error")).not.toBeInTheDocument();
  });
  it("does not erase a newer draft when an earlier send finishes", async () => {
    const input = await openConversation();
    let finish!: (response: unknown) => void;
    const normalFetch = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((path: string, init?: RequestInit) => path === "/api/client/tablet/message"
      ? new Promise(resolve => { finish = resolve; })
      : normalFetch(path, init));
    fireEvent.change(input, { target: { value: "First draft" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    fireEvent.change(input, { target: { value: "Next draft typed while sending" } });
    await act(async () => finish(ok({ entry: { ...incoming, id: "earlier-reply", sender: "client", body: "First draft" } })));
    expect(input).toHaveValue("Next draft typed while sending");
    expect(screen.getByText("First draft")).toBeInTheDocument();
  });
  it("retains a recorded voice draft after failure and sends it on retry", async () => {
    const originalRecorder = global.MediaRecorder;
    class Recorder {
      static isTypeSupported = () => true;
      state = "inactive";
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["synthetic voice"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    global.MediaRecorder = Recorder as unknown as typeof MediaRecorder;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop: jest.fn() }] }),
    } });
    try {
      await openConversation();
      const normalFetch = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path !== "/api/client/tablet/voice-message") return normalFetch(path, init);
        if (failStatus) return { ok: false, status: 503, json: async () => ({ error: "PRIVATE SQL" }) };
        return ok({ entry: { ...incoming, id: "voice-reply", sender: "client", contentType: "voice", body: "Synthetic voice reply" } });
      });
      fireEvent.click(screen.getByLabelText("sendVoice"));
      fireEvent.click(await screen.findByTitle("stopRecording"));
      expect(screen.getByText(/voiceReady/)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText("Send voice message"));
      await screen.findByRole("button", { name: "Retry voice message" });
      expect(screen.getByText(incoming.body)).toBeInTheDocument();
      expect(screen.getByText(/voiceReady/)).toBeInTheDocument();
      failStatus = 0;
      fireEvent.click(screen.getByRole("button", { name: "Retry voice message" }));
      await waitFor(() => expect(screen.queryByText(/voiceReady/)).not.toBeInTheDocument());
      expect(screen.getByPlaceholderText("replyCoach")).toBeInTheDocument();
    } finally {
      global.MediaRecorder = originalRecorder;
    }
  });
});
