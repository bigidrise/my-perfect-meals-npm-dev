/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudioVideoMessageComposer from "@/components/pro/StudioVideoMessageComposer";

jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => path,
}));

jest.mock("@/lib/auth", () => ({
  getAuthHeaders: () => ({ Authorization: "Bearer test" }),
}));

class MockMediaRecorder {
  static isTypeSupported = jest.fn(() => true);
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["recorded video"], { type: "video/webm" }) });
    this.onstop?.();
  }
}

function makeStream() {
  const tracks = [
    { kind: "video", stop: jest.fn() },
    { kind: "audio", stop: jest.fn() },
  ];
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
  };
}

const getUserMedia = jest.fn();
const fetchMock = jest.fn();
const onSent = jest.fn();
const onCancel = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    configurable: true,
    value: jest.fn(() => "blob:studio-video-preview"),
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserMedia.mockResolvedValue(makeStream());
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function renderComposer() {
  return render(
    <StudioVideoMessageComposer
      clientName="Alex"
      clientId="client-1"
      onSent={onSent}
      onCancel={onCancel}
    />,
  );
}

async function recordOneVideo() {
  fireEvent.click(screen.getByTestId("start-video-recording"));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByTestId("stop-video-recording"));
  await waitFor(() => expect(screen.getByTestId("recorded-video-preview")).toBeInTheDocument());
}

describe("StudioVideoMessageComposer", () => {
  it("records without uploading and shows a complete local preview before send", async () => {
    renderComposer();

    await recordOneVideo();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("recorded-video-preview")).toHaveAttribute(
      "src",
      "blob:studio-video-preview",
    );
    expect(screen.getByText(/Nothing has been uploaded/i)).toBeInTheDocument();
    expect(screen.getByTestId("record-video-again")).toBeInTheDocument();
    expect(screen.getByTestId("discard-video")).toBeInTheDocument();
    expect(screen.getByTestId("send-video-message")).toHaveTextContent("Send to Alex");
  });

  it("replaces an unsent recording when Record Again is chosen", async () => {
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("record-video-again"));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("recorded-video-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("stop-video-recording")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards an unsent recording without uploading", async () => {
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("discard-video"));

    expect(screen.queryByTestId("recorded-video-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("start-video-recording")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends exactly once and clears the local recording after success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ entry: { id: "message-1", contentType: "video" } }),
    });
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("send-video-message"));
    fireEvent.click(screen.getByTestId("send-video-message"));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ id: "message-1", contentType: "video" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("recorded-video-preview")).not.toBeInTheDocument();
  });

  it("keeps the local recording available when send fails so it can be retried", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Upload unavailable" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entry: { id: "message-2", contentType: "video" } }),
      });
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Upload unavailable"));
    expect(screen.getByTestId("recorded-video-preview")).toBeInTheDocument();
    expect(screen.getByTestId("send-video-message")).toHaveTextContent("Retry send to Alex");
    expect(onSent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not call recipient playback progress while the sender reviews locally", async () => {
    renderComposer();
    await recordOneVideo();

    const preview = screen.getByTestId("recorded-video-preview");
    await act(async () => {
      fireEvent.timeUpdate(preview, { currentTime: 1 });
      fireEvent.ended(preview);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});