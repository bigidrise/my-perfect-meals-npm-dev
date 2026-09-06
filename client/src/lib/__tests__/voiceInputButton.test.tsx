/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useState } from "react";
import VoiceInputButton from "@/components/voice/VoiceInputButton";

class MockMediaRecorder {
  static isTypeSupported = jest.fn(() => true);
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || "audio/webm";
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = jest.fn();
const getUserMedia = jest.fn();
const fetchMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    value: MockMediaRecorder,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  getUserMedia.mockResolvedValue({
    getTracks: () => [{ stop: stopTrack }],
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ transcript: "pork chop" }),
  });
  global.fetch = fetchMock;
});

function Harness({
  initial = "",
  mode = "append",
  onSubmit = jest.fn(),
}: {
  initial?: string;
  mode?: "append" | "replace";
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <input
        aria-label="Food request"
        value={value}
        onChange={event => setValue(event.target.value)}
      />
      <VoiceInputButton value={value} onChange={setValue} mode={mode} />
    </form>
  );
}

async function recordAndStop() {
  fireEvent.click(screen.getByTestId("voice-input-button"));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Stop voice recording" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Stop voice recording" }));
}

describe("VoiceInputButton", () => {
  it("records, stops, transcribes, and appends to the controlled value", async () => {
    render(<Harness initial="mashed potatoes" />);

    await recordAndStop();

    await waitFor(() => {
      expect(screen.getByLabelText("Food request")).toHaveValue("mashed potatoes pork chop");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/voice/transcribe",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(stopTrack).toHaveBeenCalled();
  });

  it("supports replacement semantics and remains manually editable", async () => {
    render(<Harness initial="old query" mode="replace" />);

    await recordAndStop();
    await waitFor(() => expect(screen.getByLabelText("Food request")).toHaveValue("pork chop"));

    fireEvent.change(screen.getByLabelText("Food request"), {
      target: { value: "pork chop with mashed potatoes" },
    });
    expect(screen.getByLabelText("Food request")).toHaveValue("pork chop with mashed potatoes");
  });

  it("does not erase typed text when transcription fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<Harness initial="keep this text" />);

    await recordAndStop();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("typed text was not changed");
    });
    expect(screen.getByLabelText("Food request")).toHaveValue("keep this text");
  });

  it("handles microphone denial without breaking typing", async () => {
    getUserMedia.mockRejectedValue(new Error("denied"));
    render(<Harness initial="typed request" />);

    fireEvent.click(screen.getByTestId("voice-input-button"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Microphone access was denied"));
    fireEvent.change(screen.getByLabelText("Food request"), {
      target: { value: "typing still works" },
    });
    expect(screen.getByLabelText("Food request")).toHaveValue("typing still works");
  });

  it("never submits the surrounding form when transcription completes", async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await recordAndStop();
    await waitFor(() => expect(screen.getByLabelText("Food request")).toHaveValue("pork chop"));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});