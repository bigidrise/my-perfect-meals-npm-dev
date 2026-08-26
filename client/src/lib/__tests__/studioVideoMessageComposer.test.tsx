/**
 * @jest-environment jsdom
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StudioVideoMessageComposer, {
  getSupportedVideoMimeType,
} from "@/components/pro/StudioVideoMessageComposer";

jest.mock("@/lib/resolveApiBase", () => ({
  apiUrl: (path: string) => path,
}));

jest.mock("@/lib/auth", () => ({
  getAuthHeaders: () => ({ Authorization: "Bearer test" }),
}));

class MockMediaRecorder {
  static isTypeSupported = jest.fn(() => true);
  static lastOptions: MediaRecorderOptions | undefined;
  static recordedBlob: Blob | undefined;
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    MockMediaRecorder.lastOptions = options;
    this.mimeType = options?.mimeType || "video/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: MockMediaRecorder.recordedBlob
        ?? new Blob(["recorded video"], { type: this.mimeType }),
    });
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
  jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

beforeEach(() => {
  jest.clearAllMocks();
  MockMediaRecorder.isTypeSupported.mockImplementation(() => true);
  MockMediaRecorder.lastOptions = undefined;
  MockMediaRecorder.recordedBlob = undefined;
  getUserMedia.mockResolvedValue(makeStream());
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  global.fetch = fetchMock;
});

function renderComposer(uploadPath = "/api/pro/tablet/client-1/video-message") {
  return render(
    <StudioVideoMessageComposer
      recipientName="Alex"
      uploadPath={uploadPath}
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
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/session/activity",
    expect.objectContaining({ method: "POST" }),
  ));
  fetchMock.mockClear();
}

describe("StudioVideoMessageComposer", () => {
  it("selects a Chrome-style WebM codec when the browser supports it", () => {
    MockMediaRecorder.isTypeSupported.mockImplementation(
      (type: string) => type === "video/webm;codecs=vp8,opus",
    );

    expect(getSupportedVideoMimeType()).toBe("video/webm;codecs=vp8,opus");
  });

  it("selects an iOS/Safari-compatible MP4 container when WebM is unavailable", () => {
    MockMediaRecorder.isTypeSupported.mockImplementation(
      (type: string) => type === "video/mp4",
    );

    expect(getSupportedVideoMimeType()).toBe("video/mp4");
  });

  it("allows the browser to choose a container when no preferred MIME type is supported", () => {
    MockMediaRecorder.isTypeSupported.mockImplementation(() => false);

    expect(getSupportedVideoMimeType()).toBeUndefined();
  });

  it("records without uploading and shows a complete local preview before send", async () => {
    renderComposer();
    expect(screen.getByText(/Maximum 5 minutes/i)).toBeInTheDocument();

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
    expect(MockMediaRecorder.lastOptions).toEqual(expect.objectContaining({
      videoBitsPerSecond: 1_200_000,
      audioBitsPerSecond: 48_000,
    }));
  });

  it("replaces an unsent recording when Record Again is chosen", async () => {
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("record-video-again"));

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("recorded-video-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("stop-video-recording")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/activity",
      expect.objectContaining({ method: "POST" }),
    );
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
    renderComposer();
    await recordOneVideo();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entry: { id: "message-1", contentType: "video" } }),
    });

    fireEvent.click(screen.getByTestId("send-video-message"));
    fireEvent.click(screen.getByTestId("send-video-message"));

    await waitFor(() => expect(onSent).toHaveBeenCalledWith({ id: "message-1", contentType: "video" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("recorded-video-preview")).not.toBeInTheDocument();
  });

  it("uses the client reply endpoint when the shared composer is opened by a client", async () => {
    renderComposer("/api/client/tablet/video-message");
    await recordOneVideo();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entry: { id: "client-message-1", contentType: "video" } }),
    });

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client/tablet/video-message",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends one normalized WebM file when the recorder includes codec parameters", async () => {
    MockMediaRecorder.isTypeSupported.mockImplementation(
      (type: string) => type === "video/webm;codecs=vp8,opus",
    );
    renderComposer();
    await recordOneVideo();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entry: { id: "message-codec", contentType: "video" } }),
    });

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));

    const requestOptions = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = requestOptions.body as FormData;
    const uploadedFile = requestBody.get("video") as File;
    expect(uploadedFile.type).toBe("video/webm");
    expect(uploadedFile.name).toBe("studio-video-message.webm");
  });

  it("uses a QuickTime extension when an iOS recorder selects it", async () => {
    MockMediaRecorder.isTypeSupported.mockImplementation(
      (type: string) => type === "video/quicktime",
    );
    renderComposer();
    await recordOneVideo();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ entry: { id: "message-mov", contentType: "video" } }),
    });

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));

    const requestOptions = fetchMock.mock.calls[0][1] as RequestInit;
    const uploadedFile = (requestOptions.body as FormData).get("video") as File;
    expect(uploadedFile.type).toBe("video/quicktime");
    expect(uploadedFile.name).toBe("studio-video-message.mov");
  });

  it("keeps the local recording available when send fails so it can be retried", async () => {
    renderComposer();
    await recordOneVideo();
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: "Upload unavailable" }),
      })
      .mockResolvedValueOnce({
          ok: true,
          status: 200,
        json: async () => ({ entry: { id: "message-2", contentType: "video" } }),
      });

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Upload unavailable"));
    expect(screen.getByTestId("recorded-video-preview")).toBeInTheDocument();
    expect(screen.getByTestId("send-video-message")).toHaveTextContent("Retry send to Alex");
    expect(onSent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("send-video-message"));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an oversized recording before making an upload request", async () => {
    MockMediaRecorder.recordedBlob = new Blob(
      [new Uint8Array(64 * 1024 * 1024 + 1)],
      { type: "video/webm" },
    );
    renderComposer();
    await recordOneVideo();

    fireEvent.click(screen.getByTestId("send-video-message"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "The maximum is 64 MiB",
    ));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("recorded-video-preview")).toBeInTheDocument();
  });

  it("sends session activity only while actively recording and clears it on stop", async () => {
    jest.useFakeTimers();
    try {
      renderComposer();
      fireEvent.click(screen.getByTestId("start-video-recording"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session/activity",
        expect.objectContaining({ method: "POST" }),
      );

      fetchMock.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session/activity",
        expect.objectContaining({ method: "POST" }),
      );

      fireEvent.click(screen.getByTestId("stop-video-recording"));
      fetchMock.mockClear();
      await act(async () => {
        jest.advanceTimersByTime(2 * 60_000);
        await Promise.resolve();
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("cleans up recording session activity when the composer unmounts", async () => {
    jest.useFakeTimers();
    try {
      const { unmount } = renderComposer();
      fireEvent.click(screen.getByTestId("start-video-recording"));
      await act(async () => {
        await Promise.resolve();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session/activity",
        expect.objectContaining({ method: "POST" }),
      );

      fetchMock.mockClear();
      unmount();
      await act(async () => {
        jest.advanceTimersByTime(2 * 60_000);
        await Promise.resolve();
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("stops recording and dispatches timeout handling when activity returns 401", async () => {
    const dispatchEvent = jest.spyOn(window, "dispatchEvent");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Session expired" }),
    });

    try {
      renderComposer();
      fireEvent.click(screen.getByTestId("start-video-recording"));

      await waitFor(() => expect(screen.getByTestId("recorded-video-preview")).toBeInTheDocument());
      expect(screen.getByTestId("record-video-again")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Your session expired while recording",
      );
      expect(dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "mpm:session-idle-timeout" }),
      );
    } finally {
      dispatchEvent.mockRestore();
    }
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